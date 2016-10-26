/*globals define, WebGMEGlobal*/
/*jshint browser: true*/

define([
    'js/Constants'
], function (
    CONSTANTS
) {

    'use strict';

    var ArtifactIndexControl;

    ArtifactIndexControl = function (options) {

        this._logger = options.logger.fork('Control');

        this._client = options.client;

        // Initialize core collections and variables
        this._widget = options.widget;

        this._currentNodeId = null;
        this._initWidgetEventHandlers();

        this._logger.debug('ctor finished');
    };

    ArtifactIndexControl.prototype._initWidgetEventHandlers = function () {
        this._widget.onNodeClick = function (id) {
            // Change the current active object
            WebGMEGlobal.State.registerActiveObject(id);
        };
    };

    /* * * * * * * * Visualizer content update callbacks * * * * * * * */
    // One major concept here is with managing the territory. The territory
    // defines the parts of the project that the visualizer is interested in
    // (this allows the browser to then only load those relevant parts).
    ArtifactIndexControl.prototype.selectedObjectChanged = function (nodeId) {
        this._logger.debug('activeObject nodeId \'' + nodeId + '\'');

        // Remove current territory patterns
        if (this._currentNodeId) {
            this._client.removeUI(this._territoryId);
        }

        this._currentNodeId = nodeId;

        if (typeof this._currentNodeId === 'string') {
            // Put new node's info into territory rules
            this._widget.currentNode = this._currentNodeId;
            this._selfPatterns = {};

            this._territoryId = this._client.addUI(this, events => {
                this._eventCallback(events);
            });

            this._selfPatterns[nodeId] = {children: 1};
            this._client.updateTerritory(this._territoryId, this._selfPatterns);
        }
    };

    // This next function retrieves the relevant node information for the widget
    ArtifactIndexControl.prototype._getObjectDescriptor = function (nodeId) {
        var node = this._client.getNode(nodeId),
            base,
            objDescriptor;

        if (node) {
            base = this._client.getNode(node.getBaseId());
            objDescriptor = {
                id: node.getId(),
                type: base ? base.getAttribute('name') : 'n/a',
                name: node.getAttribute('name'),
                data: node.getAttribute('data'),
                parentId: node.getParentId()
            };
        }

        return objDescriptor;
    };

    /* * * * * * * * Node Event Handling * * * * * * * */
    ArtifactIndexControl.prototype._eventCallback = function (events) {
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

    ArtifactIndexControl.prototype._onLoad = function (gmeId) {
        var description = this._getObjectDescriptor(gmeId);
        this._widget.addNode(description);
    };

    ArtifactIndexControl.prototype._onUpdate = function (gmeId) {
        var description = this._getObjectDescriptor(gmeId);
        this._widget.updateNode(description);
    };

    ArtifactIndexControl.prototype._onUnload = function (gmeId) {
        this._widget.removeNode(gmeId);
    };

    ArtifactIndexControl.prototype._stateActiveObjectChanged = function (model, activeObjectId) {
        if (this._currentNodeId === activeObjectId) {
            // The same node selected as before - do not trigger
        } else {
            this.selectedObjectChanged(activeObjectId);
        }
    };

    /* * * * * * * * Visualizer life cycle callbacks * * * * * * * */
    ArtifactIndexControl.prototype.destroy = function () {
        this._detachClientEventListeners();
    };

    ArtifactIndexControl.prototype._attachClientEventListeners = function () {
        this._detachClientEventListeners();
        WebGMEGlobal.State.on('change:' + CONSTANTS.STATE_ACTIVE_OBJECT, this._stateActiveObjectChanged, this);
    };

    ArtifactIndexControl.prototype._detachClientEventListeners = function () {
        WebGMEGlobal.State.off('change:' + CONSTANTS.STATE_ACTIVE_OBJECT, this._stateActiveObjectChanged);
    };

    ArtifactIndexControl.prototype.onActivate = function () {
        this._attachClientEventListeners();

        if (typeof this._currentNodeId === 'string') {
            WebGMEGlobal.State.registerSuppressVisualizerFromNode(true);
            WebGMEGlobal.State.registerActiveObject(this._currentNodeId);
            WebGMEGlobal.State.registerSuppressVisualizerFromNode(false);
        }
    };

    ArtifactIndexControl.prototype.onDeactivate = function () {
        this._detachClientEventListeners();
    };

    return ArtifactIndexControl;
});
