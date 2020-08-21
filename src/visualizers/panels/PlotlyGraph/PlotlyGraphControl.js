/*globals define, WebGMEGlobal*/

define([
    'js/Constants'
], function (
    CONSTANTS
) {
    'use strict';

    const GRAPH = 'Graph';

    function PlotlyGraphControl(options) {

        this._logger = options.logger.fork('Control');

        this._client = options.client;

        // Initialize core collections and variables
        this._widget = options.widget;

        this._embedded = options.embedded;

        this._currentNodeId = null;
        this._currentNodeParentId = undefined;
        this._logger.debug('ctor finished');
    }

    /* * * * * * * * Visualizer content update callbacks * * * * * * * */
    // One major concept here is with managing the territory. The territory
    // defines the parts of the project that the visualizer is interested in
    // (this allows the browser to then only load those relevant parts).
    PlotlyGraphControl.prototype.selectedObjectChanged = function (nodeId) {
        let self = this;

        self._logger.debug('activeObject nodeId \'' + nodeId + '\'');

        // Remove current territory patterns
        if (self._currentNodeId) {
            self._client.removeUI(self._territoryId);
        }

        self._currentNodeId = nodeId;
        self._currentNodeParentId = undefined;

        if (typeof self._currentNodeId === 'string') {
            // Put new node's info into territory rules
            self._selfPatterns = {};

            self._widget.setTitle('Plotly Widget');

            self._territoryId = self._client.addUI(self, function (events) {
                self._eventCallback(events);
            });

            // Update the territory
            self._selfPatterns[nodeId] = {children: 1};
            self._client.updateTerritory(self._territoryId, self._selfPatterns);
        }
    };

    // This next function retrieves the relevant node information for the widget
    PlotlyGraphControl.prototype._getObjectDescriptor = function (nodeId) {
        let node = this._client.getNode(nodeId),
            desc;
        const isGraph = node => {
            if(node) {
                return this._client.getNode(node.getMetaTypeId())
                    .getAttribute('name') === GRAPH;
            }
        };
        if(isGraph(node)){
            const plotlyData = node.getAttribute('data');
            if(plotlyData){
                desc = { plotlyData: JSON.parse(plotlyData) };
            }
        }
        return desc;
    };

    /* * * * * * * * Node Event Handling * * * * * * * */
    PlotlyGraphControl.prototype._eventCallback = function (events) {
        let i = events ? events.length : 0,
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

    PlotlyGraphControl.prototype._onLoad = function (gmeId) {
        let description = this._getObjectDescriptor(gmeId);
        this._widget.addNode(description);
    };

    PlotlyGraphControl.prototype._onUpdate = function (gmeId) {
        let description = this._getObjectDescriptor(gmeId);
        this._widget.updateNode(description);
    };

    PlotlyGraphControl.prototype._onUnload = function (gmeId) {
        this._widget.removeNode(gmeId);
    };

    PlotlyGraphControl.prototype._stateActiveObjectChanged = function (model, activeObjectId) {
        if (this._currentNodeId === activeObjectId) {
            // The same node selected as before - do not trigger
        } else {
            this.selectedObjectChanged(activeObjectId);
        }
    };

    /* * * * * * * * Visualizer life cycle callbacks * * * * * * * */
    PlotlyGraphControl.prototype.destroy = function () {
        this._detachClientEventListeners();
        if(this._territoryId){
            this._client.removeUI(this._territoryId);
        }
    };

    PlotlyGraphControl.prototype._attachClientEventListeners = function () {
        if (!this._embedded) {
            this._detachClientEventListeners();
            WebGMEGlobal.State.on('change:' + CONSTANTS.STATE_ACTIVE_OBJECT, this._stateActiveObjectChanged, this);
        }
    };

    PlotlyGraphControl.prototype._detachClientEventListeners = function () {
        if(!this._embedded){
            WebGMEGlobal.State.off('change:' + CONSTANTS.STATE_ACTIVE_OBJECT, this._stateActiveObjectChanged);
        }
    };

    PlotlyGraphControl.prototype.onActivate = function () {
        this._attachClientEventListeners();

        if (typeof this._currentNodeId === 'string') {
            WebGMEGlobal.State.registerSuppressVisualizerFromNode(true);
            WebGMEGlobal.State.registerActiveObject(this._currentNodeId);
            WebGMEGlobal.State.registerSuppressVisualizerFromNode(false);
        }
    };

    PlotlyGraphControl.prototype.onDeactivate = function () {
        this._detachClientEventListeners();
    };

    return PlotlyGraphControl;
});
