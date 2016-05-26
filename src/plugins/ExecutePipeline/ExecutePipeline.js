/*globals define, WebGMEGlobal*/
/*jshint node:true, browser:true, esversion: 6*/

define([
    'plugin/CreateExecution/CreateExecution/CreateExecution',
    'common/core/constants',
    'q',
    'text!./metadata.json',
    './Templates',
    './LocalExecutor',
    'executor/ExecutorClient',
    'jszip',
    'underscore'
], function (
    CreateExecution,
    CONSTANTS,
    Q,
    pluginMetadata,
    Templates,
    LocalExecutor,  // DeepForge operation primitives
    ExecutorClient,
    JsZip,
    _
) {
    'use strict';

    pluginMetadata = JSON.parse(pluginMetadata);
    /**
     * Initializes a new instance of ExecutePipeline.
     * @class
     * @augments {CreateExecution}
     * @classdesc This class represents the plugin ExecutePipeline.
     * @constructor
     */
    var ExecutePipeline = function () {
        // Call base class' constructor.
        CreateExecution.call(this);
        this.pluginMetadata = pluginMetadata;

        // Cache
        this.nodes = {};

        // Record keeping for running operations
        this.opFor = {};
        this.incomingCounts = {};
        this.outputsOf = {};
        this.inputPortsFor = {};
        this.inputs = {};

        this.finished = {};
        this.completedCount = 0;
        this.totalCount = 0;
    };

    /**
     * Metadata associated with the plugin. Contains id, name, version, description, icon, configStructue etc.
     * This is also available at the instance at this.pluginMetadata.
     * @type {object}
     */
    ExecutePipeline.metadata = pluginMetadata;
    ExecutePipeline.UPDATE_INTERVAL = 1500;

    // Prototypical inheritance from CreateExecution.
    ExecutePipeline.prototype = Object.create(CreateExecution.prototype);
    ExecutePipeline.prototype.constructor = ExecutePipeline;

    /**
     * Main function for the plugin to execute. This will perform the execution.
     * Notes:
     * - Always log with the provided logger.[error,warning,info,debug].
     * - Do NOT put any user interaction logic UI, etc. inside this method.
     * - callback always has to be called even if error happened.
     *
     * @param {function(string, plugin.PluginResult)} callback - the result callback
     */
    ExecutePipeline.prototype.main = function (callback) {
        // This will probably need to execute the operations, too, because the
        // inputs for the next operation cannot be created until the inputs have
        // been generated

        var startPromise;
        if (this.core.isTypeOf(this.activeNode, this.META.Pipeline)) {
            // If starting with a pipeline, we will create an Execution first
            startPromise = this.createExecution(this.activeNode)
                .then(execNode => {
                    this.activeNode = execNode;
                    return this.core.loadSubTree(this.activeNode);
                });
        } else if (this.core.isTypeOf(this.activeNode, this.META.Execution)) {
            startPromise = this.core.loadSubTree(this.activeNode);
        } else {
            return callback('Current node is not a Pipeline or Execution!', this.result);
        }

        // Set debug and the final callback
        this.debug = this.getCurrentConfig().debug;
        this._callback = callback;

        startPromise.then(subtree => {
            var children = subtree
                .filter(n => this.core.getParent(n) === this.activeNode);

            this.buildCache(subtree);
            this.parsePipeline(children);  // record deps, etc

            if (this.getCurrentConfig().reset) {
                this.clearResults();
            }

            // Execute the operations in the proper order
            this.executePipeline();
        })
        .fail(e => this.logger.error(e));
    };

    ExecutePipeline.prototype.clearResults = function () {
        // Clear the pipeline's results
        this.logger.info('Clearing all intermediate execution results');
        Object.keys(this.nodes).map(nodeId => this.nodes[nodeId])
            .filter(node =>  // get all connections
                !(this.core.getPointerPath(node, 'src') && this.core.getPointerPath(node, 'dst'))
            )
        // FIXME: this need to be updated
        .forEach(conn => this.core.delAttribute(conn, 'data'));
    };

    //////////////////////////// Operation Preparation/Execution ////////////////////////////
    ExecutePipeline.prototype.buildCache = function (nodes) {
        // Cache all nodes
        // Do I need to cache the data inputs? TODO
        // Probably not - I should be able to look them up as needed
        nodes.forEach(node => this.nodes[this.core.getPath(node)] = node);
    };

    // For each child, we need to organize them by the number of incoming connections
    // AND the corresponding incoming connections. When a connection's src is
    // given data, all the operations using that data can be decremented.
    // If the remaining incoming connection count is zero for an operation,
    // execute the given operation
    ExecutePipeline.prototype.parsePipeline = function (nodes) {
        var conns,
            nodeId,
            srcPortId,
            dstPortId,
            i;

        this.completedCount = 0;

        // Get all connections
        conns = nodes.filter(node =>
            this.core.getPointerPath(node, 'src') && this.core.getPointerPath(node, 'dst')
        );

        // Get all operations
        nodes
            .filter(node => conns.indexOf(node) === -1)
            .forEach(node => {
                var nodeId = this.core.getPath(node);
                this.incomingCounts[nodeId] = 0;
                this.finished[nodeId] = false;
                this.inputs[nodeId] = [];

                this.totalCount++;
            });

        // Store the operations by their...
        //    - incoming conns (srcPortId => [ops]) (for updating which nodes come next)
        for (i = conns.length; i--;) {
            dstPortId = this.core.getPointerPath(conns[i], 'dst');
            nodeId = this.getSiblingIdContaining(dstPortId);

            srcPortId = this.core.getPointerPath(conns[i], 'src');
            if (!this.opFor[srcPortId]) {
                this.opFor[srcPortId] = [nodeId];
            } else {
                this.opFor[srcPortId].push(nodeId);
            }

            //    - incoming counts
            this.incomingCounts[nodeId]++;
            this.inputs[nodeId].push(srcPortId);
            if (!this.inputPortsFor[dstPortId]) {
                this.inputPortsFor[dstPortId] = [srcPortId];
            } else {
                this.inputPortsFor[dstPortId].push(srcPortId);
            }
        }

        //    - output conns
        for (i = conns.length; i--;) {
            srcPortId = this.core.getPointerPath(conns[i], 'src');
            nodeId = this.getSiblingIdContaining(srcPortId);

            dstPortId = this.core.getPointerPath(conns[i], 'dst');
            if (!this.outputsOf[nodeId]) {
                this.outputsOf[nodeId] = [dstPortId];
            } else {
                this.outputsOf[nodeId].push(dstPortId);
            }
        }
    };

    ExecutePipeline.prototype.getSiblingIdContaining = function (nodeId) {
        var parentId = this.core.getPath(this.activeNode) + CONSTANTS.PATH_SEP,
            relid = nodeId.replace(parentId, '');

        return parentId + relid.split(CONSTANTS.PATH_SEP).shift();
    };

    ExecutePipeline.prototype.executePipeline = function() {
        this.logger.debug('starting pipeline');
        this.executeReadyOperations();
    };

    ExecutePipeline.prototype.onPipelineComplete = function(err) {
        var name = this.core.getAttribute(this.activeNode, 'name');
        this.logger.debug(`Pipeline "${name}" complete!`);

        this.save('Pipeline execution finished')
            .then(() => {
                this.result.setSuccess(!err);
                this._callback(err || null, this.result);
            })
            .fail(e => this.logger.error(e));
    };

    ExecutePipeline.prototype.executeReadyOperations = function () {
        // Get all operations with incomingCount === 0
        var operations = Object.keys(this.incomingCounts),
            readyOps = operations.filter(name => this.incomingCounts[name] === 0);

        this.logger.info(`About to execute ${readyOps.length} operations`);
        // Execute all ready operations
        readyOps.forEach(jobId => {
            delete this.incomingCounts[jobId];
            this.executeOperation(jobId);
        });
        return readyOps.length;
    };

    ExecutePipeline.prototype.getOperation = function (jobId) {
        var node = this.nodes[jobId],
            children = this.core.getChildrenPaths(node).map(id => this.nodes[id]);

        // Currently, jobs
        return children.find(child => this.isMetaTypeOf(child, this.META.Operation));
    };

    ExecutePipeline.prototype.executeOperation = function (jobId) {
        var node = this.getOperation(jobId),
            name = this.core.getAttribute(node, 'name'),
            localTypeId = this.getLocalOpType(node),
            artifact,
            artifactName,
            files,
            data = {},
            inputs;

        // Execute any special operation types here - not on an executor
        if (localTypeId !== null) {
            this.executeLocalOperation(localTypeId, node);
        } else {
            // Generate all execution files
            this.createOperationFiles(node).then(results => {
                files = results;
                artifactName = jobId.replace(/\//g, '_') + '-execution-files';
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
                    args = ['init.lua'],
                    outputs;

                outputs = outputArgs.map(pair => pair[0])
                    .map(name => {
                        return {
                            name: name,
                            resultPatterns: [`outputs/${name}/**`]
                        };
                    });

                if (this.debug) {
                    args.push('#' + Date.now());
                    outputs.push({
                        name: name + '-all-files',
                        resultPatterns: []
                    });
                }

                config = {
                    cmd: 'th',
                    args: args,
                    resultArtifacts: outputs
                };
                files['executor_config.json'] = JSON.stringify(config, null, 4);

                // Save the artifact
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
                this.executeDistOperation(node, hash);
            })
            .fail(e =>
                this.onPipelineComplete(`Distributed operation "${name}" failed ${e}`)
            );
        }
    };

    ExecutePipeline.prototype.executeDistOperation = function (node, hash) {
        var name = this.core.getAttribute(node, 'name'),
            nodeId = this.core.getPath(node),
            executor = new ExecutorClient({
                logger: this.logger,
                serverPort: this.gmeConfig.server.port
            });

        this.logger.info(`Executing operation "${name}"`);

        // Run the operation on an executor
        executor.createJob({hash})
            .then(() => this.watchOperation(executor, hash, nodeId))
            .catch(err => this.logger.error(`Could not execute "${name}": ${err}`));

    };

    ExecutePipeline.prototype.watchOperation = function (executor, hash, nodeId) {
        var name;

        return executor.getInfo(hash)
            .then(info => {
                if (info.status === 'CREATED' || info.status === 'RUNNING') {
                    setTimeout(
                        this.watchOperation.bind(this, executor, hash, nodeId),
                        ExecutePipeline.UPDATE_INTERVAL
                    );
                    return;
                }

                if (info.status !== 'SUCCESS') {
                    name = this.core.getAttribute(this.nodes[nodeId], 'name');
                    // Download all files
                    this.result.addArtifact(info.resultHashes[name + '-all-files']);
                    this.onPipelineComplete(`Operation "${nodeId}" failed! ${JSON.stringify(info)}`);  // Failed
                } else {
                    name = this.core.getAttribute(this.nodes[nodeId], 'name');
                    if (this.debug) {
                        this.result.addArtifact(info.resultHashes[name + '-all-files']);
                    }
                    this.onDistOperationComplete(nodeId, info);
                }
            })
            .catch(err => this.logger.error(`Could not get op info for ${nodeId}: ${err}`));
    };

    ExecutePipeline.prototype.onDistOperationComplete = function (nodeId, result) {
        var node = this.nodes[nodeId],
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

                // FIXME: this should not be in directories -> flatten the data!
                // Ideally, this would be performed on the worker -> not on DeepForge
                // get the files from the hash
                return Q.all(outputs.map(tuple =>  // [ name, node ]
                    this.blobClient.getObject(result.resultHashes[tuple[0]])
                ));
            })
            .then(objects => {
                this.logger.info(`preparing outputs -> retrieved ${objects.length} objects`);
                return Q.all(
                    objects.map(object => {
                        var output = new JsZip();
                        return output.load(object);
                    })
                );
            })
            .then(zipfiles => {
                return Q.all(
                    zipfiles.map((zip, index) => {
                        var pair = outputs[index],
                            name = pair[0],
                            artifact = this.blobClient.createArtifact(name),
                            files = {};

                        // move the files from /outputs/<name> to /
                        Object.keys(zip.files)
                            .forEach(filename => {
                                var newName = filename.replace('outputs/' + name + '/', '');
                                files[newName] = zip.files[filename].asArrayBuffer();
                            });

                        // save artifact and get the new hash
                        var filenames = Object.keys(files),
                            savePromise;

                        if (filenames.length > 1) {
                            savePromise = artifact.addFiles(files)
                                .then(() => artifact.save());
                        } else {  // only one file - don't zip it!
                            savePromise = this.blobClient.putFile(filenames[0], files[filenames[0]]);
                        }
                        return savePromise.then(hash => {
                            // store the new hash in the given output node
                            this.logger.debug(`Storing dist results of ${nodeId}` +
                                ` : setting ${this.core.getPath(outputMap[name])} to ${hash}`);
                            this.core.setAttribute(outputMap[name], 'data', hash);
                        });
                    })
                );
            })
            .then(() => this.onOperationComplete(node))
            .fail(e => this.onPipelineComplete(`Operation ${nodeId} failed: ${e}`));
    };

    ExecutePipeline.prototype.onOperationComplete = function (opNode) {
        var name = this.core.getAttribute(opNode, 'name'),
            nextPortIds = this.getOperationOutputIds(opNode),
            resultPorts,
            hasReadyOps;


        // Transport the data from the outputs to any connected inputs
        //   - Get all the connections from each outputId
        //   - Get the corresponding dst outputs
        //   - Use these new ids for checking 'hasReadyOps'
        resultPorts = nextPortIds.map(id => this.inputPortsFor[id])
            .reduce((l1, l2) => l1.concat(l2), []);

        resultPorts.map((id, i) => [this.nodes[id], this.nodes[nextPortIds[i]]])
            .forEach(pair => {  // [ resultPort, nextPort ]
                var result = pair[0],
                    next = pair[1],
                    hash = this.core.getAttribute(result, 'data');
                
                this.logger.info(`forwarding data (${hash}) from ${this.core.getPath(result)} ` +
                    `to ${this.core.getPath(next)}`);
                this.core.setAttribute(next, 'data', hash);
            });

        // For all the nextPortIds, decrement the corresponding operation's incoming counts
        hasReadyOps = resultPorts.map(id => this.opFor[id])
            .reduce((l1, l2) => l1.concat(l2), [])

            // decrement the incoming counts for each operation id
            .map(opId => --this.incomingCounts[opId])
            .indexOf(0) > -1;

        this.completedCount++;
        this.logger.info(`Operation "${name}" completed. ` + 
            `${this.totalCount - this.completedCount} remaining.`);
        if (hasReadyOps) {
            this.executeReadyOperations();
        } else if (this.completedCount === this.totalCount) {
            this.onPipelineComplete();
        }
    };

    ExecutePipeline.prototype.getOperationOutputIds = function(node) {
        var jobId = this.getSiblingIdContaining(this.core.getPath(node));

        return this.outputsOf[jobId] || [];
    };

    ExecutePipeline.prototype.getOperationOutputs = function(node) {
        return this.getOperationOutputIds(node).map(id => this.nodes[id]);
    };

    //////////////////////////// Operation File/Dir Creators ////////////////////////////
    ExecutePipeline.prototype.createOperationFiles = function (node) {
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
        return this.createEntryFile(node, files)
            .then(() => this.createInputs(node, files))
            .then(() => this.createOutputs(node, files))
            .then(() => this.createMainFile(node, files))
            .then(() => {
                this.createAttributeFile(node, files);
                return Q.ninvoke(this, 'createPointers', node, files);
            });
    };

    ExecutePipeline.prototype.createInputs = function (node, files) {
        return this.getInputs(node)
            .then(inputs => {
                // For each input, match the connection with the input name
                //   [ name, type ] => [ name, type, node ]
                if (inputs.length > 1) {
                    this.logger.warn('multiple inputs not yet fully supported!');
                }

                // For each input,
                //  - create the deserializer
                //  - put it in inputs/<name>/init.lua
                //  - copy the data asset to /inputs/<name>/init.lua
                files.inputAssets = {};  // data assets
                inputs.forEach(pair => {
                    var name = pair[0],
                        type = pair[1],
                        node = pair[2],
                        content;

                    // Create the deserializer
                    content = {
                        name: name,
                        code: this.core.getAttribute(this.META[type], 'deserialize')
                    };
                    files['inputs/' + name + '/init.lua'] = _.template(Templates.DESERIALIZE)(content);

                    // copy the data asset to /inputs/<name>/

                    // For more complex examples, I will have to unpack the artifact
                    // TODO

                    // storing the hash for now...
                    files.inputAssets[name] = this.core.getAttribute(node, 'data');
                });
            });
    };

    ExecutePipeline.prototype.createPointers = function (node, files, cb) {
        var pointers = this.core.getPointerNames(node).filter(name => name !== 'base'),
            nIds = pointers.map(p => this.core.getPointerPath(node, p));

        files.ptrAssets = {};
        Q.all(
            nIds.map(nId => this.core.loadByPath(this.rootNode, nId))
        )
        .then(nodes => {

            var executePlugin = function(pluginName, config, callback) {
                // Call the Interpreter manager in a Q.ninvoke friendly way
                // FIXME: I need to create a custom context for the given plugin:
                //     - Set the activeNode to the given referenced node
                //     - If the activeNode is namespaced, set META to the given namespace
                //
                // FIXXME: Update this to the webgme 2.x method name
                WebGMEGlobal.InterpreterManager.run(pluginName, config, result => {
                    if (!result.success) {
                        return callback(result.getError());
                    }
                    this.logger.info('Finished calling ' + pluginName);
                    callback(null, result.artifacts);
                });
            };
                
            return Q.all(
                nodes.map(ptrNode => {
                    // Look up the plugin to use
                    var pluginName = this.core.getRegistry(ptrNode, 'validPlugins').split(' ').shift();
                    this.logger.info(`generating code for ${this.core.getAttribute(ptrNode, 'name')} using ${pluginName}`);

                    // Add plugin config?
                    // TODO
                    var pluginConfig = {
                        activeNode: this.core.getPath(ptrNode)
                    };

                    // Load and run the plugin
                    return Q.nfcall(executePlugin, pluginName, pluginConfig);
                })
            );
        })
        .then(resultHashes => {
            var name = this.core.getAttribute(node, 'name');
            this.logger.info(`Pointer generation for ${name} FINISHED!`);
            resultHashes.forEach((hashes, index) => {
                // Grab the first asset for now
                // FIXME
                files.ptrAssets[`pointers/${pointers[index]}/init.lua`] = hashes[0];
            });
            return cb(null, files);

            // For each hash:
            //   - retrieve the zip archive
            //   - get the generated files for the plugin
            //     - if only one file, rename it to `init.lua`
            //return Q.all(
                //resultHashes.map(hash => this.blobClient.getObjectAsString(hash))
            //);
        })
        // Add support for zip files
        // TODO
        //.then(objects =>
            //Q.all(objects.map(object => {
                    //var output = new JsZip();

                    //return output.load(object);
                //})
            //)
        //)
        //.then(zipfiles => {  // TODO
            //// If it generates one artifact, rename it to `init.lua`. Otherwise, expect
            //// an `init.lua` file
            //// TODO
            //console.log('zipfiles:', zipfiles);
            //cb(null, files);
        //})
        .fail(e => {
            this.logger.error(`Could not generate pointer files for ${this.core.getAttribute(node, 'name')}: ${JSON.stringify(e)}`);
            return cb(e);
        });
    };

    ExecutePipeline.prototype.createOutputs = function (node, files) {
        // For each of the output types, grab their serialization functions and
        // create the `outputs/init.lua` file
        return this.getOutputs(node)
            .then(outputs => {
                var outputTypes = outputs.map(pair => pair[1])
                // Get the serialize functions for each
                    .map(type => [type, this.core.getAttribute(this.META[type], 'serialize')]);

                // Remove duplicates
                // TODO

                files['outputs/init.lua'] = _.template(Templates.SERIALIZE)({types: outputTypes});
            });
    };

    ExecutePipeline.prototype.getOutputs = function (node) {
        return this.getOperationData(node, this.META.Outputs);
    };

    ExecutePipeline.prototype.getInputs = function (node) {
        return this.getOperationData(node, this.META.Inputs);
    };

    ExecutePipeline.prototype.getOperationData = function (node, metaType) {
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

    ExecutePipeline.prototype.createEntryFile = function (node, files) {
        return this.getOutputs(node)
            .then(outputs => {
                var name = this.core.getAttribute(node, 'name'),
                    content = {};

                // sort the outputs by the return values?
                if (outputs.length > 1) {
                    this.logger.error('Multiple outputs not yet supported!');
                }

                // inputs and outputs
                content.name = name;
                content.outputs = outputs;

                files['init.lua'] = _.template(Templates.ENTRY)(content);
            });
    };

    ExecutePipeline.prototype.createMainFile = function (node, files) {
        return this.getInputs(node)
            .then(inputs => {
                var name = this.core.getAttribute(node, 'name'),
                    code = this.core.getAttribute(node, 'code'),
                    pointers = this.core.getPointerNames(node).filter(ptr => ptr !== 'base'),
                    content = {
                        name: name
                    };

                // Get input data arguments
                content.inputs = inputs;

                // Defined variables for each pointers
                content.pointers = pointers;

                // Add remaining code
                content.code = code;

                files['main.lua'] = _.template(Templates.MAIN)(content);
            });
    };

    ExecutePipeline.prototype.createAttributeFile = function (node, files) {
        var skip = ['outputs', 'inputs'],
            table;

        table = '{\n\t' + this.core.getAttributeNames(node)
            .filter(attr => skip.indexOf(attr) === -1)
            .map(name => [name, JSON.stringify(this.core.getAttribute(node, name))])
            .map(pair => pair.join(' = '))
            .join(',\n\t') + '\n}';

        files['attributes.lua'] = `-- attributes of ${this.core.getAttribute(node, 'name')}\nreturn ${table}`;
    };

    //////////////////////////// Special Operations ////////////////////////////
    ExecutePipeline.prototype.getLocalOpType = function (node) {
        var type;
        for (var i = LocalExecutor.TYPES.length; i--;) {
            type = LocalExecutor.TYPES[i];
            if (!this.META[type]) {
                this.logger.warn(`Missing local operation: ${type}`);
                continue;
            }
            if (this.isMetaTypeOf(node, this.META[type])) {
                return type;
            }
        }
        return null;
    };

    ExecutePipeline.prototype.executeLocalOperation = function (type, node) {
        // Retrieve the given LOCAL_OP type
        if (!this[type]) {
            this.logger.error(`No local operation handler for ${type}`);
        }
        this.logger.info(`Running local operation ${type}`);

        return this[type](node);
    };

    _.extend(ExecutePipeline.prototype, LocalExecutor.prototype);

    return ExecutePipeline;
});
