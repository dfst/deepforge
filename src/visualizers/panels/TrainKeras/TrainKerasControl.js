/*globals define */

define([
    'panels/InteractiveExplorer/InteractiveExplorerControl',
    'deepforge/globals',
    'deepforge/CodeGenerator',
    'js/Constants',
], function (
    InteractiveExplorerControl,
    DeepForge,
    CodeGenerator,
    CONSTANTS,
) {

    'use strict';

    class TrainKerasControl extends InteractiveExplorerControl {

        initializeWidgetHandlers (widget) {
            super.initializeWidgetHandlers(widget);
            widget.getArchitectureCode = id => this.getArchitectureCode(id);
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

    return TrainKerasControl;
});
