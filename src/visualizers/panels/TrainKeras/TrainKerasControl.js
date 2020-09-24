/*globals define */

define([
    'panels/InteractiveExplorer/InteractiveExplorerControl',
    'deepforge/globals',
    'deepforge/CodeGenerator',
    'deepforge/OperationCode',
    './JSONImporter',
    'js/Constants',
    'q',
    'underscore',
], function (
    InteractiveExplorerControl,
    DeepForge,
    CodeGenerator,
    OperationCode,
    Importer,
    CONSTANTS,
    Q,
    _,
) {

    'use strict';

    class TrainKerasControl extends InteractiveExplorerControl {

        initializeWidgetHandlers (widget) {
            super.initializeWidgetHandlers(widget);
            const self = this;
            widget.getArchitectureCode = id => this.getArchitectureCode(id);
            widget.saveModel = function() {return self.saveModel(...arguments);};
            widget.getNodeSnapshot = id => this.getNodeSnapshot(id);
        }

        async getNodeSnapshot(id) {
            const {core, rootNode} = await Q.ninvoke(this.client, 'getCoreInstance', this._logger);
            const importer = new Importer(core, rootNode);
            const node = await core.loadByPath(rootNode, id);
            const state = await importer.toJSON(node);
            makeIDsForContainedNodes(state, id);
            return state;
        }

        async saveModel(modelInfo, storage, session) {
            const {architecture} = modelInfo;
            const references = {};
            references.model = {
                type: '@meta:keras.Architecture',
                value: `@name:${architecture.attributes.name}`
            };
            const operation = this.createOperationNode(modelInfo.code, 'Train', references);
            operation.children.push(architecture);

            const projectId = this.client.getProjectInfo()._id;
            const savePath = `${projectId}/artifacts/${modelInfo.name}`;

            const metadata = (await session.forkAndRun(
                session => session.exec(`cat outputs/${modelInfo.path}/metadata.json`)
            )).stdout;
            const {type} = JSON.parse(metadata);
            const dataInfo = await session.forkAndRun(
                session => session.saveArtifact(
                    modelInfo.path,
                    savePath,
                    storage.id,
                    storage.config
                )
            );
            const implicitOp = {
                id: '@id:implicitOperation',
                pointers: {
                    base: '@meta:pipeline.TrainKeras',
                    operation: `@name:${operation.attributes.name}`,
                },
                attributes: {
                    name: modelInfo.name,
                    config: JSON.stringify(modelInfo.config),
                    plotData: JSON.stringify(modelInfo.plotData),
                },
                children: [operation]
            };
            const snapshot = {
                pointers: {
                    base: '@meta:pipeline.Data',
                    provenance: implicitOp.id,
                },
                attributes: {
                    name: modelInfo.name,
                    type: type,
                    data: JSON.stringify(dataInfo),
                },
                children: [implicitOp]
            };

            // TODO: save the plot in the artifact?
            const {core, rootNode} = await Q.ninvoke(this.client, 'getCoreInstance', this._logger);
            const importer = new Importer(core, rootNode);
            const parent = await core.loadByPath(rootNode, this._currentNodeId);
            await importer.import(parent, snapshot);
        }

        createOperationNode(code, name, references={}) {
            const operation = OperationCode.findOperation(code);
            const attributes = {name};
            const attribute_meta = {};
            const pointers = {base: '@meta:pipeline.Operation'};
            const pointer_meta = {};
            operation.getAttributes().forEach(attr => {
                const {name} = attr;
                const isReference = references[name];
                if (isReference) {
                    const ref = references[name];
                    pointers[name] = ref.value;
                    pointer_meta[name] = {min: 1, max: 1};
                    pointer_meta[name][ref.type] = {min: -1, max: 1};
                } else {
                    attributes[name] = attr.value;
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
                    attribute_meta[name] = {type};
                }
            });
            const inputs = {
                pointers: {
                    base: '@meta:pipeline.Inputs'
                },
                children: operation.getInputs().map(input => ({
                    pointers: {
                        base: '@meta:pipeline.Data',
                    },
                    attributes: {
                        name: input.name
                    }
                }))
            };

            const outputs = {
                pointers: {
                    base: '@meta:pipeline.Inputs'
                },
                children: operation.getOutputs().map(output => ({
                    pointers: {
                        base: '@meta:pipeline.Data',
                    },
                    attributes: {
                        name: output.name
                    }
                }))
            };
            const children = [inputs, outputs];
            return {
                attributes,
                attribute_meta,
                pointers,
                pointer_meta,
                children,
            };
        }

        getObjectDescriptor(nodeId) {
            const desc = super.getObjectDescriptor(nodeId);

            if (desc) {
                const node = this.client.getNode(nodeId);
                desc.data = node.getAttribute('data');
                desc.type = node.getAttribute('type');
            }

            return desc;
        }

        getTerritory(nodeId) {
            const territory = {};
            const node = this.client.getNode(nodeId);
            const parentId = node.getParentId();
            territory[parentId] = {children: 1};

            const omitParentNode = event => event.eid !== parentId;
            this.territoryEventFilters = [omitParentNode];

            return territory;
        }

        async selectedObjectChanged (nodeId) {
            super.selectedObjectChanged(nodeId);
            this.removeAuxTerritories();
            const isNewNodeLoaded = typeof nodeId === 'string';
            if (isNewNodeLoaded) {
                await this.addArchitectureTerritory();
                await this.addDatasetTerritory();
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

        async addDatasetTerritory() {
            const containerId = await DeepForge.places.MyArtifacts();
            const territory = {};
            territory[containerId] = {children: 1};
            this._artifactTerritory = this.client.addUI(
                territory,
                events => this.onArtifactEvents(events)
            );
            this.client.updateTerritory(this._artifactTerritory, territory);
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

                    case CONSTANTS.TERRITORY_EVENT_LOAD:
                        this.onResourceLoad(event.eid);
                        break;
                    case CONSTANTS.TERRITORY_EVENT_UPDATE:
                        this.onResourceUpdate(event.eid);
                        break;
                    case CONSTANTS.TERRITORY_EVENT_UNLOAD:
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

        async onArtifactEvents(events) {
            events
                .filter(event => this.isArtifact(event.eid))
                .forEach(event => {
                    switch (event.etype) {

                    case CONSTANTS.TERRITORY_EVENT_LOAD:
                        this.onArtifactLoad(event.eid);
                        break;
                    case CONSTANTS.TERRITORY_EVENT_UPDATE:
                        this.onArtifactUpdate(event.eid);
                        break;
                    case CONSTANTS.TERRITORY_EVENT_UNLOAD:
                        this.onArtifactUnload(event.eid);
                        break;
                    default:
                        break;
                    }
                });
        }

        isArtifact(nodeId) {
            const node = this.client.getNode(nodeId);
            if (node) {
                return node.getAttribute('data');
            }
            return true;
        }

        getArtifactDesc(nodeId) {
            const node = this.client.getNode(nodeId);
            const name = node.getAttribute('name').replace(/\..*$/, '');
            return {
                id: nodeId,
                name,
                type: node.getAttribute('type'),
                dataInfo: JSON.parse(node.getAttribute('data')),
            };
        }

        onArtifactLoad(nodeId) {
            const desc = this.getArtifactDesc(nodeId);
            this._widget.addArtifact(desc);
        }

        onArtifactUpdate(nodeId) {
            const desc = this.getArtifactDesc(nodeId);
            this._widget.updateArtifact(desc);
        }

        onArtifactUnload(nodeId) {
            this._widget.removeArtifact(nodeId);
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

        state.pointers = _.mapObject(state.pointers, (name, target) => updateID(target));
        state.member_attributes = _.mapObject(state.member_attributes, updateNodeIDKeys);
        state.member_registry = _.mapObject(state.member_registry, updateNodeIDKeys);
        state.sets = _.mapObject(state.sets, members => members.map(updateID));

        state.children.forEach(child => makeIDsForContainedNodes(child, id));
        return state;
    }

    return TrainKerasControl;
});
