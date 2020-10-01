/*globals define */

define([
    'panels/InteractiveExplorer/InteractiveExplorerControl',
    'deepforge/globals',
    'deepforge/PromiseEvents',
    'deepforge/compute/interactive/message',
    'deepforge/CodeGenerator',
    'plugin/GenerateJob/GenerateJob/templates/index',
    'text!./Main.py',
    'text!./TrainOperation.py',
    'deepforge/OperationCode',
    './JSONImporter',
    'deepforge/Constants',
    'js/Constants',
    'q',
    'underscore',
], function (
    InteractiveExplorerControl,
    DeepForge,
    PromiseEvents,
    Message,
    CodeGenerator,
    JobTemplates,
    MainCode,
    TrainOperation,
    OperationCode,
    Importer,
    CONSTANTS,
    GME_CONSTANTS,
    Q,
    _,
) {

    'use strict';

    MainCode = _.template(MainCode);
    const GetTrainCode = _.template(TrainOperation);
    class TrainKerasControl extends InteractiveExplorerControl {

        constructor() {
            super(...arguments);
            this.modelCount = 0;
        }

        initializeWidgetHandlers (widget) {
            super.initializeWidgetHandlers(widget);
            const self = this;
            widget.getArchitectureCode = id => this.getArchitectureCode(id);
            widget.saveModel = function() {return self.saveModel(...arguments);};
            widget.getNodeSnapshot = id => this.getNodeSnapshot(id);
            widget.stopCurrentTask = () => this.stopTask(this.currentTrainTask);
            widget.train = config => this.train(config);
            widget.isTrainingModel = () => this.isTrainingModel();
            widget.getCurrentModelID = () => this.getCurrentModelID();
            widget.createModelInfo = config => this.createModelInfo(config);
            widget.addArtifact = (dataset, auth) => this.addArtifact(dataset, auth);
        }

        async getNodeSnapshot(id) {
            const {core, rootNode} = await Q.ninvoke(this.client, 'getCoreInstance', this._logger);
            const importer = new Importer(core, rootNode);
            const node = await core.loadByPath(rootNode, id);
            const state = await importer.toJSON(node);
            makeIDsForContainedNodes(state, id);
            return state;
        }

        async onComputeInitialized(session) {
            super.onComputeInitialized(session);
            const initCode = await this.getInitializationCode();
            await session.addFile('utils/init.py', initCode);
            await session.addFile('plotly_backend.py', JobTemplates.MATPLOTLIB_BACKEND);
            await session.setEnvVar('MPLBACKEND', 'module://plotly_backend');
        }

        async stopTask(task) {
            await this.session.kill(task);
        }

        async addArtifact(dataset, auth) {
            await this.session.addArtifact(dataset.name, dataset.dataInfo, dataset.type, auth);
        }

        async createModelInfo(config) {
            this.modelCount++;
            const saveName = this.getCurrentModelID();
            const architecture = await this.getNodeSnapshot(config.architecture.id);
            return {
                id: saveName,
                path: saveName,
                name: saveName,
                config,
                architecture
            };
        }

        getCurrentModelID() {
            return `model_${this.modelCount}`;
        }

        train(modelInfo) {
            const self = this;
            return PromiseEvents.new(async function(resolve) {
                this.emit('update', 'Generating Code');
                await self.initTrainingCode(modelInfo);
                this.emit('update', 'Training...');
                const trainTask = self.session.spawn('python start_train.py');
                self.currentTrainTask = trainTask;
                self.currentTrainTask.on(Message.STDOUT, data => {
                    let line = data.toString();
                    if (line.startsWith(CONSTANTS.START_CMD)) {
                        line = line.substring(CONSTANTS.START_CMD.length + 1);
                        const splitIndex = line.indexOf(' ');
                        const cmd = line.substring(0, splitIndex);
                        const content = JSON.parse(line.substring(splitIndex + 1));
                        if (cmd === 'PLOT') {
                            this.emit('plot', content);
                        } else {
                            console.error('Unrecognized command:', cmd);
                        }
                    }
                });
                let stderr = '';
                self.currentTrainTask.on(Message.STDERR, data => stderr += data.toString());
                self.currentTrainTask.on(Message.COMPLETE, exitCode => {
                    if (exitCode) {
                        this.emit('error', stderr);
                    } else {
                        this.emit('end');
                    }
                    if (self.currentTrainTask === trainTask) {
                        self.currentTrainTask = null;
                    }
                    resolve();
                });
            });
        }

        async initTrainingCode(modelInfo) {
            const {config} = modelInfo;
            const {dataset, architecture, path, loss, optimizer} = config;
            const archCode = await this.getArchitectureCode(architecture.id);
            loss.arguments.concat(optimizer.arguments).forEach(arg => {
                let pyValue = arg.value.toString();
                if (arg.type === 'boolean') {
                    pyValue = arg.value ? 'True' : 'False';
                } else if (arg.type === 'enum') {
                    pyValue = `"${arg.value}"`;
                }
                arg.pyValue = pyValue;
            });
            await this.session.addFile('start_train.py', MainCode({
                dataset,
                path,
                archCode
            }));
            const trainPy = GetTrainCode(config);
            await this.session.addFile('operations/train.py', trainPy);
        }

        isTrainingModel() {
            return !!this.currentTrainTask;
        }

        async saveModel(modelInfo, storage) {
            modelInfo.code = GetTrainCode(modelInfo.config);
            const metadata = (await this.session.forkAndRun(
                session => session.exec(`cat outputs/${modelInfo.path}/metadata.json`)
            )).stdout;
            const {type} = JSON.parse(metadata);
            const projectId = this.client.getProjectInfo()._id;
            const savePath = `${projectId}/artifacts/${modelInfo.name}`;
            const dataInfo = await this.session.forkAndRun(
                session => session.saveArtifact(
                    `outputs/${modelInfo.path}/data`,
                    savePath,
                    storage.id,
                    storage.config
                )
            );

            const {core, rootNode} = await Q.ninvoke(this.client, 'getCoreInstance', this._logger);

            const parent = await core.loadByPath(rootNode, this._currentNodeId);
            const artifact = this.createModelArtifact(
                core,
                rootNode,
                modelInfo,
                dataInfo,
                type,
                parent
            );
            const trainState = this.createImplicitOperation(
                core,
                rootNode,
                modelInfo,
                artifact
            );
            core.setPointer(artifact, 'provenance', trainState);

            const operation = await this.createOperation(
                core,
                rootNode,
                modelInfo,
                trainState
            );
            core.setPointer(trainState, 'operation', operation);

            const importer = new Importer(core, rootNode);
            const {architecture} = modelInfo;
            const archNode = await importer.import(operation, architecture);
            core.setPointer(operation, 'model', archNode);

            // TODO: save the plot in the artifact?
            const {rootHash, objects} = core.persist(rootNode);
            const branch = this.client.getActiveBranchName();
            const startCommit = this.client.getActiveCommitHash();
            const project = this.client.getProjectObject();
            const commitMsg = `Saved trained neural network: ${modelInfo.name}`;
            await project.makeCommit(
                branch,
                [startCommit],
                rootHash,
                objects,
                commitMsg
            );
        }

        createModelArtifact(core, root, modelInfo, dataInfo, type, parent) {
            const metaNodes = Object.values(core.getAllMetaNodes(root));
            const base = metaNodes
                .find(node => core.getAttribute(node, 'name') === 'Data');

            const node = core.createNode({base, parent});
            core.setAttribute(node, 'name', modelInfo.name);
            core.setAttribute(node, 'type', type);
            core.setAttribute(node, 'data', JSON.stringify(dataInfo));
            core.setAttribute(node, 'createdAt', Date.now());
            return node;
        }

        createImplicitOperation(core, root, modelInfo, parent) {
            const metaNodes = Object.values(core.getAllMetaNodes(root));
            const base = metaNodes
                .find(node => core.getAttribute(node, 'name') === 'TrainKeras');
            const node = core.createNode({base, parent});

            core.setAttribute(node, 'name', `Train ${modelInfo.name}`);
            core.setAttribute(node, 'config', JSON.stringify(modelInfo.config));
            core.setAttribute(node, 'plotData', JSON.stringify(modelInfo.plotData));
            return node;
        }

        async createOperation(core, root, modelInfo, parent) {
            const META = _.object(
                Object.values(core.getAllMetaNodes(root))
                    .map(node => {
                        let prefix = core.getNamespace(node) || '';
                        if (prefix) {
                            prefix += '.';
                        }
                        return [prefix + core.getAttribute(node, 'name'), node];
                    })
            );
            const base = META['pipeline.Operation'];
            const node = core.createNode({base, parent});
            core.setAttribute(node, 'name', 'Train');

            const operation = OperationCode.findOperation(modelInfo.code);

            const references = {model: 'keras.Architecture'};
            operation.getAttributes().forEach(attr => {
                const {name} = attr;
                const isReference = references[name];
                if (isReference) {
                    const refTypeName = references[name];
                    const refType = META[refTypeName];
                    core.setPointerMetaLimits(node, name, 1, 1);
                    core.setPointerMetaTarget(node, name, refType, -1, 1);
                } else {
                    core.setAttribute(node, name, attr.value);
                    let type = 'string';
                    if (typeof attr.value === 'number') {
                        if (attr.value.toString().includes('.')) {
                            type = 'float';
                        } else {
                            type = 'integer';
                        }
                    } else if (typeof attr.value === 'boolean') {
                        type = 'boolean';
                    }
                    core.setAttributeMeta(node, name, {type});
                }
            });

            const [[inputs], [outputs]] = _.partition(
                await core.loadChildren(node),
                node => core.getAttribute(node, 'name') === 'Inputs'
            );

            const data = await core.loadByPath(root, modelInfo.config.dataset.id);
            core.copyNode(data, inputs);

            operation.getOutputs().forEach(output => {
                const outputNode = core.createNode({
                    base: META['pipeline.Data'],
                    parent: outputs
                });
                core.setAttribute(outputNode, 'name', output.name);
            });

            return node;
        }

        async getTerritory(/*nodeId*/) {
            const containerId = await DeepForge.places.MyArtifacts();
            const territory = {};
            territory[containerId] = {children: 1};
            this.territoryEventFilters = [event => this.isArtifact(event.eid)];

            return territory;
        }

        async selectedObjectChanged (nodeId) {
            super.selectedObjectChanged(nodeId);
            this.removeAuxTerritories();
            const isNewNodeLoaded = typeof nodeId === 'string';
            if (isNewNodeLoaded) {
                await this.addArchitectureTerritory();
            }
        }

        removeAuxTerritories() {
            if (this._archTerritory) {
                this.client.removeUI(this._archTerritory);
            }
            if (this._artifactTerritory) {
                this.client.removeUI(this._archTerritory);
            }
        }

        async addArchitectureTerritory() {
            const containerId = await DeepForge.places.MyResources();
            const territory = {};
            territory[containerId] = {children: 1};
            this._archTerritory = this.client.addUI(
                territory,
                events => this.onResourceEvents(events)
            );
            this.client.updateTerritory(this._archTerritory, territory);
        }

        async getArchitectureCode(nodeId) {
            const codeGen = await CodeGenerator.fromClient(this.client, this._logger);
            return await codeGen.getCode(nodeId);
        }

        async onResourceEvents(events) {
            events
                .filter(event => this.isKerasEvent(event))
                .forEach(event => {
                    switch (event.etype) {

                    case GME_CONSTANTS.TERRITORY_EVENT_LOAD:
                        this.onResourceLoad(event.eid);
                        break;
                    case GME_CONSTANTS.TERRITORY_EVENT_UPDATE:
                        this.onResourceUpdate(event.eid);
                        break;
                    case GME_CONSTANTS.TERRITORY_EVENT_UNLOAD:
                        this.onResourceUnload(event.eid);
                        break;
                    default:
                        break;
                    }
                });
        }

        isKerasEvent(event) {
            const nodeId = event.eid;
            const node = this.client.getNode(nodeId);
            if (node) {
                const kerasRootId = node.getLibraryRootId('keras');
                const metaId = node.getMetaTypeId();
                return this.isContainedIn(metaId, kerasRootId);
            }
            return true;
        }

        isContainedIn(possibleChildId, parentId) {
            return possibleChildId.startsWith(parentId);
        }

        onResourceLoad(nodeId) {
            const desc = this.getArchitectureDesc(nodeId);
            this._widget.addArchitecture(desc);
        }

        getArchitectureDesc(nodeId) {
            const node = this.client.getNode(nodeId);
            // TODO: include the input/output of the network?
            return {
                id: nodeId,
                name: node.getAttribute('name'),
            };
        }

        onResourceUpdate(nodeId) {
            const desc = this.getArchitectureDesc(nodeId);
            this._widget.updateArchitecture(desc);
        }

        onResourceUnload(nodeId) {
            this._widget.removeArchitecture(nodeId);
        }

        isArtifact(nodeId) {
            const node = this.client.getNode(nodeId);
            if (node) {
                return node.getAttribute('data');
            }
            return false;
        }

        getObjectDescriptor(nodeId) {
            const node = this.client.getNode(nodeId);
            const name = node.getAttribute('name').replace(/\..*$/, '');
            const dataInfo = node.getAttribute('data');
            return {
                id: nodeId,
                name,
                type: node.getAttribute('type'),
                dataInfo: dataInfo && JSON.parse(dataInfo),
            };
        }
    }

    function makeIDsForContainedNodes(state, id) {
        state.id = `@id:${state.path}`;
        const updateID = nodeId => nodeId.startsWith(id) ? `@id:${nodeId}` : nodeId;
        const updateNodeIDKeys = oldSet => {
            const set = _.object(Object.entries(oldSet).map(entry => {
                const [nodeId, value] = entry;
                return [updateID(nodeId), value];
            }));

            return set;
        };

        state.pointers = _.mapObject(state.pointers, target => updateID(target));
        state.member_attributes = _.mapObject(state.member_attributes, updateNodeIDKeys);
        state.member_registry = _.mapObject(state.member_registry, updateNodeIDKeys);
        state.sets = _.mapObject(state.sets, members => members.map(updateID));

        state.children.forEach(child => makeIDsForContainedNodes(child, id));
        return state;
    }

    return TrainKerasControl;
});
