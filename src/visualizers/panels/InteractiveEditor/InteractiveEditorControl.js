/*globals define, WebGMEGlobal*/

define([
    'deepforge/EventEmitter',
    'deepforge/compute/interactive/session-with-queue',
    'deepforge/viz/ConfigDialog',
    'js/Constants',
    'q',
], function (
    EventEmitter,
    Session,
    ConfigDialog,
    CONSTANTS,
    Q,
) {

    'use strict';

    class InteractiveEditorControl extends EventEmitter {
        constructor(options) {
            super();
            this._logger = options.logger.fork('Control');
            this.client = options.client;
            this.session = options.session;
            this._embedded = options.embedded;
            this._widget = options.widget;
            this.initializeWidgetHandlers(this._widget);
            this.territoryEventFilters = [];
            this._currentNodeId = null;
            if (this.session) {
                this.onComputeInitialized(this.session);
            } else {
                this._widget.showComputeShield();
            }
            this._logger.debug('ctor finished');
        }

        initializeWidgetHandlers (widget) {
            const self = this;
            widget.save = function() {return self.save(...arguments);};
            widget.getConfigDialog = () => new ConfigDialog(this.client);
            widget.getInitializationCode = () => this.getInitializationCode();
            widget.createInteractiveSession =
                (computeId, config) => this.createInteractiveSession(computeId, config);
        }

        async createInteractiveSession(computeId, config) {
            const createSession = Session.new(computeId, config);
            this._widget.showComputeLoadingStatus(status);
            this._widget.updateComputeLoadingStatus('Connecting');
            createSession.on(
                'update',
                status => this._widget.updateComputeLoadingStatus(status)
            );
            const session = await createSession;
            this.onComputeInitialized(session);
        }

        async onComputeInitialized(session) {
            this._widget.hideComputeShield();
            this.session = session;
            this.emit('computeInitialized', session);
        }

        async getInitializationCode () {
            const deferred = Q.defer();
            const territory = {'': {children: 1}};
            const territoryId = this.client.addUI(this, events => {
                const codeType = this.getMetaNode('pipeline.Code');
                const libraryCode = this.getMetaNode('LibraryCode');
                if (!codeType || !libraryCode) {
                    this._logger.warn('Unsupported project. Could not find Code and LibraryCode meta node.');
                    return;
                }

                const nodeIds = events
                    .filter(event => event.etype === CONSTANTS.TERRITORY_EVENT_LOAD)
                    .map(event => event.eid);

                const codeNodeIds = nodeIds
                    .filter(id => this.client.isTypeOf(id, codeType.getId()));

                const initCode = codeNodeIds
                    .sort((n1, n2) => {  // move library code to be in the front
                        const v1 = this.client.isTypeOf(n1, libraryCode.getId()) ? 1 : 0;
                        const v2 = this.client.isTypeOf(n2, libraryCode.getId()) ? 1 : 0;
                        return v2 - v1;
                    })
                    .map(nodeId => this.client.getNode(nodeId).getAttribute('code'))
                    .join('\n');

                this.client.removeUI(territoryId);
                deferred.resolve(initCode);
            });
            this.client.updateTerritory(territoryId, territory);

            return deferred.promise;
        }

        async selectedObjectChanged (nodeId) {
            const desc = this.getObjectDescriptor(nodeId);

            this._logger.debug('activeObject nodeId \'' + nodeId + '\'');

            if (this._currentNodeId) {
                this.client.removeUI(this._territoryId);
            }

            this._currentNodeId = nodeId;

            if (typeof this._currentNodeId === 'string') {
                const territory = await this.getTerritory(nodeId);
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
            if (this.session) {
                this.session.close();
            }
            this.emit('destroy');
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
