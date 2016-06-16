/*globals define */
/*jshint node:true, browser:true, esversion: 6*/

define([
    'plugin/CreateExecution/CreateExecution/CreateExecution',
    'deepforge/plugin/PtrCodeGen',
    'common/core/constants',
    'q',
    'text!./metadata.json',
    './templates/index',
    './LocalExecutor',
    'executor/ExecutorClient',
    'underscore'
], function (
    CreateExecution,
    PtrCodeGen,
    CONSTANTS,
    Q,
    pluginMetadata,
    Templates,
    LocalExecutor,  // DeepForge operation primitives
    ExecutorClient,
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
    var OUTPUT_INTERVAL = 1500,
        STDOUT_FILE = 'job_stdout.txt';
    var ExecutePipeline = function () {
        // Call base class' constructor.
        CreateExecution.call(this);
        this.pluginMetadata = pluginMetadata;

        this._currentSave = Q();
        this.initRun();
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

    ExecutePipeline.prototype.initRun = function () {
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
        this.outputLineCount = {};
    };

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

        this.initRun();
        this.pipelineName = this.core.getAttribute(this.activeNode, 'name');
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
        this.debug = true;  // this.getCurrentConfig().debug;
        this._callback = callback;

        startPromise.then(subtree => {
            var children = subtree
                .filter(n => this.core.getParent(n) === this.activeNode);

            this.buildCache(subtree);
            this.parsePipeline(children);  // record deps, etc

            return this.clearResults();
        })
        .then(() => this.executePipeline())
        .fail(e => this.logger.error(e));
    };

    // Override 'save' to prevent race conditions while saving
    ExecutePipeline.prototype.save = function (msg) {
        // When 'save'  is called, it should still finish any current save op
        // before continuing
        this._currentSave = this._currentSave
            .then(() => CreateExecution.prototype.save.call(this, msg));

        return this._currentSave;
    };

    ExecutePipeline.prototype.clearResults = function () {
        var nodes = Object.keys(this.nodes).map(id => this.nodes[id]);
        // Clear the pipeline's results
        this.logger.info('Clearing all intermediate execution results');

        nodes.filter(node => this.core.isTypeOf(node, this.META.Data))
            .forEach(conn => this.core.delAttribute(conn, 'data'));

        // Set the status for each job to 'pending'
        nodes.filter(node => this.core.isTypeOf(node, this.META.Job))
            .forEach(node => this.core.setAttribute(node, 'status', 'pending'));

        this.logger.info('Setting all jobs status to "pending"');
        this.logger.debug(`Making a commit from ${this.currentHash}`);
        return this.save(`Initializing ${this.pipelineName} for execution`);
    };

    //////////////////////////// Operation Preparation/Execution ////////////////////////////
    ExecutePipeline.prototype.buildCache = function (nodes) {
        // Cache all nodes
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
        });
        readyOps.reduce((prev, jobId) => {
            return prev.then(() => this.executeOperation(jobId));
        }, Q());
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
        this.logger.debug(`Executing operation "${name}"`);
        if (localTypeId !== null) {
            return this.executeLocalOperation(localTypeId, node);
        } else {
            // Generate all execution files
            return this.createOperationFiles(node).then(results => {
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

                outputs.push({
                    name: 'stdout',
                    resultPatterns: [STDOUT_FILE]
                });

                if (this.debug) {
                    outputs.push({
                        name: name + '-all-files',
                        resultPatterns: []
                    });
                }

                config = {
                    cmd: 'bash',
                    args: ['run.sh'],
                    outputInterval: OUTPUT_INTERVAL,
                    resultArtifacts: outputs
                };
                files['executor_config.json'] = JSON.stringify(config, null, 4);
                files['run.sh'] = Templates.BASH;

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
                this.executeDistOperation(jobId, node, hash);
            })
            .fail(e => {
                this.core.setAttribute(this.nodes[jobId], 'status', 'fail');
                this.logger.info(`Setting ${jobId} status to "fail"`);
                this.onPipelineComplete(`Distributed operation "${name}" failed ${e}`);
            });
        }
    };

    ExecutePipeline.prototype.executeDistOperation = function (jobId, opNode, hash) {
        var name = this.core.getAttribute(opNode, 'name'),
            opId = this.core.getPath(opNode),
            executor = new ExecutorClient({
                logger: this.logger,
                serverPort: this.gmeConfig.server.port
            });

        this.logger.info(`Executing operation "${name}"`);

        this.outputLineCount[jobId] = 0;
        // Set the job status to 'running'
        this.core.setAttribute(this.nodes[jobId], 'status', 'running');
        this.core.setAttribute(this.nodes[jobId], 'stdout', '');
        this.logger.info(`Setting ${jobId} status to "running" (${this.currentHash})`);
        this.logger.debug(`Making a commit from ${this.currentHash}`);
        this.save(`Started "${name}" operation in ${this.pipelineName}`)
            .then(() => executor.createJob({hash}))
            .then(() => this.watchOperation(executor, hash, opId, jobId))
            .catch(err => this.logger.error(`Could not execute "${name}": ${err}`));

    };

    ExecutePipeline.prototype.watchOperation = function (executor, hash, opId, jobId) {
        var job = this.nodes[jobId],
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
                            var job = this.nodes[jobId],
                                stdout = this.core.getAttribute(job, 'stdout'),
                                output = outputLines.map(o => o.output).join(''),
                                jobName = this.core.getAttribute(job, 'name');

                            // Handle the \b
                            // TODO
                            stdout += output;
                            this.core.setAttribute(job, 'stdout', stdout);
                            return this.save(`Received stdout for ${jobName}`);
                        });
                }
            })
            .then(() => {
                if (info.status === 'CREATED' || info.status === 'RUNNING') {
                    setTimeout(
                        this.watchOperation.bind(this, executor, hash, opId, jobId),
                        ExecutePipeline.UPDATE_INTERVAL
                    );
                    return;
                }

                name = this.core.getAttribute(job, 'name');
                this.core.setAttribute(job, 'execFiles', info.resultHashes[name + '-all-files']);
                return this.blobClient.getArtifact(info.resultHashes.stdout);
            })
            .then(artifact => {
                var stdoutHash = artifact.descriptor.content[STDOUT_FILE].content;
                return this.blobClient.getObjectAsString(stdoutHash);
            })
            .then(stdout => {
                this.core.setAttribute(job, 'stdout', stdout);
                if (info.status !== 'SUCCESS') {
                    name = this.core.getAttribute(this.nodes[opId], 'name');
                    // Download all files
                    this.result.addArtifact(info.resultHashes[name + '-all-files']);
                    // Set the job to failed! Store the error
                    this.core.setAttribute(this.nodes[jobId], 'status', 'fail');
                    this.logger.info(`Setting ${jobId} status to "fail"`);
                    this.onPipelineComplete(`Operation "${opId}" failed! ${JSON.stringify(info)}`);  // Failed
                } else {
                    name = this.core.getAttribute(this.nodes[opId], 'name');
                    if (this.debug) {
                        this.result.addArtifact(info.resultHashes[name + '-all-files']);
                    }
                    this.onDistOperationComplete(opId, info);
                }
            })
            .catch(err => this.logger.error(`Could not get op info for ${opId}: ${err}`));
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
                        hash = artifact.descriptor.content[`outputs/${name}`].content;

                    this.core.setAttribute(outputMap[name], 'data', hash);
                    this.logger.info(`Setting ${nodeId} data to ${hash}`);
                });

                return this.onOperationComplete(node);
            })
            .fail(e => this.onPipelineComplete(`Operation ${nodeId} failed: ${e}`));
    };

    ExecutePipeline.prototype.onOperationComplete = function (opNode) {
        var name = this.core.getAttribute(opNode, 'name'),
            nextPortIds = this.getOperationOutputIds(opNode),
            jNode = this.core.getParent(opNode),
            resultPorts,
            jobId = this.core.getPath(jNode),
            hasReadyOps;

        // Set the operation to 'success'!
        this.core.setAttribute(jNode, 'status', 'success');
        this.logger.info(`Setting ${jobId} status to "success"`);
        this.logger.debug(`Making a commit from ${this.currentHash}`);
        this.save(`Operation "${name}" in ${this.pipelineName} completed successfully`)
            .then(() => {

                // Transport the data from the outputs to any connected inputs
                //   - Get all the connections from each outputId
                //   - Get the corresponding dst outputs
                //   - Use these new ids for checking 'hasReadyOps'
                resultPorts = nextPortIds.map(id => this.inputPortsFor[id])
                    .reduce((l1, l2) => l1.concat(l2), []);

                resultPorts
                    .map((id, i) => [this.nodes[id], this.nodes[nextPortIds[i]]])
                    .forEach(pair => {  // [ resultPort, nextPort ]
                        var result = pair[0],
                            next = pair[1],
                            hash = this.core.getAttribute(result, 'data');
                        
                        this.logger.info(`forwarding data (${hash}) from ${this.core.getPath(result)} ` +
                            `to ${this.core.getPath(next)}`);
                        this.core.setAttribute(next, 'data', hash);
                        this.logger.info(`Setting ${jobId} data to ${hash}`);
                    });

                // For all the nextPortIds, decrement the corresponding operation's incoming counts
                hasReadyOps = nextPortIds.map(id => this.getSiblingIdContaining(id))
                    .reduce((l1, l2) => l1.concat(l2), [])

                    // decrement the incoming counts for each operation id
                    .map(opId => --this.incomingCounts[opId])
                    .indexOf(0) > -1;

                this.completedCount++;
                this.logger.debug(`Operation "${name}" completed. ` + 
                    `${this.totalCount - this.completedCount} remaining.`);
                if (hasReadyOps) {
                    this.executeReadyOperations();
                } else if (this.completedCount === this.totalCount) {
                    this.onPipelineComplete();
                }
            });
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
        var tplContents;
        return this.getInputs(node)
            .then(inputs => {
                // For each input, match the connection with the input name
                //   [ name, type ] => [ name, type, node ]
                //
                // For each input,
                //  - create the deserializer
                //  - put it in inputs/<name>/init.lua
                //  - copy the data asset to /inputs/<name>/init.lua
                inputs = inputs
                    .filter(pair => !!this.core.getAttribute(pair[2], 'data'));  // remove empty inputs

                files.inputAssets = {};  // data assets
                tplContents = inputs.map(pair => {
                    var name = pair[0],
                        node = pair[2];

                    return {
                        name: name,
                        code: this.core.getAttribute(node, 'deserialize')
                    };
                });
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

    ExecutePipeline.prototype.createPointers = function (node, files, cb) {
        var pointers,
            nIds;

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
            this.logger.error(`Could not generate pointer files for ${this.core.getAttribute(node, 'name')}: ${JSON.stringify(e)}`);
            return cb(e);
        });
    };

    ExecutePipeline.prototype.createOutputs = function (node, files) {
        // For each of the output types, grab their serialization functions and
        // create the `outputs/init.lua` file
        return this.getOutputs(node)
            .then(outputs => {
                var outputTypes = outputs
                // Get the serialize functions for each
                    .map(tuple => [tuple[1], this.core.getAttribute(tuple[2], 'serialize')]);

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
                content.inputs = inputs
                    .map(pair => [pair[0], !this.core.getAttribute(pair[2], 'data')]);  // remove empty inputs

                // Defined variables for each pointers
                content.pointers = pointers
                    .map(id => [id, this.core.getPointerPath(node, id) === null]);

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

    _.extend(
        ExecutePipeline.prototype,
        LocalExecutor.prototype,
        PtrCodeGen.prototype
    );

    return ExecutePipeline;
});
