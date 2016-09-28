/*globals define */
/*jshint node:true, browser:true, esversion: 6*/

define([
    'plugin/CreateExecution/CreateExecution/CreateExecution',
    'plugin/ExecuteJob/ExecuteJob/ExecuteJob',
    'deepforge/JobLogsClient',
    'common/storage/constants',
    'common/core/constants',
    'q',
    'text!./metadata.json',
    'underscore'
], function (
    CreateExecution,
    ExecuteJob,
    JobLogsClient,
    STORAGE_CONSTANTS,
    CONSTANTS,
    Q,
    pluginMetadata,
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

        this._currentSave = Q();
        this.changes = {};
        this.currentChanges = {};  // read-only changes being applied
        this.creations = {};
        this.deletions = [];
        this.createIdToMetadataId = {};
        this.initRun();
    };

    /**
     * Metadata associated with the plugin. Contains id, name, version, description, icon, configStructue etc.
     * This is also available at the instance at this.pluginMetadata.
     * @type {object}
     */
    ExecutePipeline.metadata = pluginMetadata;

    // Prototypical inheritance from CreateExecution.
    ExecutePipeline.prototype = Object.create(CreateExecution.prototype);
    ExecutePipeline.prototype.constructor = ExecutePipeline;

    _.extend(ExecutePipeline.prototype, ExecuteJob.prototype);

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

        // When a pipeline fails, it will let all running jobs finish and record
        // the results of each job
        //
        // The following variables are used to...
        //   - keep track of the number of jobs currently running
        //   - keep track if the pipeline has errored
        //     - if so, don't start any more jobs
        this.pipelineError = null;
        this.canceled = false;
        this.runningJobs = 0;

        // metadata records
        this._metadata = {};
        this._markForDeletion = {};  // id -> node
        this._oldMetadataByName = {};  // name -> id
        this.lastAppliedCmd = {};
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
        var startPromise;

        this.initRun();
        if (this.core.isTypeOf(this.activeNode, this.META.Pipeline)) {
            // If starting with a pipeline, we will create an Execution first
            startPromise = this.createExecution(this.activeNode)
                .then(execNode => {
                    this.logger.debug(`Finished creating execution "${this.getAttribute(execNode, 'name')}"`);
                    this.activeNode = execNode;
                });
        } else if (this.core.isTypeOf(this.activeNode, this.META.Execution)) {
            this.logger.debug('Restarting execution');
            startPromise = Q();
        } else {
            return callback('Current node is not a Pipeline or Execution!', this.result);
        }

        // Get the gmeConfig...
        this.logManager = new JobLogsClient({
            logger: this.logger,
            port: this.gmeConfig.server.port,
            branchName: this.branchName,
            projectId: this.projectId
        });
        this._callback = callback;
        this.currentForkName = null;

        startPromise
        .then(() => this.core.loadSubTree(this.activeNode))
        .then(subtree => {
            var children = subtree
                .filter(n => this.core.getParent(n) === this.activeNode);

            this.pipelineName = this.getAttribute(this.activeNode, 'name');
            this.logger.debug(`Loaded subtree of ${this.pipelineName}. About to build cache`);
            this.buildCache(subtree);
            this.logger.debug('Parsing execution for job inter-dependencies');
            this.parsePipeline(children);  // record deps, etc

            this.logger.debug('Clearing old results');
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
            .then(() => this.updateForkName(this.pipelineName))
            .then(() => this.applyModelChanges())
            .then(() => CreateExecution.prototype.save.call(this, msg))
            .then(result => {
                var msg;
                if (result.status === STORAGE_CONSTANTS.FORKED) {
                    this.currentForkName = result.forkName;
                    this.logManager.fork(result.forkName);
                    msg = `"${this.pipelineName}" execution has forked to "${result.forkName}"`;
                    this.sendNotification(msg);
                } else if (result.status === STORAGE_CONSTANTS.MERGED) {
                    this.logger.debug('Merged changes. About to update plugin nodes');
                    return this.updateNodes();
                }

            });

        return this._currentSave;
    };

    ExecutePipeline.prototype.updateNodes = function (hash) {
        var result = ExecuteJob.prototype.updateNodes.call(this, hash);
        return result.then(() => this.updateCache());
    };

    ExecutePipeline.prototype.updateCache = function () {
        var nodeIds = Object.keys(this.nodes),
            nodes = nodeIds.map(id => this.core.loadByPath(this.rootNode, id));

        this.logger.debug(`updating node cache (${nodeIds.length} nodes)`);
        return Q.all(nodes).then(nodes => {
            for (var i = nodeIds.length; i--;) {
                this.nodes[nodeIds[i]] = nodes[i];
            }
        });
    };

    ExecutePipeline.prototype.isExecutionCanceled = function () {
        return this.getAttribute(this.activeNode, 'status') === 'canceled';
    };

    ExecutePipeline.prototype.isInputData = function (node) {
        var prnt = this.core.getParent(node);
        return this.core.isTypeOf(prnt, this.META.Inputs);
    };

    ExecutePipeline.prototype.clearResults = function () {
        var nodes = Object.keys(this.nodes).map(id => this.nodes[id]);
        // Clear the pipeline's results
        this.logger.info('Clearing all intermediate execution results');

        nodes.filter(node => this.core.isTypeOf(node, this.META.Data))
            // Only input data nodes should be cleared. Outputs will be overwritten
            .filter(node => this.isInputData(node))
            .forEach(conn => this.core.delAttribute(conn, 'data'));

        // Set the status for each job to 'pending'
        nodes.filter(node => this.core.isTypeOf(node, this.META.Job))
            .forEach(node => {
                this.recordOldMetadata(node);
                this.setAttribute(node, 'status', 'pending');
            });

        // Set the status of the execution to 'running'
        this.setAttribute(this.activeNode, 'status', 'running');
        this.logger.info('Setting all jobs status to "pending"');
        this.logger.debug(`Making a commit from ${this.currentHash}`);
        this.setAttribute(this.activeNode, 'startTime', Date.now());
        this.core.delAttribute(this.activeNode, 'endTime');
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
        conns = this.getConnections(nodes);

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

    ExecutePipeline.prototype.onOperationFail = function(node, err) {
        var job = this.core.getParent(node),
            id = this.core.getPath(node),
            name = this.getAttribute(node, 'name');

        this.logger.debug(`Operation ${name} (${id}) failed: ${err}`);
        this.setAttribute(job, 'status', 'fail');
        this.clearOldMetadata(job);
        this.onPipelineComplete(err);
    };

    ExecutePipeline.prototype.onOperationCanceled = function(op) {
        var job = this.core.getParent(op);
        this.setAttribute(job, 'status', 'canceled');
        this.runningJobs--;
        this.logger.debug(`${this.getAttribute(job, 'name')} has been canceled`);
        this.onPipelineComplete();
    };

    ExecutePipeline.prototype.onPipelineComplete = function(err) {
        var name = this.getAttribute(this.activeNode, 'name'),
            msg = `"${this.pipelineName}" `;

        if (err) {
            this.runningJobs--;
        }

        this.pipelineError = this.pipelineError || err;

        this.logger.debug(`${this.runningJobs} remaining jobs`);
        if ((this.pipelineError || this.canceled) && this.runningJobs > 0) {
            var action = this.pipelineError ? 'error' : 'cancel';
            this.logger.info(`Pipeline ${action}ed but is waiting for the running ` +
                'jobs to finish');
            return;
        }

        if (this.currentForkName) {
            // notify client that the job has completed
            this.sendNotification(`"${this.pipelineName}" execution completed on branch "${this.currentForkName}"`);
        }

        if (this.pipelineError) {
            msg += 'failed!';
        } else if (this.canceled) {
            msg += 'canceled!';
        } else {
            msg += 'finished!';
        }

        this.isDeleted().then(isDeleted => {
            if (!isDeleted) {

                this.logger.debug(`Pipeline "${name}" complete!`);
                this.setAttribute(this.activeNode, 'endTime', Date.now());
                this.setAttribute(this.activeNode, 'status',
                    (this.pipelineError ? 'failed' :
                    (this.canceled ? 'canceled' : 'success')
                    )
                );

                this._finished = true;
                this.resultMsg(msg);
                this.save('Pipeline execution finished')
                    .then(() => {
                        this.result.setSuccess(!this.pipelineError);
                        this._callback(this.pipelineError || null, this.result);
                    })
                    .fail(e => this.logger.error(e));
            } else {  // deleted!
                this.logger.debug('Execution has been deleted!');
                this.result.setSuccess(!this.pipelineError);
                this._callback(this.pipelineError || null, this.result);
            }
        });

    };

    ExecutePipeline.prototype.isDeleted = function () {
        var activeId = this.core.getPath(this.activeNode);

        // Check if the current execution has been deleted
        return this.project.getBranchHash(this.branchName)
            .then(hash => this.updateNodes(hash))
            .then(() => this.core.loadByPath(this.rootNode, activeId))
            .then(node => {
                var deleted = node === null,
                    msg = `Verified that execution is ${deleted ? '' : 'not '}deleted`;

                this.logger.debug(msg);
                return deleted;
            })
            .fail(err => this.logger.error(err));
    };

    ExecutePipeline.prototype.onPipelineDeleted = function () {
        var msg = `${this.pipelineName} has been deleted`;
        this.resultMsg(msg);
        this.result.setSuccess(true);
        this._callback(null, this.result);
    };

    ExecutePipeline.prototype.executeReadyOperations = function () {
        // Get all operations with incomingCount === 0
        var operations = Object.keys(this.incomingCounts),
            readyOps = operations.filter(name => this.incomingCounts[name] === 0);

        this.logger.info(`About to execute ${readyOps.length} operations`);

        // If the pipeline has errored don't start any more jobs
        if (this.pipelineError || this.canceled) {
            if (this.runningJobs === 0) {
                this.onPipelineComplete();
            }
            return 0;
        }

        // Execute all ready operations
        readyOps.forEach(jobId => {
            delete this.incomingCounts[jobId];
        });
        this.logger.info(`Found ${readyOps.length} ready job(s)`);
        readyOps.reduce((prev, jobId) => {
            return prev.then(() => this.executeJob(this.nodes[jobId]));
        }, Q());
        this.runningJobs += readyOps.length;
        this.logger.info(`There ${this.runningJobs === 1 ? 'is' : 'are'} now ${this.runningJobs} running job(s)`);

        return readyOps.length;
    };

    ExecutePipeline.prototype.onOperationComplete = function (opNode) {
        var name = this.getAttribute(opNode, 'name'),
            nextPortIds = this.getOperationOutputIds(opNode),
            jNode = this.core.getParent(opNode),
            resultPorts,
            jobId = this.core.getPath(jNode),
            hasReadyOps;

        // Set the operation to 'success'!
        this.clearOldMetadata(jNode);
        this.runningJobs--;
        this.setAttribute(jNode, 'status', 'success');
        this.logger.info(`Setting ${jobId} status to "success"`);
        this.logger.info(`There are now ${this.runningJobs} running jobs`);
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
                            hash = this.getAttribute(result, 'data');
                        
                        this.logger.info(`forwarding data (${hash}) from ${this.core.getPath(result)} ` +
                            `to ${this.core.getPath(next)}`);
                        this.setAttribute(next, 'data', hash);
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

    return ExecutePipeline;
});
