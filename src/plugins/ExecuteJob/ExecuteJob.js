/*globals define*/
/*jshint node:true, browser:true*/

define([
    'common/util/assert',
    'text!./metadata.json',
    'executor/ExecutorClient',
    'plugin/PluginBase',
    'deepforge/ExecutionEnv',
    'deepforge/plugin/LocalExecutor',
    'deepforge/plugin/PtrCodeGen',
    'deepforge/plugin/Operation',
    'deepforge/api/JobLogsClient',
    'deepforge/api/JobOriginClient',
    'deepforge/api/ExecPulseClient',
    './ExecuteJob.Metadata',
    './ExecuteJob.SafeSave',
    'deepforge/Constants',
    'deepforge/utils',
    'q',
    'superagent',
    'underscore'
], function (
    assert,
    pluginMetadata,
    ExecutorClient,
    PluginBase,
    ExecutionEnv,
    LocalExecutor,  // DeepForge operation primitives
    PtrCodeGen,
    OperationPlugin,
    JobLogsClient,
    JobOriginClient,
    ExecPulseClient,

    ExecuteJobMetadata,
    ExecuteJobSafeSave,

    CONSTANTS,
    utils,
    Q,
    superagent,
    _
) {
    'use strict';

    pluginMetadata = JSON.parse(pluginMetadata);

    var STDOUT_FILE = 'job_stdout.txt';

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
        ExecuteJobSafeSave.call(this);
        ExecuteJobMetadata.call(this);
        this.pluginMetadata = pluginMetadata;
        this._beating = null;

        // Metadata updating
        this.lastAppliedCmd = {};
        this.canceled = false;

        this.changes = {};
        this.currentChanges = {};  // read-only changes being applied
        this.creations = {};
        this.deletions = [];
        this.createIdToMetadataId = {};
        this.logManager = null;
    };

    /**
     * Metadata associated with the plugin. Contains id, name, version, description, icon, configStructue etc.
     * This is also available at the instance at this.pluginMetadata.
     * @type {object}
     */
    ExecuteJob.metadata = pluginMetadata;
    ExecuteJob.UPDATE_INTERVAL = 1500;
    ExecuteJob.HEARTBEAT_INTERVAL = 2500;

    // Prototypical inheritance from PluginBase.
    ExecuteJob.prototype = Object.create(PluginBase.prototype);
    ExecuteJob.prototype.constructor = ExecuteJob;

    ExecuteJob.prototype.configure = function () {
        var result = PluginBase.prototype.configure.apply(this, arguments),
            params = {
                logger: this.logger,
                port: this.gmeConfig.server.port,
                branchName: this.branchName,
                projectId: this.projectId
            },
            isHttps = typeof window === 'undefined' ? false :
                window.location.protocol !== 'http:';

        this.logManager = new JobLogsClient(params);
        this.originManager = new JobOriginClient(params);
        this.pulseClient = new ExecPulseClient(params);

        this.executor = new ExecutorClient({
            logger: this.logger,
            serverPort: this.gmeConfig.server.port,
            httpsecure: isHttps
        });
        return result;
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
    ExecuteJob.prototype.main = function (callback) {
        // Check the activeNode to make sure it is a valid node
        var type = this.core.getMetaType(this.activeNode),
            typeName = type && this.getAttribute(type, 'name'),
            execNode,
            status;

        if (typeName !== 'Job') {
            return callback(`Cannot execute ${typeName} (expected Job)`, this.result);
        }

        // Set the parent execution to 'running'
        execNode = this.core.getParent(this.activeNode);
        status = this.getAttribute(execNode, 'status');
        if (status !== 'running') {
            this.setAttribute(execNode, 'status', 'running');
        }

        this._callback = callback;
        this.currentForkName = null;
        this.forkNameBase = this.getAttribute(this.activeNode, 'name');
        this.checkExecutionEnv()
            .then(() => this.isResuming(this.activeNode))
            .then(resuming => {
                this._resumed = resuming;
                return this.prepare(resuming);
            })
            .then(() => {
                if (this._resumed) {
                    this.currentRunId = this.getAttribute(this.activeNode, 'jobId');
                    this.startExecHeartBeat();
                    if (this.canResumeJob(this.activeNode)) {
                        return this.resumeJob(this.activeNode);
                    } else {
                        var name = this.getAttribute(this.activeNode, 'name'),
                            id = this.core.getPath(this.activeNode),
                            msg = `Cannot resume ${name} (${id}). Missing jobId.`;

                        this.logger.error(msg);
                        return callback(msg);
                    }
                } else {
                    this.currentRunId = null;  // will be set after exec files created
                    return this.executeJob(this.activeNode);
                }
            })
            .catch(err => this._callback(err, this.result));
    };

    ExecuteJob.prototype.checkExecutionEnv = function () {
        // Throw an exception if no resources
        this.logger.info(`Checking execution environment`);
        return ExecutionEnv.getWorkers()
            .then(workers => {
                if (workers.length === 0) {
                    this.logger.info(`Cannot execute job(s): No connected workers`);
                    throw new Error('No connected workers');
                }
            });
    };

    ExecuteJob.prototype.isResuming = function (job) {
        job = job || this.activeNode;
        var deferred = Q.defer(),
            status = this.getAttribute(job, 'status'),
            jobId;

        if (status === 'running') {
            jobId = this.getAttribute(job, 'jobId');
            // Check if on the origin branch
            this.originManager.getOrigin(jobId)
                .then(origin => {
                    if (this.branchName === origin.branch) {
                        // Check if plugin is no longer running
                        return this.pulseClient.check(jobId)
                            .then(alive => {
                                deferred.resolve(alive !== CONSTANTS.PULSE.ALIVE);
                            });
                    } else {
                        deferred.resolve(false);
                    }
                });
        } else {
            deferred.resolve(false);
        }
        return deferred.promise;
    };

    ExecuteJob.prototype.canResumeJob = function (job) {
        return !!this.getAttribute(job, 'jobId');
    };

    ExecuteJob.prototype.resumeJob = function (job) {
        var hash = this.getAttribute(job, 'jobId'),
            name = this.getAttribute(job, 'name'),
            id = this.core.getPath(job),
            msg;

        this.logger.info(`Resuming job ${name} (${id})`);

        return this.logManager.getMetadata(id)
            .then(metadata => {
                var count = metadata.lineCount;

                if (count === -1) {
                    this.logger.warn(`No line count found for ${id}. Setting count to 0`);
                    count = 0;
                    return this.logManager.deleteLog(id)
                        .then(() => count);
                }
                return count;
            })
            .then(count => {  // update line count (to inform logClient appendTo)
                this.outputLineCount[id] = count;
                return this.executor.getOutput(hash, 0, count);
            })
            .then(async output => {  // parse the stdout to update the job metadata
                var stdout = output.map(o => o.output).join(''),
                    result = this.processStdout(job, stdout),
                    name = this.getAttribute(job, 'name');

                if (result.hasMetadata) {
                    msg = `Updated graph/image output for ${name}`;
                    await this.save(msg);
                }
                return this.getOperation(job);
            })
            .then(opNode => this.watchOperation(hash, opNode, job));
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

    ExecuteJob.prototype.prepare = function (isResuming) {
        var dstPortId,
            srcPortId,
            conns,
            executionNode = this.core.getParent(this.activeNode);

        this.pipelineName = this.getAttribute(executionNode, 'name');
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
            .then(() => this.recordOldMetadata(this.activeNode, isResuming));
    };

    ExecuteJob.prototype.onOperationCanceled = function(op) {
        var job = this.core.getParent(op),
            name = this.getAttribute(op, 'name'),
            msg = `"${name}" canceled!`;

        this.setAttribute(job, 'status', 'canceled');
        this.resultMsg(msg);
        this.onComplete(op, null);
    };

    ExecuteJob.prototype.onOperationFail =
    ExecuteJob.prototype.onOperationComplete =
    ExecuteJob.prototype.onComplete = async function (opNode, err) {
        var job = this.core.getParent(opNode),
            exec = this.core.getParent(job),
            name = this.getAttribute(job, 'name'),
            jobId = this.core.getPath(job),
            status = err ? 'fail' : (this.canceled ? 'canceled' : 'success'),
            msg = err ? `${name} execution failed!` :
                `${name} executed successfully!`;

        this.setAttribute(job, 'status', status);
        this.logger.info(`Setting ${name} (${jobId}) status to ${status}`);
        this.clearOldMetadata(job);

        if (this.currentForkName) {
            // notify client that the job has completed
            this.sendNotification(`"${name}" execution completed on branch "${this.currentForkName}"`);
        }
        if (err) {
            this.logger.warn(`${name} failed: ${err}`);
            this.setAttribute(exec, 'status', 'failed');
        } else if (this.canceled) {
            // Should I set this to 'canceled'?
            this.setAttribute(exec, 'status', 'canceled');
        } else {
            // Check if all the other jobs are successful. If so, set the
            // execution status to 'success'
            const nodes = await this.core.loadChildren(exec);
            let execSuccess = true;

            for (var i = nodes.length; i--;) {
                const type = this.core.getMetaType(nodes[i]);
                const typeName = this.getAttribute(type, 'name');

                if (typeName === 'Job' &&
                    this.getAttribute(nodes[i], 'status') !== 'success') {
                    execSuccess = false;
                }
            }

            if (execSuccess) {
                this.setAttribute(exec, 'status', 'success');
            }
        }

        this.createMessage(null, msg);
        try {
            await this.save(msg);
            this.result.setSuccess(!err);
            this.stopExecHeartBeat();
            this._callback(err, this.result);
        } catch (e) {
            this._callback(e, this.result);
        }
    };

    ExecuteJob.prototype.getOperation = function (job) {
        return this.core.loadChildren(job).then(children =>
            children.find(child => this.isMetaTypeOf(child, this.META.Operation)));
    };

    // Handle the blob retrieval failed error
    ExecuteJob.prototype.onBlobRetrievalFail = function (node, input) {
        const job = this.core.getParent(node);
        const name = this.getAttribute(job, 'name');
        const e = `Failed to retrieve "${input}" (BLOB_FETCH_FAILED)`;
        let consoleErr = `[0;31mFailed to execute operation: ${e}[0m`;

        consoleErr += [
            '\n\nA couple things to check out:\n',
            '- Has the location of DeepForge\'s blob changed?',
            '    (Configurable using "blob.dir" in the deepforge config' +
            ' or setting the DEEPFORGE_BLOB_DIR environment variable)\n',

            '- Was this project created using a different blob location?'
        ].join('\n    ');

        this.setAttribute(job, 'stdout', consoleErr);
        this.onOperationFail(node, `Blob retrieval failed for "${name}": ${e}`);
    };

    ExecuteJob.prototype.executeJob = function (job) {
        return this.getOperation(job).then(node => {
            var name = this.getAttribute(node, 'name'),
                localTypeId = this.getLocalOperationType(node);

            // Execute any special operation types here - not on an executor
            this.logger.debug(`Executing operation "${name}"`);
            if (localTypeId !== null) {
                return this.executeLocalOperation(localTypeId, node);
            } else {
                // Generate all execution files
                return this.getPtrCodeHash(this.core.getPath(node))
                    .fail(err => {
                        this.logger.error(`Could not generate files: ${err}`);
                        if (err.message.indexOf('BLOB_FETCH_FAILED') > -1) {
                            this.onBlobRetrievalFail(node, err.message.split(':')[1]);
                        }
                        throw err;
                    })
                    .then(hash => {
                        this.logger.info(`Saved execution files`);
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
        var name = this.getAttribute(opNode, 'name'),
            jobId = this.core.getPath(job);

        this.logger.info(`Executing operation "${name}"`);

        this.outputLineCount[jobId] = 0;
        // Set the job status to 'running'
        this.setAttribute(job, 'status', 'queued');
        this.delAttribute(job, 'stdout');
        this.logManager.deleteLog(jobId);
        this.logger.info(`Setting ${jobId} status to "queued" (${this.currentHash})`);
        this.logger.debug(`Making a commit from ${this.currentHash}`);
        this.save(`Queued "${name}" operation in ${this.pipelineName}`)
            .then(() => this.executor.createJob({hash}))
            .then(info => {
                this.setAttribute(job, 'jobId', info.hash);
                if (info.secret) {  // o.w. it is a cached job!
                    this.setAttribute(job, 'secret', info.secret);
                }
                if (!this.currentRunId) {
                    this.currentRunId = info.hash;
                    if (this._beating === null) {
                        this.startExecHeartBeat();
                    }
                }
                return this.recordJobOrigin(hash, job);
            })
            .then(() => this.watchOperation(hash, opNode, job))
            .catch(err => this.logger.error(`Could not execute "${name}": ${err}`));

    };

    ExecuteJob.prototype.recordJobOrigin = function (hash, job) {
        var execNode = this.core.getParent(job),
            info;

        info = {
            hash: hash,
            nodeId: this.core.getPath(job),
            job: this.getAttribute(job, 'name'),
            execution: this.getAttribute(execNode, 'name')
        };
        this.runningJobHashes.push(hash);
        return this.originManager.record(hash, info);
    };


    ExecuteJob.prototype.notifyStdoutUpdate = function (nodeId) {
        this.sendNotification({
            message: `${CONSTANTS.STDOUT_UPDATE}/${nodeId}`,
            toBranch: true
        });
    };

    ExecuteJob.prototype.isExecutionCanceled = function () {
        var execNode = this.core.getParent(this.activeNode);
        return this.getAttribute(execNode, 'status') === 'canceled';
    };

    ExecuteJob.prototype.startExecHeartBeat = function () {
        this._beating = true;
        this.updateExecHeartBeat();
    };

    ExecuteJob.prototype.stopExecHeartBeat = function () {
        this._beating = false;
    };

    ExecuteJob.prototype.updateExecHeartBeat = function () {
        var time = Date.now(),
            next = () => {
                if (this._beating) {
                    setTimeout(this.updateExecHeartBeat.bind(this),
                        ExecuteJob.HEARTBEAT_INTERVAL - (Date.now() - time));
                }
            };

        this.pulseClient.update(this.currentRunId)
            .then(() => next())
            .catch(err => {
                if (err) {
                    this.logger.error(`heartbeat failed: ${err}`);
                    next();
                }
            });
    };

    ExecuteJob.prototype.watchOperation = function (hash, op, job) {
        var jobId = this.core.getPath(job),
            opId = this.core.getPath(op),
            info,
            secret,
            name = this.getAttribute(job, 'name');

        // If canceled, stop the operation
        if (this.canceled || this.isExecutionCanceled()) {
            secret = this.getAttribute(job, 'secret');
            if (secret) {
                this.executor.cancelJob(hash, secret);
                this.delAttribute(job, 'secret');
                this.canceled = true;
                return this.onOperationCanceled(op);
            }
        }

        return this.executor.getInfo(hash)
            .then(_info => {  // Update the job's stdout
                var actualLine,  // on executing job
                    currentLine = this.outputLineCount[jobId],
                    prep = Q();

                info = _info;
                actualLine = info.outputNumber;
                if (actualLine !== null && actualLine >= currentLine) {
                    this.outputLineCount[jobId] = actualLine + 1;
                    return prep
                        .then(() => this.executor.getOutput(hash, currentLine, actualLine+1))
                        .then(async outputLines => {
                            var stdout = this.getAttribute(job, 'stdout'),
                                output = outputLines.map(o => o.output).join(''),
                                last = stdout.lastIndexOf('\n'),
                                result,
                                lastLine,
                                next = Q(),
                                msg;

                            // parse deepforge commands
                            if (last !== -1) {
                                stdout = stdout.substring(0, last+1);
                                lastLine = stdout.substring(last+1);
                                output = lastLine + output;
                            }
                            result = this.processStdout(job, output, true);
                            output = result.stdout;

                            if (output) {
                                // Send notification to all clients watching the branch
                                var metadata = {
                                    lineCount: this.outputLineCount[jobId]
                                };
                                await this.logManager.appendTo(jobId, output, metadata);
                                await this.notifyStdoutUpdate(jobId);
                            }
                            if (result.hasMetadata) {
                                msg = `Updated graph/image output for ${name}`;
                                await this.save(msg);
                            }
                        });
                }
            })
            .then(async () => {
                if (info.status === 'CREATED' || info.status === 'RUNNING') {
                    var time = Date.now(),
                        next = Q();

                    if (info.status === 'RUNNING' &&
                        this.getAttribute(job, 'status') !== 'running') {

                        this.setAttribute(job, 'status', 'running');
                        await this.save(`Started "${name}" operation in ${this.pipelineName}`);
                    }

                    const delta = Date.now() - time;
                        
                    if (delta > ExecuteJob.UPDATE_INTERVAL) {
                        return this.watchOperation(hash, op, job);
                    }

                    return setTimeout(
                        this.watchOperation.bind(this, hash, op, job),
                        ExecuteJob.UPDATE_INTERVAL - delta
                    );
                }

                // Record that the job hash is no longer running
                this.logger.info(`Job "${name}" has finished (${info.status})`);
                var i = this.runningJobHashes.indexOf(hash);
                if (i !== -1) {
                    this.runningJobHashes.splice(i, 1);
                } else {
                    this.logger.warn(`Could not find running job hash ${hash}`);
                }

                if (info.status === 'CANCELED') {
                    // If it was cancelled, the pipeline has been stopped
                    this.logger.debug(`"${name}" has been CANCELED!`);
                    this.canceled = true;
                    return this.logManager.getLog(jobId)
                        .then(stdout => {
                            this.setAttribute(job, 'stdout', stdout);
                            return this.onOperationCanceled(op);
                        });
                }

                if (info.status === 'SUCCESS' || info.status === 'FAILED_TO_EXECUTE') {
                    this.setAttribute(job, 'execFiles', info.resultHashes[name + '-all-files']);
                    return this.blobClient.getArtifact(info.resultHashes.stdout)
                        .then(artifact => {
                            var stdoutHash = artifact.descriptor.content[STDOUT_FILE].content;
                            return this.blobClient.getObjectAsString(stdoutHash);
                        })
                        .then(stdout => {
                            // Parse the remaining code
                            var result = this.processStdout(job, stdout);
                            this.setAttribute(job, 'stdout', result.stdout);
                            this.logManager.deleteLog(jobId);
                            if (info.status !== 'SUCCESS') {
                                const opName = this.getAttribute(op, 'name');
                                // Download all files
                                this.result.addArtifact(info.resultHashes[name + '-all-files']);
                                // Parse the most precise error and present it in the toast...
                                const lastline = result.stdout.split('\n').filter(l => !!l).pop();
                                if (lastline.includes('Error')) {
                                    this.onOperationFail(op, lastline); 
                                } else {
                                    this.onOperationFail(op, `Operation "${opName}" failed!`); 
                                }
                            } else {
                                this.onDistOperationComplete(op, info);
                            }
                        });
                } else {  // something bad happened...
                    var err = `Failed to execute operation "${opId}": ${info.status}`,
                        consoleErr = `[0;31mFailed to execute operation: ${info.status}[0m`;
                    this.setAttribute(job, 'stdout', consoleErr);
                    this.logger.error(err);
                    this.onOperationFail(op, err);
                }
            })
            .catch(err => this.logger.error(`Could not get op info for ${JSON.stringify(opId)}: ${err}`));
    };

    ExecuteJob.prototype.onDistOperationComplete = function (node, result) {
        let nodeId = this.core.getPath(node),
            outputMap = {},
            resultTypes,
            outputs;

        // Match the output names to the actual nodes
        // Create an array of [name, node]
        // For now, just match by type. Later we may use ports for input/outputs
        // Store the results in the outgoing ports
        return this.getResultTypes(result)
            .then(types => {
                resultTypes = types;
                return this.getOutputs(node);
            })
            .then(outputPorts => {
                outputs = outputPorts.map(tuple => [tuple[0], tuple[2]]);
                outputs.forEach(output => outputMap[output[0]] = output[1]);

                // this should not be in directories -> flatten the data!
                let artifacts = outputs.map(tuple => {  // [ name, node ]
                    let [name] = tuple;
                    let hash = result.resultHashes[name];
                    return this.blobClient.getArtifact(hash);
                });

                return Q.all(artifacts);
            })
            .then(artifacts => {
                this.logger.info(`preparing outputs -> retrieved ${artifacts.length} objects`);
                // Create new metadata for each
                artifacts.forEach((artifact, i) => {
                    var name = outputs[i][0],
                        outputData = artifact.descriptor.content[`outputs/${name}`],
                        hash = outputData && outputData.content,
                        dataType = resultTypes[name];

                    if (dataType) {
                        this.setAttribute(outputMap[name], 'type', dataType);
                        this.logger.info(`Setting ${nodeId} data type to ${dataType}`);
                    } else {
                        this.logger.warn(`No data type found for ${nodeId}`);
                    }

                    if (hash) {
                        this.setAttribute(outputMap[name], 'data', hash);
                        this.logger.info(`Setting ${nodeId} data to ${hash}`);
                    }
                });

                return this.onOperationComplete(node);
            })
            .fail(e => this.onOperationFail(node, `Operation ${nodeId} failed: ${e}`));
    };

    ExecuteJob.prototype.getResultTypes = function (result) {
        const hash = result.resultHashes['result-types'];
        return this.blobClient.getArtifact(hash)
            .then(data => {
                const contents = data.descriptor.content;
                const contentHash = contents['result-types.json'].content;
                return this.blobClient.getObjectAsJSON(contentHash);
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
        OperationPlugin.prototype,
        ExecuteJobMetadata.prototype,
        ExecuteJobSafeSave.prototype,
        PtrCodeGen.prototype,
        LocalExecutor.prototype
    );

    ExecuteJob.prototype.processStdout = function (job, text, continued) {
        var lines = text.replace(/\u0000/g, '').split('\n'),
            result = this.parseForMetadataCmds(job, lines, !continued);

        result.stdout = utils.resolveCarriageReturns(result.stdout).join('\n');
        return result;
    };

    return ExecuteJob;
});
