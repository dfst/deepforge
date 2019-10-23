/* globals define, WebGMEGlobal */
// Mixin for executing jobs and pipelines
define([
    'q',
    'deepforge/compute/index',
    'deepforge/storage/index',
    'deepforge/viz/ConfigDialog',
    'deepforge/api/ExecPulseClient',
    'deepforge/api/JobOriginClient',
    'deepforge/Constants',
    'panel/FloatingActionButton/styles/Materialize',
], function(
    Q,
    Compute,
    Storage,
    ConfigDialog,
    ExecPulseClient,
    JobOriginClient,
    CONSTANTS,
    Materialize,
) {

    var Execute = function(client, logger) {
        this.client = this.client || client;
        this.logger = this.logger || logger;
        this.pulseClient = new ExecPulseClient({
            logger: this.logger
        });
        this.originManager = new JobOriginClient({logger: this.logger});
    };

    Execute.prototype.executeJob = function(node) {
        return this.runExecutionPlugin('ExecuteJob', node);
    };

    Execute.prototype.executePipeline = function(node) {
        return this.runExecutionPlugin('ExecutePipeline', node);
    };

    Execute.prototype.runExecutionPlugin = async function(pluginId, activeNode) {
        var deferred = Q.defer(),
            context = this.client.getCurrentPluginContext(pluginId),
            node = activeNode || this.client.getNode(this._currentNodeId);

        if (this.client.getBranchStatus() !== this.client.CONSTANTS.BRANCH_STATUS.SYNC) {

            Materialize.toast('Cannot execute operations when client is out-of-sync', 2000);
            return;
        }

        context.managerConfig.namespace = 'pipeline';
        context.managerConfig.activeNode = node.getId();

        const configDialog = new ConfigDialog(this.client, this._currentNodeId);
        const metadata = JSON.parse(JSON.stringify(WebGMEGlobal.allPluginsMetadata[pluginId]));
        metadata.configStructure.unshift({
            name: 'basicHeader',
            displayName: 'Basic Options',
            valueType: 'section'
        });
        metadata.configStructure.push({
            name: 'computeHeader',
            displayName: 'Compute Options',
            valueType: 'section'
        });
        metadata.configStructure.push({
            name: 'compute',
            displayName: 'Compute',
            description: 'Computational resources to use for execution.',
            valueType: 'dict',
            value: Compute.getBackend(Compute.getAvailableBackends()[0]).name,
            valueItems: Compute.getAvailableBackends()
                .map(id => Compute.getMetadata(id)),
        });

        metadata.configStructure.push({
            name: 'storageHeader',
            displayName: 'Storage Options',
            valueType: 'section'
        });
        metadata.configStructure.push({
            name: 'storage',
            displayName: 'Storage',
            description: 'Location to store intermediate/generated data.',
            valueType: 'dict',
            value: Storage.getBackend(Storage.getAvailableBackends()[0]).name,
            valueItems: Storage.getAvailableBackends()
                .map(id => Storage.getStorageMetadata(id)),
        });

        const allConfigs = await configDialog.show(metadata);
        context.pluginConfig = allConfigs[pluginId];

        const onPluginInitiated = (sender, event) => {
            this.client.removeEventListener(this._client.CONSTANTS.PLUGIN_INITIATED, onPluginInitiated);
            const {executionId} = event;
            this.client.sendMessageToPlugin(executionId, 'executionId', executionId);
            deferred.resolve(executionId);
        };

        this.client.addEventListener(
            this.client.CONSTANTS.PLUGIN_INITIATED,
            onPluginInitiated
        );

        this.client.runServerPlugin(pluginId, context, (err, result) => {
            const name = node.getAttribute('name');
            let msg = err ? `${name} failed!` : `${name} executed successfully!`,
                duration = err ? 4000 : 2000;

            // Check if it was canceled - if so, show that type of message
            if (result && result.messages.length) {
                msg = result.messages[0].message;
                duration = 4000;
            }

            Materialize.toast(msg, duration);
        });

        return deferred.promise;
    };

    Execute.prototype.isRunning = function(node) {
        node = node || this.client.getNode(this._currentNodeId);
        // TODO: Check the parent, too
        return node.getAttribute('executionId');
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

    Execute.prototype.stopExecution = function(nodeId=this._currentNodeId) {
        const node = this.client.getNode(nodeId);
        const base = this.client.getNode(node.getBaseId());
        const type = base.getAttribute('name');

        let executionId = node.getAttribute('executionId');
        this.client.delAttribute(nodeId, 'executionId');
        if (type === 'Job' && !executionId) {
            const execNode = this.client.getNode(node.getParentId());
            executionId = execNode.getAttribute('executionId');
            this.client.delAttribute(nodeId, 'executionId');
        }

        if (executionId) {
            this.client.abortPlugin(executionId);
        } else {
            this.logger.warn(`Could not find execution ID for ${nodeId}`);
        }
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
        const jobInfo = job.getAttribute('jobInfo');
        const status = job.getAttribute('status');

        if (status === 'running' && jobInfo) {
            const jobId = JSON.parse(jobInfo).hash;
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
