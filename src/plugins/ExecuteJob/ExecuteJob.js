/*globals define*/
/*jshint node:true, browser:true*/

define([
    'common/storage/constants',
    'text!./metadata.json',
    'executor/ExecutorClient',
    'plugin/PluginBase',
    'deepforge/plugin/LocalExecutor',
    'deepforge/plugin/PtrCodeGen',
    'deepforge/Constants',
    './templates/index',
    'q',
    'underscore'
], function (
    STORAGE_CONSTANTS,
    pluginMetadata,
    ExecutorClient,
    PluginBase,
    LocalExecutor,  // DeepForge operation primitives
    PtrCodeGen,
    CONSTANTS,
    Templates,
    Q,
    _
) {
    'use strict';

    pluginMetadata = JSON.parse(pluginMetadata);

    var OUTPUT_INTERVAL = 1500,
        STDOUT_FILE = 'job_stdout.txt';

    /**
     * Initializes a new instance of ExecuteJob.
     * @class
     * @augments {PluginBase}
     * @classdesc This class represents the plugin ExecuteJob.
     * @constructor
     */
    var ExecuteJob = function () {
        // Call base class' constructor.
        PluginBase.call(this);
        this.pluginMetadata = pluginMetadata;
        this._metadata = {};

        // Metadata updating
        this._markForDeletion = {};  // id -> node
        this._oldMetadataByName = {};  // name -> id
        this.lastAppliedCmd = {};
    };

    /**
     * Metadata associated with the plugin. Contains id, name, version, description, icon, configStructue etc.
     * This is also available at the instance at this.pluginMetadata.
     * @type {object}
     */
    ExecuteJob.metadata = pluginMetadata;
    ExecuteJob.UPDATE_INTERVAL = 1500;

    // Prototypical inheritance from PluginBase.
    ExecuteJob.prototype = Object.create(PluginBase.prototype);
    ExecuteJob.prototype.constructor = ExecuteJob;

    /**
     * Main function for the plugin to execute. This will perform the execution.
     * Notes:
     * - Always log with the provided logger.[error,warning,info,debug].
     * - Do NOT put any user interaction logic UI, etc. inside this method.
     * - callback always has to be called even if error happened.
     *
     * @param {function(string, plugin.PluginResult)} callback - the result callback
     */
    ExecuteJob.prototype.main = function (callback) {
        // Check the activeNode to make sure it is a valid node
        var type = this.core.getMetaType(this.activeNode),
            typeName = type && this.core.getAttribute(type, 'name');

        if (typeName !== 'Job') {
            return callback(`Cannot execute ${typeName} (expected Job)`, this.result);
        }

        this._callback = callback;
        this.currentForkName = null;
        this.prepare()
            .then(() => this.executeJob(this.activeNode));
    };

    ExecuteJob.prototype.updateForkName = function (basename) {
        basename = basename + '_fork';
        basename = basename.replace(/[- ]/g, '_');
        return this.project.getBranches().then(branches => {
            var names = Object.keys(branches),
                name = basename,
                i = 2;

            while (names.indexOf(name) !== -1) {
                name = basename + '_' + i;
                i++;
            }

            this.forkName = name;
        });
    };

    // Override 'save' to notify the user on fork
    ExecuteJob.prototype.save = function (msg) {
        var name = this.core.getAttribute(this.activeNode, 'name');
        return this.updateForkName(name)
            .then(() => PluginBase.prototype.save.call(this, msg))
            .then(result => {
                var msg;
                if (result.status === STORAGE_CONSTANTS.FORKED) {
                    msg = `"${name}" execution has forked to "${result.forkName}"`;
                    this.currentForkName = result.forkName;
                    this.sendNotification(msg);
                }
            });
    };

    ExecuteJob.prototype.getConnections = function (nodes) {
        var conns = [];
        for (var i = nodes.length; i--;) {
            if (this.core.getPointerPath(nodes[i], 'src') &&
                this.core.getPointerPath(nodes[i], 'dst')) {

                conns.push(nodes[i]);
            }
        }
        return conns;
    };

    ExecuteJob.prototype.prepare = function () {
        var dstPortId,
            srcPortId,
            conns,
            executionNode = this.core.getParent(this.activeNode);

        this.pipelineName = this.core.getAttribute(executionNode, 'name');
        return this.core.loadSubTree(executionNode)
            .then(nodes => {
                this.inputPortsFor = {};
                this.outputLineCount = {};

                conns = this.getConnections(nodes);

                // Create inputPortsFor for the given input ports
                for (var i = conns.length; i--;) {
                    dstPortId = this.core.getPointerPath(conns[i], 'dst');
                    srcPortId = this.core.getPointerPath(conns[i], 'src');

                    if (!this.inputPortsFor[dstPortId]) {
                        this.inputPortsFor[dstPortId] = [srcPortId];
                    } else {
                        this.inputPortsFor[dstPortId].push(srcPortId);
                    }
                }
            })
            .then(() => this.recordOldMetadata(this.activeNode));
    };

    ExecuteJob.prototype.recordOldMetadata = function (job) {
        var nodeId = this.core.getPath(job),
            name,
            id,
            idsToDelete = [],
            type,
            base,
            child;

        this.lastAppliedCmd[nodeId] = 0;
        this._oldMetadataByName[nodeId] = {};
        this._markForDeletion[nodeId] = {};
        return this.core.loadChildren(job)
            .then(jobChildren => {
                // Remove any metadata nodes
                for (var i = jobChildren.length; i--;) {
                    child = jobChildren[i];
                    if (this.isMetaTypeOf(child, this.META.Metadata)) {
                        id = this.core.getPath(child);
                        name = this.core.getAttribute(child, 'name');
                        base = this.core.getBase(child);
                        type = this.core.getAttribute(base, 'name');

                        this._markForDeletion[nodeId][id] = child;
                        // namespace by metadata type
                        if (!this._oldMetadataByName[nodeId][type]) {
                            this._oldMetadataByName[nodeId][type] = {};
                        }

                        this._oldMetadataByName[nodeId][type][name] = id;

                        // children of metadata nodes get deleted
                        idsToDelete = idsToDelete
                            .concat(this.core.getChildrenPaths(child));
                    }
                }

                // make the deletion ids relative to the job node
                idsToDelete = idsToDelete.map(id => id.replace(nodeId, ''));
                return Q.all(idsToDelete.map(id => this.core.loadByPath(job, id)));
            })
            .then(nodes => nodes.forEach(node => this.core.deleteNode(node)));
    };

    ExecuteJob.prototype.clearOldMetadata = function (job) {
        var nodeId = this.core.getPath(job),
            nodeIds = Object.keys(this._markForDeletion[nodeId]);

        for (var i = nodeIds.length; i--;) {
            this.core.deleteNode(this._markForDeletion[nodeId][nodeIds[i]]);
        }
        delete this.lastAppliedCmd[nodeId];
        delete this._markForDeletion[nodeId];
    };

    ExecuteJob.prototype.onOperationFail =
    ExecuteJob.prototype.onOperationComplete =
    ExecuteJob.prototype.onComplete = function (opNode, err) {
        var job = this.core.getParent(opNode),
            exec = this.core.getParent(job),
            name = this.core.getAttribute(job, 'name'),
            jobId = this.core.getPath(job),
            status = err ? 'fail' : 'success',
            msg = err ? `${name} execution failed: ${err}` :
                `${name} executed successfully!`,
            promise = Q();

        this.core.setAttribute(job, 'status', status);
        this.logger.info(`Setting ${name} (${jobId}) status to ${status}`);
        this.clearOldMetadata(job);

        if (this.currentForkName) {
            // notify client that the job has completed
            this.sendNotification(`"${name}" execution completed on branch "${this.currentForkName}"`);
        }
        if (err) {
            this.core.setAttribute(exec, 'status', 'failed');
        } else {
            // Check if all the other jobs are successful. If so, set the
            // execution status to 'success'
            promise = this.core.loadChildren(exec)
                .then(nodes => {
                    var execSuccess = true,
                        type,
                        typeName;

                    for (var i = nodes.length; i--;) {
                        type = this.core.getMetaType(nodes[i]);
                        typeName = this.core.getAttribute(type, 'name');

                        if (typeName === 'Job' &&
                            this.core.getAttribute(nodes[i], 'status') !== 'success') {
                            execSuccess = false;
                        }
                    }

                    if (execSuccess) {
                        this.core.setAttribute(exec, 'status', 'success');
                    }
                });
        }

        promise
            .then(() => this.save(msg))
            .then(() => {
                this.result.setSuccess(!err);
                this._callback(err, this.result);
            })
            .catch(err => {
                // Result success is false at invocation.
                this._callback(err, this.result);
            });
    };

    ExecuteJob.prototype.getOperation = function (job) {
        return this.core.loadChildren(job).then(children =>
            children.find(child => this.isMetaTypeOf(child, this.META.Operation)));
    };

    ExecuteJob.prototype.executeJob = function (job) {
        return this.getOperation(job).then(node => {
            var jobId = this.core.getPath(job),
                name = this.core.getAttribute(node, 'name'),
                localTypeId = this.getLocalOperationType(node),
                artifact,
                artifactName,
                files,
                data = {},
                inputs;

            // Execute any special operation types here - not on an executor
            this.logger.debug(`Executing operation "${name}"`);
            if (localTypeId !== null) {
                return this.executeLocalOperation(localTypeId, node);
            } else {
                // Generate all execution files
                return this.createOperationFiles(node).then(results => {
                    this.logger.info('Created operation files!');
                    files = results;
                    artifactName = `${name}_${jobId.replace(/\//g, '_')}-execution-files`;
                    artifact = this.blobClient.createArtifact(artifactName);

                    // Add the input assets
                    //   - get the metadata (name)
                    //   - add the given inputs
                    inputs = Object.keys(files.inputAssets);

                    return Q.all(
                        inputs.map(input => {  // Get the metadata for each input
                            var hash = files.inputAssets[input];

                            // data asset for "input"
                            return this.blobClient.getMetadata(hash);
                        })
                    );
                })
                .then(mds => {
                    // get (input, filename) tuples
                    mds.forEach((metadata, i) => {
                        // add the hashes for each input
                        var input = inputs[i], 
                            name = metadata.name,
                            hash = files.inputAssets[input];

                        data['inputs/' + input + '/' + name] = hash;
                    });

                    delete files.inputAssets;

                    // Add pointer assets
                    Object.keys(files.ptrAssets)
                        .forEach(path => data[path] = files.ptrAssets[path]);

                    delete files.ptrAssets;

                    // Add the executor config
                    return this.getOutputs(node);
                })
                .then(outputArgs => {
                    var config,
                        outputs,
                        file;

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
                            resultPatterns: []
                        }
                    );

                    config = {
                        cmd: 'node',
                        args: ['start.js'],
                        outputInterval: OUTPUT_INTERVAL,
                        resultArtifacts: outputs
                    };
                    files['executor_config.json'] = JSON.stringify(config, null, 4);
                    files['start.js'] = _.template(Templates.START)(CONSTANTS);

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
                    this.logger.info(`Saved execution files "${artifactName}"`);
                    this.result.addArtifact(hash);  // Probably only need this for debugging...
                    this.executeDistOperation(job, node, hash);
                })
                .fail(e => {
                    this.onOperationFail(node, `Distributed operation "${name}" failed ${e}`);
                });
            }
        });
    };

    ExecuteJob.prototype.executeDistOperation = function (job, opNode, hash) {
        var name = this.core.getAttribute(opNode, 'name'),
            jobId = this.core.getPath(job),
            isHttps = typeof window === 'undefined' ? false :
                window.location.protocol !== 'http:',
            executor = new ExecutorClient({
                logger: this.logger,
                serverPort: this.gmeConfig.server.port,
                httpsecure: isHttps
            });

        this.logger.info(`Executing operation "${name}"`);

        this.outputLineCount[jobId] = 0;
        // Set the job status to 'running'
        this.core.setAttribute(job, 'status', 'queued');
        this.core.setAttribute(job, 'stdout', '');
        this.logger.info(`Setting ${jobId} status to "queued" (${this.currentHash})`);
        this.logger.debug(`Making a commit from ${this.currentHash}`);
        this.save(`Queued "${name}" operation in ${this.pipelineName}`)
            .then(() => executor.createJob({hash}))
            .then(() => this.watchOperation(executor, hash, opNode, job))
            .catch(err => this.logger.error(`Could not execute "${name}": ${err}`));

    };

    ExecuteJob.prototype.createOperationFiles = function (node) {
        var files = {};
        // For each operation, generate the output files:
        //   inputs/<arg-name>/init.lua  (respective data deserializer)
        //   pointers/<name>/init.lua  (result of running the main plugin on pointer target - may need a rename)
        //   outputs/<name>/  (make dirs for each of the outputs)
        //   outputs/init.lua  (serializers for data outputs)
        //
        //   attributes.lua (returns lua table of operation attributes)
        //   init.lua (main file -> calls main and serializes outputs)
        //   <name>.lua (entry point -> calls main operation code)

        // add the given files
        this.logger.info('About to create dist execution files');
        return this.createEntryFile(node, files)
            .then(() => this.createClasses(node, files))
            .then(() => this.createCustomLayers(node, files))
            .then(() => this.createInputs(node, files))
            .then(() => this.createOutputs(node, files))
            .then(() => this.createMainFile(node, files))
            .then(() => {
                this.createAttributeFile(node, files);
                return Q.ninvoke(this, 'createPointers', node, files);
            });
    };

    ExecuteJob.prototype.createEntryFile = function (node, files) {
        this.logger.info('Creating entry files...');
        return this.getOutputs(node)
            .then(outputs => {
                var name = this.core.getAttribute(node, 'name'),
                    content = {};

                // inputs and outputs
                content.name = name;
                content.outputs = outputs;

                files['init.lua'] = _.template(Templates.ENTRY)(content);

                // Create the deepforge file
                files['deepforge.lua'] = _.template(Templates.DEEPFORGE)(CONSTANTS);
            });
    };

    ExecuteJob.prototype.createClasses = function (node, files) {
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
                baseId = this.core.getPath(base),
                count = 1;

            // Count the sets back to a class node
            while (base) {
                if (isClass[baseId]) {
                    inheritanceLvl[this.core.getPath(node)] = count;
                    return true;
                }
                base = this.core.getBase(base);
                baseId = this.core.getPath(base);
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
            `require './${this.core.getAttribute(node, 'name')}.lua'`
        ).join('\n');

        // Create the class files
        classNodes.forEach(node => {
            var name = this.core.getAttribute(node, 'name');
            files[`classes/${name}.lua`] = this.core.getAttribute(node, 'code');
        });

        // Create the custom layers file
        files['classes/init.lua'] = code;
    };

    ExecuteJob.prototype.getTypeDictFor = function (name, metanodes) {
        var isType = {};
        // Get all the custom layers
        for (var i = metanodes.length; i--;) {
            if (this.core.getAttribute(metanodes[i], 'name') === name) {
                isType[this.core.getPath(metanodes[i])] = true;
            }
        }
        return isType;
    };

    ExecuteJob.prototype.createCustomLayers = function (node, files) {
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
            .map(node => this.core.getAttribute(node, 'code')).join('\n');

        // Create the custom layers file
        files['custom-layers.lua'] = code;
    };

    ExecuteJob.prototype.createInputs = function (node, files) {
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
                //  - put it in inputs/<name>/init.lua
                //  - copy the data asset to /inputs/<name>/init.lua
                inputs = allInputs
                    .filter(pair => !!this.core.getAttribute(pair[2], 'data'));  // remove empty inputs

                files.inputAssets = {};  // data assets
                return Q.all(inputs.map(pair => {
                    var name = pair[0],
                        node = pair[2],
                        nodeId = this.core.getPath(node),
                        fromNodeId;

                    // Get the deserialize function. First, try to get it from
                    // the source method (this guarantees that the correct
                    // deserialize method is used despite any auto-upcasting
                    fromNodeId = this.inputPortsFor[nodeId][0] || nodeId;

                    return this.core.loadByPath(this.rootNode, fromNodeId)
                        .then(fromNode => {
                            var deserFn,
                                base,
                                className;

                            deserFn = this.core.getAttribute(fromNode, 'deserialize');

                            if (this.isMetaTypeOf(node, this.META.Complex)) {
                                // Complex objects are expected to define their own
                                // (static) deserialize factory method
                                base = this.core.getMetaType(node);
                                className = this.core.getAttribute(base, 'name');
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
                var hashes = inputs
                    // storing the hash for now...
                    .map(pair =>
                        files.inputAssets[pair[0]] = this.core.getAttribute(pair[2], 'data')
                    );
                return Q.all(hashes.map(h => this.blobClient.getMetadata(h)));
            })
            .then(metadatas => {
                // Create the deserializer
                tplContents.forEach((ctnt, i) => {
                    // Get the name of the given asset
                    ctnt.filename = metadatas[i].name;
                    files['inputs/' + ctnt.name + '/init.lua'] = _.template(Templates.DESERIALIZE)(ctnt);
                });
                return files;
            });
    };

    ExecuteJob.prototype.createOutputs = function (node, files) {
        // For each of the output types, grab their serialization functions and
        // create the `outputs/init.lua` file
        this.logger.info('Creating outputs/init.lua...');
        return this.getOutputs(node)
            .then(outputs => {
                var outputTypes = outputs
                // Get the serialize functions for each
                    .map(tuple => {
                        var node = tuple[2],
                            serFn = this.core.getAttribute(node, 'serialize');

                        if (this.isMetaTypeOf(node, this.META.Complex)) {
                            // Complex objects are expected to define their own
                            // serialize methods
                            serFn = 'if data ~= nil then data:serialize(path) end';
                        }

                        return [tuple[1], serFn];
                    });

                files['outputs/init.lua'] = _.template(Templates.SERIALIZE)({types: outputTypes});
            });
    };

    ExecuteJob.prototype.createMainFile = function (node, files) {
        this.logger.info('Creating main file...');
        return this.getInputs(node)
            .then(inputs => {
                var name = this.core.getAttribute(node, 'name'),
                    code = this.core.getAttribute(node, 'code'),
                    pointers = this.core.getPointerNames(node).filter(ptr => ptr !== 'base'),
                    content = {
                        name: name
                    };

                // Get input data arguments
                content.inputs = inputs
                    .map(pair => [pair[0], !this.core.getAttribute(pair[2], 'data')]);  // remove empty inputs

                // Defined variables for each pointers
                content.pointers = pointers
                    .map(id => [id, this.core.getPointerPath(node, id) === null]);

                // Add remaining code
                content.code = code;

                files['main.lua'] = _.template(Templates.MAIN)(content);

                // Set the line offset
                var lineOffset = this.getLineOffset(files['main.lua'], code);
                this.core.setAttribute(node, CONSTANTS.LINE_OFFSET, lineOffset);
            });
    };

    ExecuteJob.prototype.getLineOffset = function (main, snippet) {
        var i = main.indexOf(snippet),
            lines = main.substring(0, i).match(/\n/g);

        return lines ? lines.length : 0;
    };

    ExecuteJob.prototype.createAttributeFile = function (node, files) {
        var skip = ['code'],
            numRegex = /^\d+\.?\d*((e|e-)\d+)?$/,
            table;

        this.logger.info('Creating attributes file...');
        table = '{\n\t' + this.core.getAttributeNames(node)
            .filter(attr => skip.indexOf(attr) === -1)
            .map(name => {
                var value = this.core.getAttribute(node, name);
                if (!numRegex.test(value)) {
                    value = `"${value}"`;
                }
                return [name, value];
            })
            .map(pair => pair.join(' = '))
            .join(',\n\t') + '\n}';

        files['attributes.lua'] = `-- attributes of ${this.core.getAttribute(node, 'name')}\nreturn ${table}`;
    };

    ExecuteJob.prototype.createPointers = function (node, files, cb) {
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
            var name = this.core.getAttribute(node, 'name');
            this.logger.info(`Pointer generation for ${name} FINISHED!`);
            resultHashes.forEach((hash, index) => {
                files.ptrAssets[`pointers/${pointers[index]}/init.lua`] = hash;
            });
            return cb(null, files);
        })
        .fail(e => {
            this.logger.error(`Could not generate pointer files for ${this.core.getAttribute(node, 'name')}: ${e.toString()}`);
            return cb(e);
        });
    };

    ExecuteJob.prototype.watchOperation = function (executor, hash, op, job) {
        var jobId = this.core.getPath(job),
            opId = this.core.getPath(op),
            info,
            name;

        return executor.getInfo(hash)
            .then(_info => {  // Update the job's stdout
                var actualLine,  // on executing job
                    currentLine = this.outputLineCount[jobId];

                info = _info;
                actualLine = info.outputNumber;
                if (actualLine !== null && actualLine >= currentLine) {
                    this.outputLineCount[jobId] = actualLine + 1;
                    return executor.getOutput(hash, currentLine, actualLine+1)
                        .then(outputLines => {
                            var stdout = this.core.getAttribute(job, 'stdout'),
                                output = outputLines.map(o => o.output).join(''),
                                jobName = this.core.getAttribute(job, 'name');

                            // parse deepforge commands
                            output = this.parseForMetadataCmds(job, output);

                            if (output) {
                                stdout += output;
                                this.core.setAttribute(job, 'stdout', stdout);
                                return this.save(`Received stdout for ${jobName}`);
                            }
                        });
                }
            })
            .then(() => {
                if (info.status === 'CREATED' || info.status === 'RUNNING') {
                    if (info.status === 'RUNNING' &&
                        this.core.getAttribute(job, 'status') !== 'running') {

                        name = this.core.getAttribute(job, 'name');
                        this.core.setAttribute(job, 'status', 'running');
                        this.save(`Started "${name}" operation in ${this.pipelineName}`);
                    }

                    setTimeout(
                        this.watchOperation.bind(this, executor, hash, op, job),
                        ExecuteJob.UPDATE_INTERVAL
                    );
                    return;
                }

                name = this.core.getAttribute(job, 'name');
                this.core.setAttribute(job, 'execFiles', info.resultHashes[name + '-all-files']);
                return this.blobClient.getArtifact(info.resultHashes.stdout)
                    .then(artifact => {
                        var stdoutHash = artifact.descriptor.content[STDOUT_FILE].content;
                        return this.blobClient.getObjectAsString(stdoutHash);
                    })
                    .then(stdout => {
                        // Parse the remaining code
                        stdout = this.parseForMetadataCmds(job, stdout, true);
                        this.core.setAttribute(job, 'stdout', stdout);
                        if (info.status !== 'SUCCESS') {
                            // Download all files
                            this.result.addArtifact(info.resultHashes[name + '-all-files']);
                            // Set the job to failed! Store the error
                            this.onOperationFail(op, `Operation "${opId}" failed! ${JSON.stringify(info)}`); 
                        } else {
                            this.onDistOperationComplete(op, info);
                        }
                    });
            })
            .catch(err => this.logger.error(`Could not get op info for ${opId}: ${err}`));
    };

    ExecuteJob.prototype.onDistOperationComplete = function (node, result) {
        var nodeId = this.core.getPath(node),
            outputMap = {},
            outputs;

        // Match the output names to the actual nodes
        // Create an array of [name, node]
        // For now, just match by type. Later we may use ports for input/outputs
        // Store the results in the outgoing ports
        this.getOutputs(node)
            .then(outputPorts => {
                outputs = outputPorts.map(tuple => [tuple[0], tuple[2]]);
                outputs.forEach(output => outputMap[output[0]] = output[1]);

                // this should not be in directories -> flatten the data!
                return Q.all(outputs.map(tuple =>  // [ name, node ]
                    this.blobClient.getArtifact(result.resultHashes[tuple[0]])
                ));
            })
            .then(artifacts => {
                this.logger.info(`preparing outputs -> retrieved ${artifacts.length} objects`);
                // Create new metadata for each
                artifacts.forEach((artifact, i) => {
                    var name = outputs[i][0],
                        outputData = artifact.descriptor.content[`outputs/${name}`],
                        hash = outputData && outputData.content;

                    if (hash) {
                        this.core.setAttribute(outputMap[name], 'data', hash);
                        this.logger.info(`Setting ${nodeId} data to ${hash}`);
                    }
                });

                return this.onOperationComplete(node);
            })
            .fail(e => this.onOperationFail(node, `Operation ${nodeId} failed: ${e}`));
    };

    ExecuteJob.prototype.getOutputs = function (node) {
        return this.getOperationData(node, this.META.Outputs);
    };

    ExecuteJob.prototype.getInputs = function (node) {
        return this.getOperationData(node, this.META.Inputs);
    };

    ExecuteJob.prototype.getOperationData = function (node, metaType) {
        // Load the children and the output's children
        return this.core.loadChildren(node)
            .then(containers => {
                var outputs = containers.find(c => this.core.isTypeOf(c, metaType));
                return outputs ? this.core.loadChildren(outputs) : [];
            })
            .then(outputs => {
                var bases = outputs.map(node => this.core.getMetaType(node));
                // return [[arg1, Type1, node1], [arg2, Type2, node2]]
                return outputs.map((node, i) => [
                    this.core.getAttribute(node, 'name'),
                    this.core.getAttribute(bases[i], 'name'),
                    node
                ]);
            });
    };

    //////////////////////////// Special Operations ////////////////////////////
    ExecuteJob.prototype.executeLocalOperation = function (type, node) {
        // Retrieve the given LOCAL_OP type
        if (!this[type]) {
            this.logger.error(`No local operation handler for ${type}`);
        }
        this.logger.info(`Running local operation ${type}`);

        return this[type](node);
    };

    _.extend(
        ExecuteJob.prototype,
        PtrCodeGen.prototype,
        LocalExecutor.prototype
    );

    //////////////////////////// Metadata ////////////////////////////
    ExecuteJob.prototype.parseForMetadataCmds = function (job, text, skip) {
        var jobId = this.core.getPath(job),
            lines = text.split('\n'),
            args,
            result = [],
            cmdCnt = 0,
            ansiRegex = /\[\d+(;\d+)?m/g,
            cmd;

        for (var i = 0; i < lines.length; i++) {
            // Check for a deepforge command
            if (lines[i].indexOf(CONSTANTS.START_CMD) !== -1) {
                lines[i] = lines[i].replace(ansiRegex, '');
                cmdCnt++;
                args = lines[i].split(/\s+/);
                args.shift();
                cmd = args[0];
                args[0] = job;
                if (this[cmd] && (!skip || cmdCnt >= this.lastAppliedCmd[jobId])) {
                    this[cmd].apply(this, args);
                    this.lastAppliedCmd[jobId]++;
                } else if (!this[cmd]) {
                    this.logger.error(`Invoked unimplemented metadata method "${cmd}"`);
                }
            } else {
                result.push(lines[i]);
            }
        }
        return result.join('\n');
    };

    ExecuteJob.prototype[CONSTANTS.GRAPH_CREATE] = function (job, id) {
        var graph,
            name = Array.prototype.slice.call(arguments, 2).join(' '),
            jobId = this.core.getPath(job);

        id = jobId + '/' + id;
        this.logger.info(`Creating graph ${id} named ${name}`);

        // Check if the graph already exists
        graph = this._getExistingMetadata(jobId, 'Graph', name);
        if (!graph) {
            graph = this.core.createNode({
                base: this.META.Graph,
                parent: job
            });

            if (name) {
                this.core.setAttribute(graph, 'name', name);
            }
        }

        this._metadata[id] = graph;
    };

    ExecuteJob.prototype[CONSTANTS.GRAPH_PLOT] = function (job, id, x, y) {
        var jobId = this.core.getPath(job),
            nonNum = /[^\d\.]*/g,
            graph,
            points;
            

        id = jobId + '/' + id;
        this.logger.info(`Adding point ${x}, ${y} to ${id}`);
        graph = this._metadata[id];
        if (!graph) {
            this.logger.warn(`Can't add point to non-existent graph: ${id}`);
            return;
        }

        // Clean the points by removing and special characters
        x = x.replace(nonNum, '');
        y = y.replace(nonNum, '');
        points = this.core.getAttribute(graph, 'points');
        points += `${x},${y};`;
        this.core.setAttribute(graph, 'points', points);
    };

    ExecuteJob.prototype[CONSTANTS.GRAPH_CREATE_LINE] = function (job, graphId, id) {
        var jobId = this.core.getPath(job),
            graph = this._metadata[jobId + '/' + graphId],
            name = Array.prototype.slice.call(arguments, 3).join(' '),
            line;

        // Create a 'line' node in the given Graph metadata node
        name = name.replace(/\s+$/, '');
        line = this.core.createNode({
            base: this.META.Line,
            parent: graph
        });
        this.core.setAttribute(line, 'name', name);
        this._metadata[jobId + '/' + id] = line;
    };

    ExecuteJob.prototype[CONSTANTS.IMAGE] = function (job, hash) {
        var jobId = this.core.getPath(job),
            name = Array.prototype.slice.call(arguments, 2).join(' '),
            id = jobId + '/IMAGE/' + name,
            imageNode = this._metadata[id];  // Look for the metadata imageNode

        id = jobId + '/' + id;
        this.logger.info(`Creating graph ${id} named ${name}`);

        if (!imageNode) {

            // Check if the imageNode already exists
            imageNode = this._getExistingMetadata(jobId, 'Image', name);
            if (!imageNode) {
                imageNode = this.core.createNode({
                    base: this.META.Image,
                    parent: job
                });
                this.core.setAttribute(imageNode, 'name', name);
            }
            this._metadata[id] = imageNode;
        }

        this.core.setAttribute(imageNode, 'data', hash);
    };

    ExecuteJob.prototype._getExistingMetadata = function (jobId, type, name) {
        var oldMetadata = this._oldMetadataByName[jobId] &&
            this._oldMetadataByName[jobId][type],
            node,
            id;

        if (oldMetadata && oldMetadata[name]) {
            id = oldMetadata[name];
            node = this._markForDeletion[jobId][id];
            delete this._markForDeletion[jobId][id];
        }

        return node || null;
    };

    return ExecuteJob;
});
