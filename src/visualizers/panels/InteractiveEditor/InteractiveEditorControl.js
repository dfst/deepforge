/*globals define, WebGMEGlobal*/

define([
    'deepforge/viz/ConfigDialog',
    'js/Constants',
], function (
    ConfigDialog,
    CONSTANTS,
) {

    'use strict';

    class InteractiveEditorControl {
        constructor(options) {
            this._logger = options.logger.fork('Control');
            this.client = options.client;
            this._embedded = options.embedded;
            this._widget = options.widget;
            this.initializeWidgetHandlers(this._widget);
            this.territoryEventFilters = [];

            this._currentNodeId = null;

            this._logger.debug('ctor finished');
        }

        initializeWidgetHandlers (widget) {
            const features = widget.getCapabilities();
            if (features.save) {
                widget.save = () => this.save();
            }
            widget.getConfigDialog = () => new ConfigDialog(this.client);
        }

        selectedObjectChanged (nodeId) {
            const desc = this.getObjectDescriptor(nodeId);

            this._logger.debug('activeObject nodeId \'' + nodeId + '\'');

            if (this._currentNodeId) {
                this.client.removeUI(this._territoryId);
            }

            this._currentNodeId = nodeId;

            if (typeof this._currentNodeId === 'string') {
                const territory = this.getTerritory(nodeId);
                this._widget.setTitle(desc.name.toUpperCase());

                this._territoryId = this.client
                    .addUI(this, events => this._eventCallback(events));

                this.client.updateTerritory(this._territoryId, territory);
            }
        }

        getTerritory(nodeId) {
            const territory = {};
            territory[nodeId] = {children: 0};
            return territory;
        }

        getMetaNode(name) {
            const metanodes = this.client.getAllMetaNodes();
            return metanodes
                .find(node => {
                    const namespace = node.getNamespace();
                    const fullName = namespace ? namespace + '.' + node.getAttribute('name') :
                        node.getAttribute('name');

                    return fullName === name;
                });
        }

        createNode(desc, parentId) {
            if (!parentId) {
                parentId = this._currentNodeId;
            }
            desc.pointers = desc.pointers || {};
            desc.attributes = desc.attributes || {};

            const base = this.getMetaNode(desc.type) || this.client.getNode(desc.pointers.base);
            const nodeId = this.client.createNode({
                parentId: parentId,
                baseId: base.getId()
            });

            const attributes = Object.entries(desc.attributes);
            attributes.forEach(entry => {
                const [name, value] = entry;
                this.client.setAttribute(nodeId, name, value);
            });

            const pointers = Object.entries(desc.pointers);
            pointers.forEach(entry => {
                const [name, id] = entry;
                this.client.setPointer(nodeId, name, id);
            });

            return nodeId;
        }

        save() {
            this.client.startTransaction();
            const dataId = this.createNode(this._widget.getSnapshot());
            const implicitOpId = this.createNode(this._widget.getEditorState(), dataId);
            this.client.setPointer(dataId, 'provenance', implicitOpId);
            const operationId = this.createNode(this._widget.getOperation(), implicitOpId);
            this.client.setPointer(implicitOpId, 'operation', operationId);
            this.client.completeTransaction();
        }

        getObjectDescriptor (nodeId) {
            const node = this.client.getNode(nodeId);

            if (node) {
                return {
                    id: node.getId(),
                    name: node.getAttribute('name'),
                    childrenIds: node.getChildrenIds(),
                    parentId: node.getParentId(),
                };
            }
        }

        /* * * * * * * * Node Event Handling * * * * * * * */
        _eventCallback (events=[]) {
            this._logger.debug('_eventCallback \'' + events.length + '\' items');

            events
                .filter(event => this.isRelevantEvent(event))
                .forEach(event => {
                    switch (event.etype) {

                    case CONSTANTS.TERRITORY_EVENT_LOAD:
                        this.onNodeLoad(event.eid);
                        break;
                    case CONSTANTS.TERRITORY_EVENT_UPDATE:
                        this.onNodeUpdate(event.eid);
                        break;
                    case CONSTANTS.TERRITORY_EVENT_UNLOAD:
                        this.onNodeUnload(event.eid);
                        break;
                    default:
                        break;
                    }
                });

            this._logger.debug('_eventCallback \'' + events.length + '\' items - DONE');
        }

        onNodeLoad (gmeId) {
            const description = this.getObjectDescriptor(gmeId);
            this._widget.addNode(description);
        }

        onNodeUpdate (gmeId) {
            const description = this.getObjectDescriptor(gmeId);
            this._widget.updateNode(description);
        }

        onNodeUnload (gmeId) {
            this._widget.removeNode(gmeId);
        }

        isRelevantEvent (event) {
            return this.territoryEventFilters
                .reduce((keep, fn) => keep && fn(event), true);
        }

        _stateActiveObjectChanged (model, activeObjectId) {
            if (this._currentNodeId === activeObjectId) {
                // The same node selected as before - do not trigger
            } else {
                this.selectedObjectChanged(activeObjectId);
            }
        }

        /* * * * * * * * Visualizer life cycle callbacks * * * * * * * */
        destroy () {
            this._detachClientEventListeners();
            this._widget.destroy();
        }

        _attachClientEventListeners () {
            this._detachClientEventListeners();
            if (!this._embedded) {
                WebGMEGlobal.State.on(
                    'change:' + CONSTANTS.STATE_ACTIVE_OBJECT,
                    this._stateActiveObjectChanged,
                    this
                );
            }
        }

        _detachClientEventListeners () {
            if (!this._embedded) {
                WebGMEGlobal.State.off(
                    'change:' + CONSTANTS.STATE_ACTIVE_OBJECT,
                    this._stateActiveObjectChanged
                );
            }
        }

        onActivate () {
            this._attachClientEventListeners();

            if (typeof this._currentNodeId === 'string') {
                WebGMEGlobal.State.registerActiveObject(this._currentNodeId, {suppressVisualizerFromNode: true});
            }
        }

        onDeactivate () {
            this._detachClientEventListeners();
        }
    }

    return InteractiveEditorControl;
});
