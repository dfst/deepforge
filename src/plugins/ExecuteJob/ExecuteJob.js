/*globals define */
/*jshint node:true, browser:true*/

define([
    'common/util/assert',
    'text!./metadata.json',
    'deepforge/compute/index',
    'plugin/PluginBase',
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
    'underscore',
], function (
    assert,
    pluginMetadata,
    Compute,
    PluginBase,
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
    _,
) {
    'use strict';

    pluginMetadata = JSON.parse(pluginMetadata);

    const STDOUT_FILE = 'job_stdout.txt';

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
        this._running = null;

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

    // TODO: Update plugin metadata for the compute options
    ExecuteJob.metadata = pluginMetadata;
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
            };

        this.logManager = new JobLogsClient(params);
        this.originManager = new JobOriginClient(params);
        this.pulseClient = new ExecPulseClient(params);
        this._execHashToJobNode = {};

        const name = Compute.getAvailableBackends()[0];  // FIXME: enable the user to select one
        const backend = Compute.getBackend(name);
        this.compute = backend.getClient(this.logger);
        this.compute.on(
            'data',
            (id, data) => {
                const job = this.getNodeForJobId(id);
                this.onConsoleOutput(job, data.toString());
            }
        );

        this.compute.on('update', (jobId, status) => {
            try {
                this.onUpdate(jobId, status);
            } catch (err) {
                this.logger.error(`Error when processing operation update: ${err}`);
            }
        });

        this.compute.on('end',
            (id, info) => {
                try {
                    this.onOperationEnd(id);
                } catch (err) {
                    this.logger.error(`Error when processing operation end: ${err}`);
                }
            }
        );

        return result;
    };

    ExecuteJob.prototype.getComponentId = function () {
        return 'ExecuteJob';
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
    ExecuteJob.prototype.main = async function (callback) {
        // Check the activeNode to make sure it is a valid node
        var type = this.core.getMetaType(this.activeNode),
            typeName = type && this.getAttribute(type, 'name'),
            execNode;

        if (typeName !== 'Job') {
            return callback(new Error(`Cannot execute ${typeName} (expected Job)`), this.result);
        }

        // Set the parent execution to 'running'
        execNode = this.core.getParent(this.activeNode);
        this.setAttribute(execNode, 'status', 'running');

        this._callback = callback;
        this.currentForkName = null;
        this.forkNameBase = this.getAttribute(this.activeNode, 'name');
        const isResuming = await this.isResuming(this.activeNode);
        await this.prepare(isResuming);

        if (isResuming) {
            this.startExecHeartBeat();
            if (this.canResumeJob(this.activeNode)) {
                this.currentRunId = this.getJobId(this.activeNode);
                return this.resumeJob(this.activeNode);
            } else {
                var name = this.getAttribute(this.activeNode, 'name'),
                    id = this.core.getPath(this.activeNode),
                    msg = `Cannot resume ${name} (${id}). Missing jobInfo.`;

                this.logger.error(msg);
                return callback(msg);
            }
        } else {
            this.currentRunId = null;  // will be set after exec files created
            return this.executeJob(this.activeNode);
        }
    };

    ExecuteJob.prototype.getJobId = function (node) {
        return JSON.parse(this.getAttribute(node, 'jobInfo')).hash;
    };

    ExecuteJob.prototype.onAbort =
    ExecuteJob.prototype.onUserCancelDetected = function () {
        this.logger.info('Received Abort. Canceling jobs.');
        this.runningJobHashes
            .map(hash => this.getNodeForJobId(hash))
            .map(node => JSON.parse(this.getAttribute(node, 'jobInfo')))
            .forEach(jobInfo => this.compute.cancelJob(jobInfo));
    };

    ExecuteJob.prototype.isResuming = async function (job) {
        job = job || this.activeNode;
        var status = this.getAttribute(job, 'status'),
            jobId;

        if (status === 'running') {
            jobId = this.getJobId(job);
            // Check if on the origin branch
            const origin = await this.originManager.getOrigin(jobId);
            if (this.branchName === origin.branch) {
                // Check if plugin is no longer running
                const alive = await this.pulseClient.check(jobId);
                return alive !== CONSTANTS.PULSE.ALIVE;
            } else {
                return false;
            }
        }

        return false;
    };

    ExecuteJob.prototype.canResumeJob = function (job) {
        return !!this.getAttribute(job, 'jobInfo');
    };

    ExecuteJob.prototype.resumeJob = async function (job) {
        var hash = this.getJobId(job),
            name = this.getAttribute(job, 'name'),
            id = this.core.getPath(job);

        this.logger.info(`Resuming job ${name} (${id})`);

        const metadata = await this.logManager.getMetadata(id);
        let count = metadata.lineCount;

        if (count === -1) {
            this.logger.warn(`No line count found for ${id}. Setting count to 0`);
            count = 0;
            await this.logManager.deleteLog(id);
        }

        this.outputLineCount[id] = count;

        const stdout = await this.compute.getConsoleOutput(hash);
        const result = this.processStdout(job, stdout);

        if (result.hasMetadata) {
            const name = this.getAttribute(job, 'name');
            const msg = `Updated graph/image output for ${name}`;
            await this.save(msg);
        }

        return this.getOperation(job);
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

    ExecuteJob.prototype.prepare = async function (isResuming) {
        const executionNode = this.core.getParent(this.activeNode);
        const nodes = await this.core.loadSubTree(executionNode);

        this.pipelineName = this.getAttribute(executionNode, 'name');
        this.inputPortsFor = {};
        this.outputLineCount = {};

        const conns = this.getConnections(nodes);

        // Create inputPortsFor for the given input ports
        for (var i = conns.length; i--;) {
            const dstPortId = this.core.getPointerPath(conns[i], 'dst');
            const srcPortId = this.core.getPointerPath(conns[i], 'src');

            if (!this.inputPortsFor[dstPortId]) {
                this.inputPortsFor[dstPortId] = [srcPortId];
            } else {
                this.inputPortsFor[dstPortId].push(srcPortId);
            }
        }

        return await this.recordOldMetadata(this.activeNode, isResuming);
    };

    ExecuteJob.prototype.onOperationCanceled = function(op) {
        const job = this.core.getParent(op);
        const name = this.getAttribute(op, 'name');
        const msg = `"${name}" canceled!`;

        this.setAttribute(job, 'status', 'canceled');
        this.resultMsg(msg);
        return this.onComplete(op, null);
    };

    ExecuteJob.prototype.onOperationFail =
    ExecuteJob.prototype.onOperationComplete =
    ExecuteJob.prototype.onComplete = async function (opNode, err) {
        const job = this.core.getParent(opNode);
        const exec = this.core.getParent(job);
        const name = this.getAttribute(job, 'name');
        const jobId = this.core.getPath(job);
        const status = err ? 'fail' : (this.canceled ? 'canceled' : 'success');
        const msg = err ? `${name} execution failed!` :
            `${name} executed successfully!`;

        this.setAttribute(job, 'status', status);
        this.delAttribute(job, 'executionId');
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

    ExecuteJob.prototype.getOperation = async function (job) {
        const children = await this.core.loadChildren(job);
        return children.find(child => this.isMetaTypeOf(child, this.META.Operation));
    };

    ExecuteJob.prototype.executeJob = async function (job) {
        const node = await this.getOperation(job);
        const name = this.getAttribute(node, 'name');

        // Execute any special operation types here - not on an compute
        this.logger.debug(`Executing operation "${name}"`);
        if (this.isLocalOperation(node)) {
            return this.executeLocalOperation(node);
        } else {
            // Generate all execution files
            let hash;
            try {
                hash = await this.getPtrCodeHash(this.core.getPath(node));
            } catch (err) {
                this.logger.error(`Could not generate files: ${err}`);
                if (err.message.indexOf('BLOB_FETCH_FAILED') > -1) {
                    this.onBlobRetrievalFail(node, err.message.split(':')[1]);
                }
                throw err;
            }

            this.logger.info(`Saved execution files`);
            this.result.addArtifact(hash);
            try {
                this.executeDistOperation(job, node, hash);
            } catch (err) {
                this.onOperationFail(node, `Distributed operation "${name}" failed ${err}`);
            }
        }
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

    ExecuteJob.prototype.executeDistOperation = async function (job, opNode, hash) {
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

        try {
            await this.save(`Queued "${name}" operation in ${this.pipelineName}`);
            await this.createJob(job, hash);
        } catch (err) {
            this.logger.error(`Could not execute "${name}": ${err}`);
        }

    };

    ExecuteJob.prototype.createJob = async function (job, hash) {
        // Record the job info for the given hash
        this._execHashToJobNode[hash] = job;
        const jobInfo = await this.compute.createJob(hash);
        this.setAttribute(job, 'jobInfo', JSON.stringify(jobInfo));
        if (!this.currentRunId) {
            this.currentRunId = jobInfo.hash;
        }

        if (this._running === null) {
            this.startExecHeartBeat();
        }

        return await this.recordJobOrigin(jobInfo.hash, job);
    };

    ExecuteJob.prototype.getNodeForJobId = function (hash) {
        return this._execHashToJobNode[hash];
    };

    ExecuteJob.prototype.recordJobOrigin = function (hash, job) {
        const execNode = this.core.getParent(job);

        const info = {
            hash: hash,
            nodeId: this.core.getPath(job),
            job: this.getAttribute(job, 'name'),
            execution: this.getAttribute(execNode, 'name')
        };
        this.runningJobHashes.push(hash);
        return this.originManager.record(hash, info);
    };

    ExecuteJob.prototype.cleanJobHashInfo = function (hash) {
        const i = this.runningJobHashes.indexOf(hash);
        if (i !== -1) {
            this.runningJobHashes.splice(i, 1);
        } else {
            this.logger.warn(`Could not find running job hash ${hash}`);
        }

        delete this._execHashToJobNode[hash];
    };


    ExecuteJob.prototype.notifyStdoutUpdate = function (nodeId) {
        this.sendNotification({
            message: `${CONSTANTS.STDOUT_UPDATE}/${nodeId}`,
            toBranch: true
        });
    };

    ExecuteJob.prototype.isExecutionCanceled = function () {
        const execNode = this.core.getParent(this.activeNode);
        return this.getAttribute(execNode, 'status') === 'canceled';
    };

    ExecuteJob.prototype.startExecHeartBeat = function () {
        this._running = true;
        this.updateExecHeartBeat();
    };

    ExecuteJob.prototype.stopExecHeartBeat = function () {
        this._running = false;
    };

    ExecuteJob.prototype.updateExecHeartBeat = function () {
        var time = Date.now(),
            next = () => {
                if (this._running) {
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

    ExecuteJob.prototype.onUpdate = async function (jobId, status) {
        const job = this.getNodeForJobId(jobId);
        const name = this.getAttribute(job, 'name');

        this.setAttribute(job, 'status', status);
        await this.save(`"${name}" operation in ${this.pipelineName} is now "${status}"`);
    };

    ExecuteJob.prototype.onConsoleOutput = async function (job, output) {
        const jobId = this.core.getPath(job);
        let stdout = this.getAttribute(job, 'stdout');
        let last = stdout.lastIndexOf('\n');
        let lastLine;

        if (last !== -1) {
            stdout = stdout.substring(0, last+1);
            lastLine = stdout.substring(last+1);
            output = lastLine + output;
        }

        const result = this.processStdout(job, output, true);
        output = result.stdout;

        await this.logManager.appendTo(jobId, output);
        // Send notification to all clients watching the branch
        await this.notifyStdoutUpdate(jobId);

        if (result.hasMetadata) {
            const name = this.getAttribute(job, 'name');
            const msg = `Updated graph/image output for ${name}`;
            await this.save(msg);
        }
    };

    ExecuteJob.prototype.onOperationEnd = async function (hash) {
        // Record that the job hash is no longer running
        const job = this.getNodeForJobId(hash);
        const op = await this.getOperation(job);
        const name = this.getAttribute(job, 'name');
        const jobId = this.core.getPath(job);
        const jobInfo = JSON.parse(this.getAttribute(job, 'jobInfo'));

        const status = await this.compute.getStatus(jobInfo);
        this.logger.info(`Job "${name}" has finished (${status})`);
        this.cleanJobHashInfo(hash);

        if (status === this.compute.CANCELED) {
            // If it was canceled, the pipeline has been stopped
            this.logger.debug(`"${name}" has been CANCELED!`);
            this.canceled = true;
            const stdout = await this.logManager.getLog(jobId);
            this.setAttribute(job, 'stdout', stdout);
            return this.onOperationCanceled(op);
        }

        if (status === this.compute.SUCCESS || status === this.compute.FAILED) {
            const fileHashes = await this.compute.getOutputHashes(jobInfo);
            const execFilesHash = fileHashes[name + '-all-files'];
            this.setAttribute(job, 'execFiles', execFilesHash);

            const opName = this.getAttribute(op, 'name');
            const stdoutHash = await this.getContentHashSafe(fileHashes.stdout, STDOUT_FILE, ERROR.NO_STDOUT_FILE);
            const stdout = await this.blobClient.getObjectAsString(stdoutHash);
            const result = this.processStdout(job, stdout);

            // Parse the remaining code
            this.setAttribute(job, 'stdout', result.stdout);
            this.logManager.deleteLog(jobId);
            if (status === this.compute.SUCCESS) {
                this.onDistOperationComplete(op, fileHashes);
            } else {
                // Download all files
                this.result.addArtifact(execFilesHash);
                // Parse the most precise error and present it in the toast...
                const lastline = result.stdout.split('\n').filter(l => !!l).pop() || '';
                if (lastline.includes('Error')) {
                    this.onOperationFail(op, lastline); 
                } else {
                    this.onOperationFail(op, `Operation "${opName}" failed!`); 
                }
            }
        } else {  // something bad happened...
            const err = `Failed to execute operation "${jobId}": ${status}`;
            const consoleErr = `[0;31mFailed to execute operation: ${status}[0m`;

            this.setAttribute(job, 'stdout', consoleErr);
            this.logger.error(err);
            return this.onOperationFail(op, err);
        }
    };

    ExecuteJob.prototype.onDistOperationComplete = async function (node, fileHashes) {
        const opName = this.getAttribute(node, 'name');
        const resultTypes = await this.getResultTypes(fileHashes);
        let nodeId = this.core.getPath(node),
            outputMap = {},
            outputs;


        // Match the output names to the actual nodes
        // Create an array of [name, node]
        // For now, just match by type. Later we may use ports for input/outputs
        // Store the results in the outgoing ports
        return this.getOutputs(node)
            .then(outputPorts => {
                outputs = outputPorts.map(tuple => [tuple[0], tuple[2]]);
                outputs.forEach(output => outputMap[output[0]] = output[1]);

                // this should not be in directories -> flatten the data!
                const hashes = outputs.map(tuple => {  // [ name, node ]
                    let [name] = tuple;
                    let artifactHash = fileHashes[name];
                    return this.getContentHash(artifactHash, `outputs/${name}`);
                });

                return Q.all(hashes);
            })
            .then(hashes => {
                // Create new metadata for each
                hashes.forEach((hash, i) => {
                    var name = outputs[i][0],
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
            .catch(e => this.onOperationFail(node, `"${opName}" failed: ${e}`));
    };

    ExecuteJob.prototype.getResultTypes = async function (fileHashes) {
        const mdHash = fileHashes['result-types'];
        const hash = await this.getContentHashSafe(mdHash, 'result-types.json', ERROR.NO_TYPES_FILE);
        return await this.blobClient.getObjectAsJSON(hash);
    };

    ExecuteJob.prototype.getContentHashSafe = async function (artifactHash, fileName, msg) {
        const hash = await this.getContentHash(artifactHash, fileName);
        if (!hash) {
            throw new Error(msg);
        }
        return hash;
    };

    ExecuteJob.prototype.getContentHash = async function (artifactHash, fileName) {
        const artifact = await this.blobClient.getArtifact(artifactHash);
        const contents = artifact.descriptor.content;

        return contents[fileName] && contents[fileName].content;
    };

    //////////////////////////// Special Operations ////////////////////////////
    ExecuteJob.prototype.executeLocalOperation = function (node) {
        const type = this.getLocalOperationType(node);

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

    const ERROR = {};
    ERROR.NO_STDOUT_FILE = 'Could not find logs in job results.';
    ERROR.NO_TYPES_FILE = 'Metadata about result types not found.';

    return ExecuteJob;
});
