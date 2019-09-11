/* globals define, WebGMEGlobal */
// Mixin for executing jobs and pipelines
define([
    'q',
    'deepforge/execution/index',
    'deepforge/api/ExecPulseClient',
    'deepforge/api/JobOriginClient',
    'deepforge/Constants',
    'panel/FloatingActionButton/styles/Materialize'
], function(
    Q,
    ExecutorClient,
    ExecPulseClient,
    JobOriginClient,
    CONSTANTS,
    Materialize
) {

    var Execute = function(client, logger) {
        this.client = this.client || client;
        this.logger = this.logger || logger;
        this.pulseClient = new ExecPulseClient({
            logger: this.logger
        });
        this._executor = new ExecutorClient(this.logger, WebGMEGlobal.gmeConfig);
        this.originManager = new JobOriginClient({logger: this.logger});
    };

    Execute.prototype.executeJob = function(node) {
        return this.runExecutionPlugin('ExecuteJob', {node: node});
    };

    Execute.prototype.executePipeline = function(node) {
        return this.runExecutionPlugin('ExecutePipeline', {node: node});
    };

    Execute.prototype.runExecutionPlugin = function(pluginId, opts) {
        var context = this.client.getCurrentPluginContext(pluginId),
            node = opts.node || this.client.getNode(this._currentNodeId),
            name = node.getAttribute('name'),
            method;

        // Set the activeNode
        context.managerConfig.namespace = 'pipeline';
        context.managerConfig.activeNode = node.getId();
        method = opts.useSecondary ? 'runBrowserPlugin' : 'runServerPlugin';

        if (method === 'runServerPlugin' &&
            this.client.getBranchStatus() !== this.client.CONSTANTS.BRANCH_STATUS.SYNC) {

            Materialize.toast('Cannot execute operations when client is out-of-sync', 2000);
            return;
        }

        this.client[method](pluginId, context, (err, result) => {
            var msg = err ? `${name} failed!` : `${name} executed successfully!`,
                duration = err ? 4000 : 2000;

            // Check if it was canceled - if so, show that type of message
            if (result && result.messages.length) {
                msg = result.messages[0].message;
                duration = 4000;
            }

            Materialize.toast(msg, duration);
        });
    };

    Execute.prototype.isRunning = function(node) {
        var baseId,
            base,
            type;

        node = node || this.client.getNode(this._currentNodeId);
        baseId = node.getBaseId();
        base = this.client.getNode(baseId);
        type = base.getAttribute('name');

        if (type === 'Execution') {
            return node.getAttribute('status') === 'running';
        } else if (type === 'Job') {
            return this.isRunningJob(node);
        }
        return false;
    };

    Execute.prototype.isRunningJob = function(job) {
        var status = job.getAttribute('status');

        return (status === 'running' || status === 'pending') &&
            job.getAttribute('secret') && job.getAttribute('jobId');
    };

    Execute.prototype.silentStopJob = function(job) {
        var jobInfo;

        job = job || this.client.getNode(this._currentNodeId);
        try {
            jobInfo = JSON.parse(job.getAttribute('jobInfo'));
        } catch (err) {
            this.logger.error('Cannot stop job. Missing jobInfo.');
            return;
        }

        return this._executor.cancelJob(jobInfo)
            .then(() => this.logger.info(`${jobInfo.hash} has been cancelled!`))
            .fail(err => this.logger.error(`Job cancel failed: ${err}`));
    };

    Execute.prototype._setJobStopped = function(jobId, silent) {
        if (!silent) {
            var name = this.client.getNode(jobId).getAttribute('name');
            this.client.startTransaction(`Stopping "${name}" job`);
        }

        this.client.delAttribute(jobId, 'jobId');
        this.client.delAttribute(jobId, 'secret');
        this.client.setAttribute(jobId, 'status', 'canceled');

        if (!silent) {
            this.client.completeTransaction();
        }
    };

    Execute.prototype.stopJob = function(job, silent) {
        var jobId;

        job = job || this.client.getNode(this._currentNodeId);
        jobId = job.getId();

        this.silentStopJob(job);
        this._setJobStopped(jobId, silent);
    };


    Execute.prototype.loadChildren = function(id) {
        var deferred = Q.defer(),
            execNode = this.client.getNode(id || this._currentNodeId),
            jobIds = execNode.getChildrenIds(),
            jobsLoaded = !jobIds.length || this.client.getNode(jobIds[0]);

        // May need to load the jobs...
        if (!jobsLoaded) {
            // Create a territory and load the nodes
            var territory = {},
                ui;

            territory[id] = {children: 1};
            ui = this.client.addUI(this, () => {
                this.client.removeUI(ui);
                deferred.resolve();
            });
            this.client.updateTerritory(ui, territory);
        } else {
            deferred.resolve();
        }

        return deferred.promise;
    };

    Execute.prototype.stopExecution = function(id, inTransaction) {
        var execNode = this.client.getNode(id || this._currentNodeId);

        return this.loadChildren(id)
            .then(() => this._stopExecution(execNode, inTransaction));
    };

    Execute.prototype.silentStopExecution = function(id) {
        var execNode = this.client.getNode(id || this._currentNodeId);

        // Stop the execution w/o setting any attributes
        return this.loadChildren(id)
            .then(() => this._stopExecution(execNode));
    };

    Execute.prototype._stopExecution = function(execNode) {
        var runningJobIds = execNode.getChildrenIds()
            .map(id => this.client.getNode(id))
            .filter(job => this.isRunning(job));  // get running jobs

        runningJobIds.forEach(job => this.silentStopJob(job));  // stop them

        return runningJobIds;
    };

    // Resuming Executions
    Execute.prototype.checkJobExecution= function (job) {
        var pipelineId = job.getParentId(),
            pipeline = this.client.getNode(pipelineId);

        // First check the parent execution. If it doesn't exist, then check the job
        return this.checkPipelineExecution(pipeline)
            .then(tryToStartJob => {
                if (tryToStartJob) {
                    return this._checkJobExecution(job);
                }
            });
    };

    Execute.prototype._checkJobExecution = function (job) {
        var jobId = job.getAttribute('jobId'),
            status = job.getAttribute('status');

        if (status === 'running' && jobId) {
            return this.pulseClient.check(jobId)
                .then(status => {
                    if (status !== CONSTANTS.PULSE.DOESNT_EXIST) {
                        return this._onOriginBranch(jobId).then(onBranch => {
                            if (onBranch) {
                                this.runExecutionPlugin('ExecuteJob', {
                                    node: job
                                });
                            }
                        });
                    } else {
                        this.logger.warn(`Could not restart job: ${job.getId()}`);
                    }
                });
        }
        return Q();
    };

    Execute.prototype._onOriginBranch = function (hash) {
        return this.originManager.getOrigin(hash)
            .then(origin => {
                var currentBranch = this.client.getActiveBranchName();
                if (origin && origin.branch) {
                    return origin.branch === currentBranch;
                }
                return false;
            });
    };

    Execute.prototype.checkPipelineExecution = function (pipeline) {
        var runId = pipeline.getAttribute('runId'),
            status = pipeline.getAttribute('status'),
            tryToStartJob = true;

        if (status === 'running' && runId) {
            return this.pulseClient.check(runId)
                .then(status => {
                    if (status === CONSTANTS.PULSE.DEAD) {
                        // Check the origin branch
                        return this._onOriginBranch(runId).then(onBranch => {
                            if (onBranch) {
                                this.runExecutionPlugin('ExecutePipeline', {
                                    node: pipeline
                                });
                            }
                        });
                    }
                    // only try to start if the pulse info doesn't exist
                    tryToStartJob = status === CONSTANTS.PULSE.DOESNT_EXIST;
                    return tryToStartJob;
                });
        } else {
            return Q().then(() => tryToStartJob);
        }
    };

    return Execute;
});
