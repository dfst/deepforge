/*globals define*/
/*jshint node:true, browser:true*/

define([
    './templates/index',
    'q',
    'underscore',
    'deepforge/Constants',
    'deepforge/plugin/Operation',
    'deepforge/plugin/PtrCodeGen',
    'text!./metadata.json',
    'plugin/PluginBase'
], function (
    Templates,
    Q,
    _,
    CONSTANTS,
    OperationHelpers,
    PtrCodeGen,
    pluginMetadata,
    PluginBase
) {
    'use strict';

    pluginMetadata = JSON.parse(pluginMetadata);
    var OUTPUT_INTERVAL = 1500,
        STDOUT_FILE = 'job_stdout.txt',
        SKIP_ATTRIBUTES = [
            'code',
            'stdout',
            'execFiles',
            'jobId',
            'secret',
            CONSTANTS.LINE_OFFSET,
            CONSTANTS.DISPLAY_COLOR
        ];

    /**
     * Initializes a new instance of GenerateJob.
     * @class
     * @augments {PluginBase}
     * @classdesc This class represents the plugin GenerateJob.
     * @constructor
     */
    var GenerateJob = function () {
        // Call base class' constructor.
        PluginBase.call(this);
        this.pluginMetadata = pluginMetadata;
    };

    /**
     * Metadata associated with the plugin. Contains id, name, version, description, icon, configStructue etc.
     * This is also available at the instance at this.pluginMetadata.
     * @type {object}
     */
    GenerateJob.metadata = pluginMetadata;

    // Prototypical inheritance from PluginBase.
    GenerateJob.prototype = Object.create(PluginBase.prototype);
    GenerateJob.prototype.constructor = GenerateJob;

    /**
     * Main function for the plugin to execute. This will perform the execution.
     * Notes:
     * - Always log with the provided logger.[error,warning,info,debug].
     * - Do NOT put any user interaction logic UI, etc. inside this method.
     * - callback always has to be called even if error happened.
     *
     * @param {function(string, plugin.PluginResult)} callback - the result callback
     */
    GenerateJob.prototype.main = function (callback) {
        var files,
            artifactName,
            artifact,
            data = {},
            inputs,
            name,
            opId;

        name = this.getAttribute(this.activeNode, 'name');
        opId = this.core.getPath(this.activeNode);

        return this.createOperationFiles(this.activeNode)
            .then(results => {
                this.logger.info('Created operation files!');
                files = results;
                artifactName = `${name}_${opId.replace(/\//g, '_')}-execution-files`;
                artifact = this.blobClient.createArtifact(artifactName);

                // Add the input assets
                //   - get the metadata (name)
                //   - add the given inputs
                inputs = Object.keys(files.inputAssets);

                return Q.all(
                    inputs.map(input => {  // Get the metadata for each input
                        var hash = files.inputAssets[input];

                        // data asset for "input"
                        return this.blobClient.getMetadata(hash)
                            .fail(() => {
                                throw Error(`BLOB_FETCH_FAILED:${input}`);
                            });
                    })
                );
            })
            .then(mds => {
                // Record the large files
                var inputData = {},
                    runsh = [
                        '# Bash script to download data files and run job',
                        'if [ -z "$DEEPFORGE_URL" ]; then',
                        '  echo "Please set DEEPFORGE_URL and re-run:"',
                        '  echo ""',
                        '  echo "  DEEPFORGE_URL=http://my.deepforge.server.com:8080 bash run.sh"',
                        '  echo ""',
                        '  exit 1',
                        'fi',
                        'mkdir outputs\n'
                    ].join('\n');

                mds.forEach((metadata, i) => {
                    // add the hashes for each input
                    var input = inputs[i], 
                        hash = files.inputAssets[input],
                        dataDir = 'inputs/' + input + '/',
                        dataPath = dataDir + 'data',
                        url = this.blobClient.getRelativeDownloadURL(hash);

                    inputData[dataPath] = {
                        req: hash,
                        cache: metadata.content
                    };

                    // Add to the run.sh file
                    runsh += `mkdir -p ${dataDir}\n`;
                    runsh += `wget $DEEPFORGE_URL${url} -O ${dataPath}\n`;
                });

                delete files.inputAssets;
                files['input-data.json'] = JSON.stringify(inputData, null, 2);
                runsh += 'python main.py';
                files['run.sh'] = runsh;

                // Add pointer assets
                Object.keys(files.ptrAssets)
                    .forEach(path => data[path] = files.ptrAssets[path]);

                // Add the executor config
                return this.getOutputs(this.activeNode);
            })
            .then(outputArgs => {
                var config,
                    outputs,
                    fileList,
                    ptrFiles = Object.keys(files.ptrAssets),
                    file;

                delete files.ptrAssets;
                fileList = Object.keys(files).concat(ptrFiles);

                outputs = outputArgs.map(pair => pair[0])
                    .map(name => {
                        return {
                            name: name,
                            resultPatterns: [`outputs/${name}`]
                        };
                    });

                outputs.push(
                    {
                        name: 'stdout',
                        resultPatterns: [STDOUT_FILE]
                    },
                    {
                        name: name + '-all-files',
                        resultPatterns: fileList
                    }
                );

                config = {
                    cmd: 'node',
                    args: ['start.js'],
                    outputInterval: OUTPUT_INTERVAL,
                    resultArtifacts: outputs
                };
                files['executor_config.json'] = JSON.stringify(config, null, 4);

                // Save the artifact
                // Remove empty hashes
                for (file in data) {
                    if (!data[file]) {
                        this.logger.warn(`Empty data hash has been found for file "${file}". Removing it...`);
                        delete data[file];
                    }
                }
                return artifact.addObjectHashes(data);
            })
            .then(() => {
                this.logger.info(`Added ptr/input data hashes for "${artifactName}"`);
                return artifact.addFiles(files);
            })
            .then(() => {
                this.logger.info(`Added execution files for "${artifactName}"`);
                return artifact.save();
            })
            .then(hash => {
                this.result.setSuccess(true);
                this.result.addArtifact(hash);
                callback(null, this.result);
            })
            .fail(err => {
                this.result.setSuccess(false);
                callback(err, this.result);
            });
    }; 

    GenerateJob.prototype.createOperationFiles = function (node) {
        var files = {};
        // For each operation, generate the output files:
        //   inputs/<arg-name>/init.py  (respective data deserializer)
        //   pointers/<name>/init.py  (result of running the main plugin on pointer target - may need a rename)
        //   outputs/<name>/  (make dirs for each of the outputs)
        //   outputs/init.py  (serializers for data outputs)
        //
        //   attributes.py (returns py table of operation attributes)
        //   init.py (main file -> calls main and serializes outputs)
        //   <name>.py (entry point -> calls main operation code)

        // add the given files
        this.logger.info('About to generate operation execution files');
        return this.createEntryFile(node, files)
            .then(() => this.createClasses(node, files))
            .then(() => this.createCustomLayers(node, files))
            .then(() => this.createInputs(node, files))
            .then(() => this.createMainFile(node, files))
            .then(() => {
                this.createAttributeFile(node, files);
                return Q.ninvoke(this, 'createPointers', node, files);
            })
            .fail(err => {
                this.logger.error(err);
                throw err;
            });
    };

    GenerateJob.prototype.createEntryFile = function (node, files) {
        this.logger.info('Creating deepforge.py file...');
        files['deepforge.py'] = _.template(Templates.DEEPFORGE)(CONSTANTS);
        return this.getOutputs(node)
            .then(outputs => {
                var name = this.getAttribute(node, 'name'),
                    content = {};

                // inputs and outputs
                content.name = name;
                content.outputs = outputs.map(output => output[0]);

                // Create the deepforge file
            });
    };

    GenerateJob.prototype.createClasses = function (node, files) {
        var metaDict = this.core.getAllMetaNodes(this.rootNode),
            isClass,
            metanodes,
            classNodes,
            inheritanceLvl = {},
            code;

        this.logger.info('Creating custom layer file...');
        metanodes = Object.keys(metaDict).map(id => metaDict[id]);
        isClass = this.getTypeDictFor('Complex', metanodes);

        classNodes = metanodes.filter(node => {
            var base = this.core.getBase(node),
                baseId,
                count = 1;

            // Count the sets back to a class node
            while (base) {
                baseId = this.core.getPath(base);
                if (isClass[baseId]) {
                    inheritanceLvl[this.core.getPath(node)] = count;
                    return true;
                }
                base = this.core.getBase(base);
                count++;
            }

            return false;
        });

        // Get the code definitions for each
        // Sort by levels of inheritance...
        code = classNodes.sort((a, b) => {
            var aId = this.core.getPath(a),
                bId = this.core.getPath(b);

            return inheritanceLvl[aId] > inheritanceLvl[bId];
        }).map(node =>
            // FIXME: update this
            `require './${this.getAttribute(node, 'name')}.py'`
        ).join('\n');

        // Create the class files
        classNodes.forEach(node => {
            var name = this.getAttribute(node, 'name');
            files[`classes/${name}.py`] = this.getAttribute(node, 'code');
        });

        // Create the custom layers file
        files['classes/init.py'] = code;
    };

    GenerateJob.prototype.getTypeDictFor = function (name, metanodes) {
        var isType = {};
        // Get all the custom layers
        for (var i = metanodes.length; i--;) {
            if (this.getAttribute(metanodes[i], 'name') === name) {
                isType[this.core.getPath(metanodes[i])] = true;
            }
        }
        return isType;
    };

    // TODO: update this to nn modules
    GenerateJob.prototype.createCustomLayers = function (node, files) {
        var metaDict = this.core.getAllMetaNodes(this.rootNode),
            isCustomLayer,
            metanodes,
            customLayers,
            code;

        this.logger.info('Creating custom layer file...');
        metanodes = Object.keys(metaDict).map(id => metaDict[id]);
        isCustomLayer = this.getTypeDictFor('CustomLayer', metanodes);

        customLayers = metanodes.filter(node =>
            this.core.getMixinPaths(node).some(id => isCustomLayer[id]));

        // Get the code definitions for each
        code = 'require \'nn\'\n\n' + customLayers
            .map(node => this.getAttribute(node, 'code')).join('\n');

        // Create the custom layers file
        files['custom-layers.py'] = code;
    };

    GenerateJob.prototype.getConnectionContainer = function () {
        var container = this.core.getParent(this.activeNode);

        if (this.isMetaTypeOf(container, this.META.Job)) {
            container = this.core.getParent(container);
        }

        return container;
    };

    GenerateJob.prototype.getInputPortsFor = function (nodeId) {
        var container = this.getConnectionContainer();

        // Get the connections to this node
        return this.core.loadChildren(container)
            .then(children => {
                return children.filter(child =>
                    this.core.getPointerPath(child, 'dst') === nodeId)
                    .map(conn => this.core.getPointerPath(conn, 'src'))[0];
            });
    };

    GenerateJob.prototype.createInputs = function (node, files) {
        var tplContents,
            inputs;

        this.logger.info('Retrieving inputs and deserialize fns...');
        return this.getInputs(node)
            .then(allInputs => {
                // For each input, match the connection with the input name
                //   [ name, type ] => [ name, type, node ]
                //
                // For each input,
                //  - create the deserializer
                //  - put it in inputs/<name>/init.py
                //  - copy the data asset to /inputs/<name>/init.py
                inputs = allInputs
                    .filter(pair => !!this.getAttribute(pair[2], 'data'));  // remove empty inputs

                files['start.js'] = _.template(Templates.START)({
                    CONSTANTS,
                    inputs: inputs.map(pair => pair[0])
                });
                files.inputAssets = {};  // data assets
                return Q.all(inputs.map(pair => {
                    var name = pair[0],
                        node = pair[2],
                        nodeId = this.core.getPath(node);

                    // Get the deserialize function. First, try to get it from
                    // the source method (this guarantees that the correct
                    // deserialize method is used despite any auto-upcasting
                    return this.getInputPortsFor(nodeId)
                        .then(fromNodeId => this.core.loadByPath(this.rootNode, fromNodeId || nodeId))
                        .then(fromNode => {
                            var deserFn,
                                base,
                                className;

                            deserFn = this.getAttribute(fromNode, 'deserialize');

                            if (this.isMetaTypeOf(node, this.META.Complex)) {
                                // Complex objects are expected to define their own
                                // (static) deserialize factory method
                                base = this.core.getMetaType(node);
                                className = this.getAttribute(base, 'name');
                                deserFn = `return ${className}.deserialize(path)`;
                            }

                            return {
                                name: name,
                                code: deserFn
                            };
                        });
                }));
            })
            .then(_tplContents => {
                tplContents = _tplContents;
                inputs.forEach(pair => {
                    var hash = this.getAttribute(pair[2], 'data');
                    files.inputAssets[pair[0]] = hash;
                });

                return files;
            });
    };

    GenerateJob.prototype.createMainFile = function (node, files) {
        this.logger.info('Creating main file...');
        var content = {};
        return this.getInputs(node)
            .then(inputs => {
                var name = this.getAttribute(node, 'name'),
                    code = this.getAttribute(node, 'code'),
                    pointers = this.core.getPointerNames(node).filter(ptr => ptr !== 'base');

                content.name = name;

                // Get input data arguments
                content.inputs = inputs
                    .map(pair => [pair[0], !this.getAttribute(pair[2], 'data')]);  // remove empty inputs

                // Defined variables for each pointers
                content.pointers = pointers
                    .map(id => [id, this.core.getPointerPath(node, id) === null]);

                // Add remaining code
                content.code = code;
                return this.getOutputs(node);
            })
            .then(outputs => {
                content.outputs = outputs.map(output => output[0]);

                files['main.py'] = _.template(Templates.MAIN)(content);
                files['operations.py'] = content.code;

                // Set the line offset
                var lineOffset = 0;
                this.setAttribute(node, CONSTANTS.LINE_OFFSET, lineOffset);
            });
    };

    GenerateJob.prototype.getLineOffset = function (main, snippet) {
        var i = main.indexOf(snippet),
            lines = main.substring(0, i).match(/\n/g);

        return lines ? lines.length : 0;
    };

    GenerateJob.prototype.createAttributeFile = function (node, files) {
        var numOrBool = /^(-?\d+\.?\d*((e|e-)\d+)?|(true|false))$/,
            isBool = /^(true|false)$/,
            table;

        this.logger.info('Creating attributes file...');
        table = '{\n\t' + this.core.getAttributeNames(node)
            .filter(attr => SKIP_ATTRIBUTES.indexOf(attr) === -1)
            .map(name => {
                var value = this.getAttribute(node, name);
                if (!numOrBool.test(value)) {
                    value = `"${value}"`;
                }
                if (isBool.test(value)) {  // Convert to python bool
                    value = value.toString();
                    value = value[0].toUpperCase() + value.slice(1);
                }
                return [`'${name}'`, value];
            })
            .map(pair => pair.join(': '))
            .join(',\n    ') + '\n}';

        files['attributes.py'] = `# attributes of ${this.getAttribute(node, 'name')}\nattributes = ${table}`;
    };

    GenerateJob.prototype.createPointers = function (node, files, cb) {
        var pointers,
            nIds;

        this.logger.info('Creating pointers file...');
        pointers = this.core.getPointerNames(node)
            .filter(name => name !== 'base')
            .filter(id => this.core.getPointerPath(node, id) !== null);

        nIds = pointers.map(p => this.core.getPointerPath(node, p));
        files.ptrAssets = {};
        Q.all(
            nIds.map(nId => this.getPtrCodeHash(nId))
        )
        .then(resultHashes => {
            var name = this.getAttribute(node, 'name');
            this.logger.info(`Pointer generation for ${name} FINISHED!`);
            resultHashes.forEach((hash, index) => {
                files.ptrAssets[`pointers/${pointers[index]}/init.py`] = hash;
            });
            return cb(null, files);
        })
        .fail(e => {
            this.logger.error(`Could not generate pointer files for ${this.getAttribute(node, 'name')}: ${e.toString()}`);
            return cb(e);
        });
    };

    GenerateJob.prototype.getAttribute = function (node, attr) {
        return this.core.getAttribute(node, attr);
    };

    GenerateJob.prototype.setAttribute = function (node, attr, value) {
        return this.core.setAttribute(node, attr, value);
    };

    _.extend(
        GenerateJob.prototype,
        OperationHelpers.prototype,
        PtrCodeGen.prototype
    );

    return GenerateJob;
});
