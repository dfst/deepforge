/*globals define, WebGMEGlobal*/

define([
    'js/Constants'
], function (
    CONSTANTS
) {

    'use strict';

    var TabbedTextEditorControl;

    TabbedTextEditorControl = function (options) {

        this._logger = options.logger.fork('Control');

        this._client = options.client;

        // Initialize core collections and variables
        this._widget = options.widget;
        this.editor = options.editor;

        this._currentNodeId = null;

        this._initWidgetEventHandlers();

        this._logger.debug('ctor finished');
    };

    TabbedTextEditorControl.prototype._initWidgetEventHandlers = function () {
        this._widget.addNewFile = name => {
            const parentId = this._currentNodeId;
            // Look up the valid children IDs? TODO
            const baseId = this._client.getAllMetaNodes()
                .find(node => node.getAttribute('name') === 'Code')
                .getId();
            const msg = `Created ${name} python module`;

            this._client.startTransaction(msg);
            const id = this._client.createNode({parentId, baseId});
            this._client.setAttribute(id, 'name', name);
            this._client.completeTransaction();
        };

        this._widget.onTabSelected = id => this.editor.selectedObjectChanged(id);

        this._widget.onNodeClick = function (id) {
            // Change the current active object
            WebGMEGlobal.State.registerActiveObject(id);
        };
    };

    /* * * * * * * * Visualizer content update callbacks * * * * * * * */
    TabbedTextEditorControl.prototype.selectedObjectChanged = function (nodeId) {
        var self = this;

        self._logger.debug('activeObject nodeId \'' + nodeId + '\'');

        // Remove current territory patterns
        if (self._currentNodeId) {
            self._client.removeUI(self._territoryId);
        }

        self._currentNodeId = nodeId;

        if (typeof self._currentNodeId === 'string') {
            // Put new node's info into territory rules
            self._selfPatterns = {};
            self._selfPatterns[nodeId] = {children: 0};  // Territory "rule"

            self._territoryId = self._client.addUI(self, function (events) {
                self._eventCallback(events);
            });

            // Update the territory
            self._selfPatterns[nodeId] = {children: 1};
            self._client.updateTerritory(self._territoryId, self._selfPatterns);
        }
    };

    // This next function retrieves the relevant node information for the widget
    TabbedTextEditorControl.prototype._getObjectDescriptor = function (nodeId) {
        var node = this._client.getNode(nodeId),
            desc;

        if (node) {
            desc = {
                id: node.getId(),
                name: node.getAttribute('name')
            };
        }

        return desc;
    };

    /* * * * * * * * Node Event Handling * * * * * * * */
    TabbedTextEditorControl.prototype._eventCallback = function (events) {
        var i = events ? events.length : 0,
            event;

        this._logger.debug('_eventCallback \'' + i + '\' items');

        while (i--) {
            event = events[i];
            switch (event.etype) {

            case CONSTANTS.TERRITORY_EVENT_LOAD:
                this._onLoad(event.eid);
                break;
            case CONSTANTS.TERRITORY_EVENT_UPDATE:
                this._onUpdate(event.eid);
                break;
            case CONSTANTS.TERRITORY_EVENT_UNLOAD:
                this._onUnload(event.eid);
                break;
            default:
                break;
            }
        }

        this._logger.debug('_eventCallback \'' + events.length + '\' items - DONE');
    };

    TabbedTextEditorControl.prototype._onLoad = function (gmeId) {
        var description = this._getObjectDescriptor(gmeId);
        if (gmeId !== this._currentNodeId) {
            this._widget.addNode(description);
        }
    };

    TabbedTextEditorControl.prototype._onUpdate = function (gmeId) {
        var description = this._getObjectDescriptor(gmeId);
        this._widget.updateNode(description);
    };

    TabbedTextEditorControl.prototype._onUnload = function (gmeId) {
        this._widget.removeNode(gmeId);
    };

    TabbedTextEditorControl.prototype._stateActiveObjectChanged = function (model, activeObjectId) {
        if (this._currentNodeId !== activeObjectId) {
            this.selectedObjectChanged(activeObjectId);
        }
    };

    /* * * * * * * * Visualizer life cycle callbacks * * * * * * * */
    TabbedTextEditorControl.prototype.destroy = function () {
        this._detachClientEventListeners();
        this._removeToolbarItems();
    };

    TabbedTextEditorControl.prototype._attachClientEventListeners = function () {
        if (!this._embedded) {
            this._detachClientEventListeners();
            WebGMEGlobal.State.on('change:' + CONSTANTS.STATE_ACTIVE_OBJECT, this._stateActiveObjectChanged, this);
        }
    };

    TabbedTextEditorControl.prototype._detachClientEventListeners = function () {
        if (!this._embedded) {
            WebGMEGlobal.State.off('change:' + CONSTANTS.STATE_ACTIVE_OBJECT, this._stateActiveObjectChanged);
        }
    };

    TabbedTextEditorControl.prototype.onActivate = function () {
        this._attachClientEventListeners();

        if (typeof this._currentNodeId === 'string') {
            WebGMEGlobal.State.registerActiveObject(this._currentNodeId, {suppressVisualizerFromNode: true});
        }
    };

    TabbedTextEditorControl.prototype.onDeactivate = function () {
        this._detachClientEventListeners();
    };

    return TabbedTextEditorControl;
});
