/*globals define*/
/*jshint node:true, browser:true*/

define([
    './templates/index',
    'q',
    'underscore',
    'deepforge/Constants',
    'deepforge/plugin/Operation',
    'deepforge/OperationCode',
    'deepforge/plugin/PtrCodeGen',
    'text!./metadata.json',
    'plugin/PluginBase'
], function (
    Templates,
    Q,
    _,
    CONSTANTS,
    OperationHelpers,
    OperationCode,
    PtrCodeGen,
    pluginMetadata,
    PluginBase
) {
    'use strict';

    pluginMetadata = JSON.parse(pluginMetadata);
    const DATA_DIR = 'artifacts/';
    var OUTPUT_INTERVAL = 1500,
        STDOUT_FILE = 'job_stdout.txt';

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
        const name = this.getAttribute(this.activeNode, 'name');
        const opId = this.core.getPath(this.activeNode);

        return this.createExecutableOperationFiles(this.activeNode)
            .then(files => {
                this.logger.info('Created operation files!');
                const artifactName = `${name}_${opId.replace(/\//g, '_')}-execution-files`;
                return this.createArtifact(artifactName, files);
            })
            .then(hash => {
                this.result.setSuccess(true);
                this.result.addArtifact(hash);
                callback(null, this.result);
            })
            .catch(err => {
                this.result.setSuccess(false);
                callback(err, this.result);
            });
    }; 

    GenerateJob.prototype.createArtifact = function (artifactName, files) {
        let artifact = this.blobClient.createArtifact(artifactName);
        const data = files._data;
        delete files._data;

        // Remove empty hashes
        for (let file in data) {
            if (!data[file]) {
                this.logger.warn(`Empty data hash has been found for file "${file}". Removing it...`);
                delete data[file];
            }
        }

        return artifact.addObjectHashes(data)
            .then(() => {
                this.logger.info(`Added data hashes for "${artifactName}"`);
                return artifact.addFiles(files);
            })
            .then(() => {
                this.logger.info(`Added files for "${artifactName}"`);
                return artifact.save();
            });
    };

    GenerateJob.prototype.createRunScript = function (inputs, files={}) {
        let runsh = [
            '# Bash script to download data files and run job',
            'if [ -z "$DEEPFORGE_URL" ]; then',
            '  echo "Please set DEEPFORGE_URL and re-run:"',
            '  echo ""',
            '  echo "  DEEPFORGE_URL=http://my.deepforge.server.com:8080 bash run.sh"',
            '  echo ""',
            '  exit 1',
            'fi',
            'mkdir outputs',
            `mkdir -p ${DATA_DIR}\n`
        ].join('\n');

        inputs.forEach(input => {
            let [dataPath, /* hash */, url] = input;
            // Add to the run.sh file
            runsh += `wget $DEEPFORGE_URL${url} -O ${dataPath}\n`;
        });

        runsh += 'python main.py';
        files['run.sh'] = runsh;
        return runsh;
    };

    GenerateJob.prototype.createDataMetadataFile = function (inputs, metadata, files={}) {
        let inputData = {};

        metadata.forEach((data, i) => {
            // add the hashes for each input
            let [dataPath, hash] = inputs[i];

            inputData[dataPath] = {
                req: hash,
                cache: data.content
            };
        });

        const content = JSON.stringify(inputData, null, 2);
        files['input-data.json'] = content;
        return content;
    };

    GenerateJob.prototype.createExecConfig = function (node, outputNodes, files={}) {
        var outputs,
            fileList,
            ptrFiles = Object.keys(files._data).filter(name => !name.startsWith(DATA_DIR));

        fileList = Object.keys(files).concat(ptrFiles)
            .filter(name => name !== '_data');

        outputs = outputNodes.map(pair => pair[0])
            .map(name => {
                return {
                    name: name,
                    resultPatterns: [`outputs/${name}`]
                };
            });

        const name = this.getAttribute(node, 'name');
        outputs.push(
            {
                name: 'stdout',
                resultPatterns: [STDOUT_FILE]
            },
            {
                name: 'result-types',
                resultPatterns: ['result-types.json']
            },
            {
                name: name + '-all-files',
                resultPatterns: fileList
            }
        );

        const config = JSON.stringify({
            cmd: 'node',
            args: ['start.js'],
            outputInterval: OUTPUT_INTERVAL,
            resultArtifacts: outputs
        }, null, 2);

        files['executor_config.json'] = config;
        return config;
    };

    GenerateJob.prototype.createExecutableOperationFiles = function (node, files={}) {
        let inputs = null;

        return this.createOperationFiles(node, files)
            .then(() => {
                inputs = Object.keys(files._data)
                    .filter(filename => filename.startsWith(DATA_DIR))
                    .map(name => [
                        name,
                        files._data[name],
                        this.blobClient.getRelativeDownloadURL(files._data[name])
                    ]);  // (path, hash, url) tuples

                return this.createRunScript(inputs, files);
            })
            .then(() => {
                const mdPromises = inputs.map(input => {  // Get the metadata for each input
                    let [name, hash] = input;

                    // data asset for "input"
                    return this.blobClient.getMetadata(hash)
                        .catch(() => {
                            throw Error(`BLOB_FETCH_FAILED: ${name}`);
                        });
                });

                return Q.all(mdPromises);
            })
            .then(mds => this.createDataMetadataFile(inputs, mds, files))
            .then(() => this.getOutputs(this.activeNode))
            .then(outputs => this.createExecConfig(node, outputs, files))
            .then(() => files);
    };

    GenerateJob.prototype.createOperationFiles = function (node, files={}) {
        // For each operation, generate the output files:
        //   artifacts/<arg-name>  (respective serialized input data)
        //   outputs/ (make dir for the outputs)
        //
        //   main.py (main file -> calls main and serializes outputs)

        // add the given files
        this.logger.info('About to generate operation execution files');
        return this.createEntryFile(node, files)
            .then(() => this.createInputs(node, files))
            .then(() => this.createMainFile(node, files))
            .then(() => files)
            .fail(err => {
                this.logger.error(err);
                throw err;
            });
    };

    GenerateJob.prototype.createEntryFile = function (node, files) {
        this.logger.info('Creating deepforge.py file...');
        const serializeTpl = _.template(Templates.DEEPFORGE_SERIALIZATION);
        files['deepforge/serialization.py'] = serializeTpl(CONSTANTS);
        files['deepforge/__init__.py'] = Templates.DEEPFORGE_INIT;
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
        files._data = files._data || {};  // data assets

        this.logger.info('Retrieving inputs and deserialize fns...');
        return this.getInputs(node)
            .then(allInputs => {
                // For each input, match the connection with the input name
                //   [ name, type ] => [ name, type, node ]
                //
                // For each input,
                //  - store the data in /inputs/<name>
                let inputs = allInputs
                    .filter(pair => !!this.getAttribute(pair[2], 'data'));  // remove empty inputs

                files['start.js'] = _.template(Templates.START)({
                    CONSTANTS,
                    inputs: inputs.map(pair => pair[0])
                });
                inputs.forEach(pair => {
                    var hash = this.getAttribute(pair[2], 'data');
                    files._data[DATA_DIR + pair[0]] = hash;
                });
                // Add the deepforge matplotlib backend file...
                files['backend_deepforge.py'] = Templates.MATPLOTLIB_BACKEND;

                return files;
            });
    };

    GenerateJob.prototype.createMainFile = function (node, files) {
        this.logger.info('Creating main file...');
        var content = {};
        return this.getInputs(node)
            .then(inputs => {
                var name = this.getAttribute(node, 'name'),
                    code = this.getAttribute(node, 'code');

                content.name = name;

                // Get input data arguments
                content.inputs = inputs
                    .map(pair => [  // [name, type, isNone?]
                        pair[0],
                        this.getAttribute(pair[2], 'type'),
                        !this.getAttribute(pair[2], 'data')
                    ]);  // remove empty inputs

                // Add remaining code
                content.code = code;
                return this.getOutputs(node);
            })
            .then(outputs => {
                content.outputs = outputs.map(output => output[0]);
                content.arguments = this.getOperationArguments(node)
                    .map(arg => arg.value).join(', ');
                return this.getAllInitialCode();
            })
            .then(code => content.initCode = code)
            .then(() => this.getReferencedContent(node))
            .then(references => {
                const filename = GenerateJob.toSnakeCase(content.name);
                content.references = references;
                files['main.py'] = _.template(Templates.MAIN)(content);
                files[`operations/${filename}.py`] = content.code;
                files['operations/__init__.py'] = files['operations/__init__.py'] || '';
                files['operations/__init__.py'] += `from operations.${filename} import ${content.name}\n`;
            });
    };

    GenerateJob.toSnakeCase = function (word) {
        word = word[0].toLowerCase() + word.slice(1);
        return word.replace(/[A-Z]/g, match => `_${match.toLowerCase()}`);
    };

    GenerateJob.prototype.getAllInitialCode = function () {
        // TODO: Get the InitCode's 'code' attribute and then all library code
        return this.core.loadChildren(this.rootNode)
            .then(children => {
                const codeNodes = children.filter(child => this.isMetaTypeOf(child, this.META.Code));
                codeNodes.sort((n1, n2) => {  // move library code to be in the front
                    const v1 = this.isMetaTypeOf(n1, this.META.LibraryCode) ? 1 : 0;
                    const v2 = this.isMetaTypeOf(n2, this.META.LibraryCode) ? 1 : 0;
                    return v2 - v1;
                });

                return codeNodes.map(node => this.core.getAttribute(node, 'code')).join('\n');
            });
    };

    GenerateJob.getAttributeString = function(value) {
        const numOrBool = /^(-?\d+\.?\d*((e|e-)\d+)?|(true|false))$/;
        const isBool = /^(true|false)$/;

        if (!numOrBool.test(value)) {
            value = `"${value}"`;
        }
        if (isBool.test(value)) {  // Convert to python bool
            value = value.toString();
            value = value[0].toUpperCase() + value.slice(1);
        }
        return value;
    };

    GenerateJob.prototype.getOperationArguments = function (node) {
        const code = this.getAttribute(node, 'code');
        const operation = new OperationCode(code);
        const pointers = this.core.getPointerNames(node).filter(name => name !== 'base');

        // Enter the attributes in place
        const argumentValues = operation.getAttributes().map(attr => {
            const name = attr.name;
            const isPointer = pointers.includes(name);
            const arg = {
                name: name,
                isPointer: isPointer,
            };

            // Check if it is a reference... (if so, just return the pointer name)
            if (isPointer) {
                arg.rawValue = this.core.getPointerPath(node, name);
                arg.value = arg.rawValue ? name : 'None';
            } else {  // get the attribute and it's value
                arg.rawValue = this.getAttribute(node, name);
                arg.value = GenerateJob.getAttributeString(arg.rawValue);
            }
            return arg;
        });

        return argumentValues;
    };

    GenerateJob.prototype.getReferencedContent = function (node) {
        this.logger.info('Creating referenced library content...');
        // Convert pointer names to use _ instead of ' '
        const pointers = this.core.getPointerNames(node)
            .filter(name => name !== 'base')
            .filter(id => this.core.getPointerPath(node, id) !== null);

        const targetIds = pointers.map(p => this.core.getPointerPath(node, p));
        const name = this.getAttribute(node, 'name');
        return Q.all(targetIds.map(nId => this.getPtrCode(nId)))
            .then(resultContents => {
                this.logger.info(`Pointer generation for ${name} FINISHED!`);

                const references = resultContents.map((code, index) => {
                    const pointer = pointers[index];
                    return [pointer, code];
                });

                return references;
            })
            .fail(e => {
                this.logger.error(`Could not generate resource files for ${this.getAttribute(node, 'name')}: ${e.toString()}`);
                throw e;
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
