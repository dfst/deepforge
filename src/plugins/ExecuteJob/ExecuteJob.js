/*globals define */
/*jshint node:true, browser:true*/

define([
    'common/util/assert',
    'text!./metadata.json',
    'deepforge/compute/index',
    'deepforge/storage/index',
    'plugin/TwoPhaseCommit/TwoPhaseCommit/TwoPhaseCommit',
    'deepforge/plugin/LocalExecutor',
    'deepforge/plugin/PtrCodeGen',
    'deepforge/plugin/Operation',
    'deepforge/plugin/ExecutionHelpers',
    'deepforge/api/JobLogsClient',
    'deepforge/api/JobOriginClient',
    'deepforge/api/ExecPulseClient',
    './ExecuteJob.Metadata',
    'deepforge/Constants',
    'deepforge/utils',
    'q',
    'superagent',
    'underscore',
], function (
    assert,
    pluginMetadata,
    Compute,
    Storage,
    PluginBase,
    LocalExecutor,  // DeepForge operation primitives
    PtrCodeGen,
    OperationPlugin,
    ExecutionHelpers,
    JobLogsClient,
    JobOriginClient,
    ExecPulseClient,

    ExecuteJobMetadata,

    CONSTANTS,
    utils,
    Q,
    superagent,
    _,
) {
    'use strict';

    pluginMetadata = JSON.parse(pluginMetadata);

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
        ExecuteJobMetadata.call(this);
        this.pluginMetadata = pluginMetadata;
        this._running = null;

        // Metadata updating
        this.lastAppliedCmd = {};
        this.canceled = false;

        this.logManager = null;

        const deferred = Q.defer();
        this.executionId = deferred.promise;
        this.setExecutionId = deferred.resolve;

        this.runningJobHashes = [];
    };

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

        this.compute = null;
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
            typeName = type && this.core.getAttribute(type, 'name');

        if (typeName !== 'Job') {
            return callback(new Error(`Cannot execute ${typeName} (expected Job)`), this.result);
        }

        this.core.setAttribute(this.activeNode, 'executionId', await this.getExecutionId());

        // Set the parent execution to 'running'
        const execNode = this.core.getParent(this.activeNode);
        this.core.setAttribute(execNode, 'status', 'running');

        this._callback = callback;
        this.currentForkName = null;
        this.forkNameBase = this.core.getAttribute(this.activeNode, 'name');
        const isResuming = await this.isResuming(this.activeNode);
        this.initializeComputeClient();
        await this.prepare(isResuming);

        if (isResuming) {
            this.startExecHeartBeat();
            if (this.canResumeJob(this.activeNode)) {
                this.currentRunId = this.getJobId(this.activeNode);
                return this.resumeJob(this.activeNode);
            } else {
                var name = this.core.getAttribute(this.activeNode, 'name'),
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

    ExecuteJob.prototype.initializeComputeClient = function () {
        this.compute = this.createComputeClient();
        this.configureCompute(this.compute);
    };

    ExecuteJob.prototype.createComputeClient = function () {
        const config = this.getCurrentConfig();
        const backend = Compute.getBackend(config.compute.id);
        if (config.compute.id === 'gme') {
            config.compute.config.webgmeToken = this.blobClient.webgmeToken;  // HACK
        }
        return backend.getClient(this.logger, this.blobClient, config.compute.config);
    };

    ExecuteJob.prototype.configureCompute = function (compute) {
        compute.on(
            'data',
            (id, data) => {
                const job = this.getNodeForJobId(id);
                this.onConsoleOutput(job, data.toString());
            }
        );

        compute.on('update', async (jobId, status) => {
            try {
                await this.onUpdate(jobId, status);
            } catch (err) {
                this.logger.error(`Error when processing operation update: ${err}`);
                throw err;
            }
        });

        compute.on('end',
            async (id/*, info*/) => {
                try {
                    const job = this.getNodeForJobId(id);
                    if (job === null) {
                        assert(
                            this.canceled,
                            `Cannot find node for job ID in running pipeline: ${id}`
                        );
                        return;
                    }
                    this.cleanJobHashInfo(id);
                    await this.onOperationEnd(null, job);
                } catch (err) {
                    this.logger.error(`Error when processing operation end: ${err}`);
                    throw err;
                }
            }
        );
    };

    ExecuteJob.prototype.getStorageClient = async function () {
        const {storage} = this.getCurrentConfig();
        const backend = Storage.getBackend(storage.id);
        return await backend.getClient(this.logger, storage.config);
    };

    ExecuteJob.prototype.getInputStorageConfigs = async function () {
        const inputs = Object.entries(this.getCurrentConfig().inputs || {});
        const [nodeIds=[], configs=[]] = _.unzip(inputs);

        const nodes = await Promise.all(nodeIds.map(id => this.core.loadByPath(this.rootNode, id)));
        const dataInfos = nodes.map(node => this.core.getAttribute(node, 'data'));

        const config = _.object(_.zip(dataInfos, configs));
        return config;
    };

    ExecuteJob.prototype.getStorageClientForInputData = async function (dataInfo) {
        const configDict = await this.getInputStorageConfigs();
        const config = configDict[JSON.stringify(dataInfo)];
        const client = await Storage.getClient(dataInfo.backend, null, config);
        return client;
    };

    ExecuteJob.prototype.getJobId = function (node) {
        return this.getJobInfo(node).hash;
    };

    ExecuteJob.prototype.getJobInfo = function (node) {
        return JSON.parse(this.core.getAttribute(node, 'jobInfo'));
    };

    ExecuteJob.prototype.getExecutionId = utils.withTimeout(async function() {
        return await this.executionId;
    }, new Error('Timeout: Did not receive execution ID'));

    ExecuteJob.prototype.onMessage = function(messageId, content) {
        if (messageId === 'executionId') {
            this.setExecutionId(content);
        }
    };

    ExecuteJob.prototype.onAbort =
    ExecuteJob.prototype.onUserCancelDetected = function () {
        this.logger.info('Received Abort. Canceling jobs.');
        this.canceled = true;
        this.runningJobHashes
            .map(hash => this.getNodeForJobId(hash))
            .map(node => JSON.parse(this.core.getAttribute(node, 'jobInfo')))
            .forEach(jobInfo => this.compute.cancelJob(jobInfo));
    };

    ExecuteJob.prototype.isResuming = async function (job) {
        job = job || this.activeNode;
        var status = this.core.getAttribute(job, 'status'),
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
        return !!this.core.getAttribute(job, 'jobInfo');
    };

    ExecuteJob.prototype.resumeJob = async function (job) {
        var jobInfo = this.getJobInfo(job),
            name = this.core.getAttribute(job, 'name'),
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

        const stdout = await this.compute.getConsoleOutput(jobInfo);
        const result = await this.processStdout(job, stdout);

        if (result.hasMetadata) {
            const name = this.core.getAttribute(job, 'name');
            const msg = `Updated graph/image output for ${name}`;
            await this.save(msg);
        }

        return this.getOperation(job);
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

        this.pipelineName = this.core.getAttribute(executionNode, 'name');
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

        return await this.initializeMetadata(this.activeNode, isResuming);
    };

    ExecuteJob.prototype.onOperationCanceled = function(op) {
        const job = this.core.getParent(op);
        const name = this.core.getAttribute(op, 'name');
        const msg = `"${name}" canceled!`;

        this.core.setAttribute(job, 'status', 'canceled');
        this.resultMsg(msg);
        return this.onComplete(op, null);
    };

    ExecuteJob.prototype.resultMsg = function (msg) {
        this.sendNotification(msg);
        this.createMessage(null, msg);
    };

    ExecuteJob.prototype.onOperationFail =
    ExecuteJob.prototype.onOperationComplete =
    ExecuteJob.prototype.onComplete = async function (opNode, err) {
        const job = this.core.getParent(opNode);
        const exec = this.core.getParent(job);
        const name = this.core.getAttribute(job, 'name');
        const jobId = this.core.getPath(job);
        const status = err ? 'fail' : (this.canceled ? 'canceled' : 'success');
        const msg = err ? `${name} execution failed!` :
            `${name} executed successfully!`;

        this.core.setAttribute(job, 'status', status);
        this.core.delAttribute(job, 'executionId');
        this.logger.info(`Setting ${name} (${jobId}) status to ${status}`);
        this.clearOldMetadata(job);

        if (this.currentForkName) {
            // notify client that the job has completed
            this.sendNotification(`"${name}" execution completed on branch "${this.currentForkName}"`);
        }
        if (err) {
            this.logger.warn(`${name} failed: ${err}`);
            this.core.setAttribute(exec, 'status', 'failed');
        } else if (this.canceled) {
            // Should I set this to 'canceled'?
            this.core.setAttribute(exec, 'status', 'canceled');
        } else {
            // Check if all the other jobs are successful. If so, set the
            // execution status to 'success'
            const nodes = await this.core.loadChildren(exec);
            let execSuccess = true;

            for (var i = nodes.length; i--;) {
                const type = this.core.getMetaType(nodes[i]);
                const typeName = this.core.getAttribute(type, 'name');

                if (typeName === 'Job' &&
                    this.core.getAttribute(nodes[i], 'status') !== 'success') {
                    execSuccess = false;
                }
            }

            if (execSuccess) {
                this.core.setAttribute(exec, 'status', 'success');
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
        const name = this.core.getAttribute(node, 'name');

        // Execute any special operation types here - not on an compute
        this.logger.debug(`Executing operation "${name}"`);
        if (this.isLocalOperation(node)) {
            return this.executeLocalOperation(node);
        } else {
            // Generate all execution files
            let hash;
            try {
                const config = this.getCurrentConfig();
                hash = await this.getPtrCodeHash(this.core.getPath(node), config);
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
        const name = this.core.getAttribute(job, 'name');
        const e = `Failed to retrieve "${input}" (BLOB_FETCH_FAILED)`;
        let consoleErr = red(`Failed to execute operation: ${e}`);

        consoleErr += [
            '\n\nA couple things to check out:\n',
            '- Has the location of DeepForge\'s blob changed?',
            '    (Configurable using "blob.dir" in the deepforge config' +
            ' or setting the DEEPFORGE_BLOB_DIR environment variable)\n',

            '- Was this project created using a different blob location?'
        ].join('\n    ');

        this.core.setAttribute(job, 'stdout', consoleErr);
        this.onOperationFail(node, `Blob retrieval failed for "${name}": ${e}`);
    };

    ExecuteJob.prototype.executeDistOperation = async function (job, opNode, hash) {
        var name = this.core.getAttribute(opNode, 'name'),
            jobId = this.core.getPath(job);

        this.logger.info(`Executing operation "${name}"`);

        this.outputLineCount[jobId] = 0;
        // Set the job status to 'running'
        this.core.setAttribute(job, 'status', 'queued');
        this.core.delAttribute(job, 'stdout');
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
        this.core.setAttribute(job, 'jobInfo', JSON.stringify(jobInfo));
        this.core.setAttribute(job, 'execFiles', hash);

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
            job: this.core.getAttribute(job, 'name'),
            execution: this.core.getAttribute(execNode, 'name')
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
        return this.core.getAttribute(execNode, 'status') === 'canceled';
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
        const name = this.core.getAttribute(job, 'name');

        this.core.setAttribute(job, 'status', status);
        await this.save(`"${name}" operation in ${this.pipelineName} is now "${status}"`);
    };

    ExecuteJob.prototype.onConsoleOutput = async function (job, output) {
        const jobId = this.core.getPath(job);
        let stdout = this.core.getAttribute(job, 'stdout');
        let last = stdout.lastIndexOf('\n');
        let lastLine;

        if (last !== -1) {
            stdout = stdout.substring(0, last+1);
            lastLine = stdout.substring(last+1);
            output = lastLine + output;
        }

        const result = await this.processStdout(job, output, true);
        output = result.stdout;

        await this.logManager.appendTo(jobId, output);
        // Send notification to all clients watching the branch
        await this.notifyStdoutUpdate(jobId);

        if (result.hasMetadata) {
            const name = this.core.getAttribute(job, 'name');
            const msg = `Updated graph/image output for ${name}`;
            await this.save(msg);
        }
    };

    ExecuteJob.prototype.onOperationEnd = async function (err, job) {
        if (this.isLocalOperation(job)) {
            if (err) {
                return this.onOperationFail(job, err);
            } else {
                return this.onOperationComplete(job);
            }
        }

        const op = await this.getOperation(job);
        const name = this.core.getAttribute(job, 'name');
        const jobId = this.core.getPath(job);
        const jobInfo = JSON.parse(this.core.getAttribute(job, 'jobInfo'));

        const status = await this.compute.getStatus(jobInfo);
        this.logger.info(`Job "${name}" has finished (${status})`);

        if (status === this.compute.CANCELED) {
            // If it was canceled, the pipeline has been stopped
            this.logger.debug(`"${name}" has been CANCELED!`);
            const stdout = await this.logManager.getLog(jobId);
            this.core.setAttribute(job, 'stdout', stdout);
            return this.onOperationCanceled(op);
        }

        if (status === this.compute.SUCCESS || status === this.compute.FAILED) {
            const opName = this.core.getAttribute(op, 'name');
            const stdout = await this.compute.getConsoleOutput(jobInfo);
            const result = await this.processStdout(job, stdout);

            // Parse the remaining code
            this.core.setAttribute(job, 'stdout', result.stdout);
            this.logManager.deleteLog(jobId);
            if (status === this.compute.SUCCESS) {
                const results = await this.compute.getResultsInfo(jobInfo);
                await this.recordOperationOutputs(op, results);
            } else {
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
            const consoleErr = red(`Failed to execute operation: ${status}`);

            this.core.setAttribute(job, 'stdout', consoleErr);
            this.logger.error(err);
            return this.onOperationFail(op, err);
        }
    };

    ExecuteJob.prototype.recordOperationOutputs = async function (node, results) {
        const nodeId = this.core.getPath(node);
        const outputPorts = await this.getOutputs(node);
        const outputs = outputPorts.map(tuple => [tuple[0], tuple[2]]);

        for (let i = outputs.length; i--;) {
            const [name, dataNode] = outputs[i];
            const {type, dataInfo} = results[name];

            if (type) {
                this.core.setAttribute(dataNode, 'type', type);
                this.logger.info(`Setting ${nodeId} data type to ${type}`);
            } else {
                this.logger.warn(`No data type found for ${nodeId}`);
            }

            if (dataInfo) {
                this.core.setAttribute(dataNode, 'data', JSON.stringify(dataInfo));
                this.logger.info(`Setting ${nodeId} data to ${dataInfo}`);
            }

            await this.recordProvenance(dataNode, node);
        }

        return this.onOperationComplete(node);
    };

    ExecuteJob.prototype.recordProvenance = async function (dataNode, opNode) {
        const oldProvId = this.core.getPointerPath(dataNode, 'provenance');
        if (oldProvId) {
            const executedJob = await this.core.loadByPath(this.rootNode, oldProvId);
            this.core.deleteNode(executedJob);
        }

        const helpers = new ExecutionHelpers(this.core, this.rootNode);
        const executedJob = this.core.createNode({
            base: this.META.ExecutedJob,
            parent: dataNode
        });
        const {snapshot} = await helpers.snapshotOperation(opNode, executedJob, this.META.Operation);
        this.core.setPointer(executedJob, 'operation', snapshot);
        this.core.setPointer(dataNode, 'provenance', executedJob);
    };

    //////////////////////////// Special Operations ////////////////////////////
    ExecuteJob.prototype.executeLocalOperation = async function (node) {
        const type = this.getLocalOperationType(node);

        // Retrieve the given LOCAL_OP type
        if (!this[type]) {
            const err = new Error(`No local operation handler for "${type}"`);
            this.logger.error(err.message);
            throw err;
        }

        try {
            await this[type](node);
            await this.onOperationEnd(null, node);
        } catch (err) {
            const job = this.core.getParent(node);
            const stdout = this.core.getAttribute(job, 'stdout') +
                '\n' + red(err.toString());

            this.core.setAttribute(job, 'stdout', stdout);
            await this.onOperationEnd(err, node);
        }
    };

    _.extend(
        ExecuteJob.prototype,
        OperationPlugin.prototype,
        ExecuteJobMetadata.prototype,
        PtrCodeGen.prototype,
        LocalExecutor.prototype
    );

    ExecuteJob.prototype.processStdout = async function(job, text, continued) {
        const lines = text.replace(/\u0000/g, '').split('\n');
        removeLastPartialLine(lines);
        const result = await this.parseForMetadataCmds(job, lines, !continued);

        result.stdout = utils.resolveCarriageReturns(result.stdout).join('\n');
        return result;
    };

    ExecuteJob.prototype.getNodeCaches = function () {
        const caches = PluginBase.prototype.getNodeCaches.call(this);
        return caches.concat([this._execHashToJobNode]);
    };

    ExecuteJob.prototype.onSaveForked = function (forkName) {
        PluginBase.prototype.onSaveForked.call(this, forkName);
        this.logManager.fork(forkName);
        this.runningJobHashes.forEach(jobId => this.originManager.fork(jobId, forkName));
    };

    const ERROR = {};
    ERROR.NO_STDOUT_FILE = 'Could not find logs in job results.';
    ERROR.NO_TYPES_FILE = 'Metadata about result types not found.';

    function red(text) {
        return `[0;31m${text}[0m`;
    }

    function removeLastPartialLine(lines) {
        lines.pop();
    }

    return ExecuteJob;
});
