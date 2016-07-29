/*globals define, WebGMEGlobal*/
/*jshint browser: true*/

define([
    'blob/BlobClient',
    'js/Constants',
    'js/Utils/GMEConcepts',
    'js/NodePropertyNames'
], function (
    BlobClient,
    CONSTANTS,
    GMEConcepts,
    nodePropertyNames
) {

    'use strict';

    var ImageViewerControl;

    ImageViewerControl = function (options) {

        this._logger = options.logger.fork('Control');

        this._client = options.client;

        // Initialize core collections and variables
        this._widget = options.widget;
        this.blobClient = new BlobClient({
            logger: this._logger.fork('BlobClient')
        });

        this._currentNodeId = null;

        this._logger.debug('ctor finished');
    };

    /* * * * * * * * Visualizer content update callbacks * * * * * * * */
    // One major concept here is with managing the territory. The territory
    // defines the parts of the project that the visualizer is interested in
    // (this allows the browser to then only load those relevant parts).
    ImageViewerControl.prototype.selectedObjectChanged = function (nodeId) {
        this._logger.debug('activeObject nodeId \'' + nodeId + '\'');

        // Remove current territory patterns
        if (this._currentNodeId) {
            this._client.removeUI(this._territoryId);
        }

        this._currentNodeId = nodeId;

        if (typeof this._currentNodeId === 'string') {
            // Put new node's info into territory rules
            this._selfPatterns = {};
            this._selfPatterns[nodeId] = {children: 0};  // Territory "rule"
            this._territoryId = this._client.addUI(this, this._eventCallback.bind(this));
            this._client.updateTerritory(this._territoryId, this._selfPatterns);
        }
    };

    // This next function retrieves the relevant node information for the widget
    ImageViewerControl.prototype._getObjectDescriptor = function (nodeId) {
        var nodeObj = this._client.getNode(nodeId),
            objDescriptor,
            hash;

        if (nodeObj) {
            objDescriptor = {
                id: undefined,
                name: undefined
            };

            objDescriptor.id = nodeObj.getId();
            objDescriptor.name = nodeObj.getAttribute(nodePropertyNames.Attributes.name);
            // Get the blob url
            hash = nodeObj.getAttribute('data');
            if (hash) {
                objDescriptor.src = this.blobClient.getDownloadURL(hash);
            }
        }

        return objDescriptor;
    };

    /* * * * * * * * Node Event Handling * * * * * * * */
    ImageViewerControl.prototype._eventCallback = function (events) {
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

    ImageViewerControl.prototype._onUpdate =
    ImageViewerControl.prototype._onLoad = function (gmeId) {
        var description = this._getObjectDescriptor(gmeId);
        this._widget.updateImage(description.src);
    };

    ImageViewerControl.prototype._onUnload = function (gmeId) {
        this._widget.removeImage(gmeId);
    };

    /* * * * * * * * Visualizer life cycle callbacks * * * * * * * */
    ImageViewerControl.prototype.onActivate = function () {
        if (typeof this._currentNodeId === 'string') {
            WebGMEGlobal.State.registerSuppressVisualizerFromNode(true);
            WebGMEGlobal.State.registerActiveObject(this._currentNodeId);
            WebGMEGlobal.State.registerSuppressVisualizerFromNode(false);
        }
    };

    ImageViewerControl.prototype.destroy =
    ImageViewerControl.prototype.onDeactivate = function () {
    };

    return ImageViewerControl;
});
