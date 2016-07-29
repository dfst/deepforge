/*globals define */
/*jshint node:true, browser:true, esversion: 6*/

define([
    'plugin/CreateExecution/CreateExecution/CreateExecution',
    'plugin/ExecuteJob/ExecuteJob/ExecuteJob',
    'common/storage/constants',
    'common/core/constants',
    'q',
    'text!./metadata.json',
    'underscore'
], function (
    CreateExecution,
    ExecuteJob,
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
        // This will probably need to execute the operations, too, because the
        // inputs for the next operation cannot be created until the inputs have
        // been generated

        this.initRun();
        var startPromise;
        if (this.core.isTypeOf(this.activeNode, this.META.Pipeline)) {
            // If starting with a pipeline, we will create an Execution first
            startPromise = this.createExecution(this.activeNode)
                .then(execNode => {
                    this.activeNode = execNode;
                });
        } else if (this.core.isTypeOf(this.activeNode, this.META.Execution)) {
            startPromise = Q();
        } else {
            return callback('Current node is not a Pipeline or Execution!', this.result);
        }

        this._callback = callback;

        startPromise
        .then(() => this.core.loadSubTree(this.activeNode))
        .then(subtree => {
            var children = subtree
                .filter(n => this.core.getParent(n) === this.activeNode);

            this.pipelineName = this.core.getAttribute(this.activeNode, 'name');
            this.buildCache(subtree);
            this.parsePipeline(children);  // record deps, etc

            return this.clearResults();
        })
        .then(() => this.executePipeline())
        .fail(e => this.logger.error(e));
    };

    ExecutePipeline.prototype.updateForkName = function () {
        var basename = this.pipelineName + '_fork';
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

    // Override 'save' to prevent race conditions while saving
    ExecutePipeline.prototype.save = function (msg) {
        // When 'save'  is called, it should still finish any current save op
        // before continuing
        this._currentSave = this._currentSave
            .then(() => this.updateForkName())
            .then(() => CreateExecution.prototype.save.call(this, msg))
            .then(result => {
                var msg;
                if (result.status === STORAGE_CONSTANTS.FORKED) {
                    msg = `"${this.pipelineName}" execution has forked to "${result.forkName}"`;
                    this.sendNotification(msg);
                }
            });

        return this._currentSave;
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
                this.core.setAttribute(node, 'status', 'pending');
            });

        // Set the status of the execution to 'running'
        this.core.setAttribute(this.activeNode, 'status', 'running');
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
            name = this.core.getAttribute(node, 'name');

        this.logger.debug(`Operation ${name} (${id}) failed: ${err}`);
        this.core.setAttribute(job, 'status', 'fail');
        this.clearOldMetadata(job);
        this.onPipelineComplete(err);
    };

    ExecutePipeline.prototype.onPipelineComplete = function(err) {
        var name = this.core.getAttribute(this.activeNode, 'name');

        if (err) {
            this.runningJobs--;
        }

        this.pipelineError = this.pipelineError || err;

        if (this.pipelineError && this.runningJobs > 0) {
            this.logger.info('Pipeline errored but is waiting for the running ' +
                'jobs to finish');
            return;
        }

        this.logger.debug(`Pipeline "${name}" complete!`);
        this.core.setAttribute(this.activeNode, 'status',
            (!this.pipelineError ? 'success' : 'failed'));

        this._finished = true;
        this.save('Pipeline execution finished')
            .then(() => {
                this.result.setSuccess(!this.pipelineError);
                this._callback(this.pipelineError || null, this.result);
            })
            .fail(e => this.logger.error(e));
    };

    ExecutePipeline.prototype.executeReadyOperations = function () {
        // Get all operations with incomingCount === 0
        var operations = Object.keys(this.incomingCounts),
            readyOps = operations.filter(name => this.incomingCounts[name] === 0);

        this.logger.info(`About to execute ${readyOps.length} operations`);

        // If the pipeline has errored don't start any more jobs
        if (this.pipelineError) {
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
        var name = this.core.getAttribute(opNode, 'name'),
            nextPortIds = this.getOperationOutputIds(opNode),
            jNode = this.core.getParent(opNode),
            resultPorts,
            jobId = this.core.getPath(jNode),
            hasReadyOps;

        // Set the operation to 'success'!
        this.clearOldMetadata(jNode);
        this.runningJobs--;
        this.core.setAttribute(jNode, 'status', 'success');
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

    return ExecutePipeline;
});
