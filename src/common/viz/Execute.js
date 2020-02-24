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
        const computeMetadata = Compute.getAvailableBackends().map(id => Compute.getMetadata(id));
        const storageMetadata = Storage.getAvailableBackends().map(id => Storage.getStorageMetadata(id));
        metadata.configStructure.unshift({
            name: 'basicHeader',
            displayName: 'Basic Options',
            valueType: 'section'
        });

        const inputConfigs = (await this.getArtifactInputs(node))
            .map(input => {
                const config = this.getAuthConfig(input);
                if (config) {
                    return [input, config];
                }
            })
            .filter(info => !!info);

        if (inputConfigs.length) {
            metadata.configStructure.push({
                name: 'PipelineInputsHeader',
                displayName: 'Credentials for Pipeline Inputs',
                valueType: 'section'
            });
            const inputOpts = inputConfigs.map(pair => {
                const [node, config] = pair;
                const name = node.getAttribute('name');
                const backend = JSON.parse(node.getAttribute('data')).backend;
                const storageName = Storage.getStorageMetadata(backend).name;
                const title = `${name} (${storageName}):`;

                config.unshift({
                    name: `${title} Header`,
                    displayName: title,
                    valueType: 'section'
                });

                return {
                    name: node.getId(),
                    valueType: 'group',
                    valueItems: config
                };
            });

            metadata.configStructure.push({
                name: 'inputs',
                valueType: 'group',
                valueItems: inputOpts
            });
        }

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
            valueItems: computeMetadata,
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
            valueItems: storageMetadata,
        });

        const allConfigs = await configDialog.show(metadata);
        context.pluginConfig = allConfigs[pluginId];
        context.pluginConfig.storage.id = storageMetadata
            .find(metadata => metadata.name === allConfigs[pluginId].storage.name)
            .id;
        context.pluginConfig.compute.id = computeMetadata
            .find(metadata => metadata.name === allConfigs[pluginId].compute.name)
            .id;

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

    Execute.prototype.getAuthConfig = function(node) {
        const dataInfo = JSON.parse(node.getAttribute('data'));
        const {backend} = dataInfo;
        const metadata = Storage.getStorageMetadata(backend);
        metadata.configStructure = metadata.configStructure.filter(config => config.isAuth);
        if (metadata.configStructure.length) {
            return metadata.configStructure;
        } else {
            return null;
        }
    };

    Execute.prototype.getMetaNode = function(name) {
        return this.client.getAllMetaNodes()
            .find(node => node.getAttribute('name') === name);
    };

    Execute.prototype.getArtifactInputs = async function(node) {
        const baseName = this.getBaseName(node);
        if (baseName === 'Pipeline') {
            await this.loadChildren(node.getId());
            const operations = node.getChildrenIds()
                .map(id => this.client.getNode(id));

            return this.getArtifactsFromInputs(operations);

        } else if (baseName === 'Execution') {
            const children = await Promise.all(
                node.getChildrenIds()
                    .map(id => this.getNode(id))
            );
            const JobBaseId = this.getMetaNode('Job').getId();
            const jobs = children.filter(node => node.isInstanceOf(JobBaseId));

            const artifacts = await Promise.all(
                jobs.map(job => this.getArtifactsFromInputJob(job))
            );
            return artifacts.flat();
        } else {
            return this.getArtifactsFromJob(node);
        }
    };

    Execute.prototype.getOperation = async function(job) {
        const OperationBase = this.getMetaNode('Operation').getId();
        const children = job.getChildrenIds()
            .map(id => this.getNode(id));
        const operations = (await Promise.all(children))
            .filter(node => node.isInstanceOf(OperationBase));
        return operations.shift();
    };

    Execute.prototype.getArtifactsFromJob = async function(node) {
        const operation = await this.getOperation(node);
        return await this.getInputs(operation);
    };

    Execute.prototype.getArtifactsFromInputJob = async function(node) {
        const operation = await this.getOperation(node);
        return this.getArtifactsFromInputs([operation]);
    };

    Execute.prototype.getArtifactsFromInputs = async function(operations) {
        const inputOps = operations.filter(node => {
            const baseName = this.getBaseName(node);
            return baseName === 'Input';
        });

        const dataNodes = await Promise.all(inputOps.map(node => {
            const id = node.getPointer('artifact').to;
            if (id) {
                return this.getNode(id);
            }
        }));

        return dataNodes.filter(node => !!node);
    };

    Execute.prototype.getArtifactFromInputOp = async function(node) {
        const id = node.getPointer('artifact').to;
        if (id) {
            return this.getNode(id);
        }
    };

    Execute.prototype.getBaseName = function(node) {
        const base = this.client.getNode(node.getBaseId());
        return base.getAttribute('name');
    };

    Execute.prototype.getInputs = async function(operation) {
        return this.getGrandchildrenInType(operation, 'Inputs');
    };

    Execute.prototype.getOutputs = async function(operation) {
        return this.getGrandchildrenInType(operation, 'Outputs');
    };

    Execute.prototype.getGrandchildrenInType = async function(node, typeName) {
        await this.loadChildren(node.getId());
        const outputsCntr = node.getChildrenIds().map(id => this.client.getNode(id))
            .find(node => node.getAttribute('name') === typeName);

        await this.loadChildren(outputsCntr.getId());
        return outputsCntr.getChildrenIds().map(id => this.client.getNode(id));
    };

    Execute.prototype.isRunning = function(node) {
        node = node || this.client.getNode(this._currentNodeId);
        // TODO: Check the parent, too
        return node.getAttribute('executionId');
    };

    Execute.prototype.loadChildren = async function(id) {
        var execNode = this.client.getNode(id || this._currentNodeId),
            jobIds = execNode.getChildrenIds(),
            jobsLoaded = !jobIds.length || this.client.getNode(jobIds[0]);

        // May need to load the jobs...
        if (!jobsLoaded) {
            const territory = {};
            territory[id] = {children: 1};
            await this.loadTerritory(territory);
        }
    };

    Execute.prototype.getNode = async function(id) {
        let node = this.client.getNode(id);
        if (!node) {
            await this.loadNode(id);
            node = this.client.getNode(id);
        }
        return node;
    };

    Execute.prototype.loadNode = async function(id) {
        const territory = {};
        territory[id] = {children: 0};
        await this.loadTerritory(territory);
    };

    Execute.prototype.loadTerritory = function(territory) {
        const deferred = Q.defer();
        const ui = this.client.addUI(this, () => {
            this.client.removeUI(ui);
            deferred.resolve();
        });
        this.client.updateTerritory(ui, territory);
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
