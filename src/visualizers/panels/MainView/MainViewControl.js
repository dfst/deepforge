/*globals define, WebGMEGlobal*/
/*jshint browser: true*/

define([
    'blob/BlobClient',
    'js/Constants',
    'js/Utils/GMEConcepts',
    'js/NodePropertyNames',
    'deepforge/globals'
], function (
    BlobClient,
    CONSTANTS,
    GMEConcepts,
    nodePropertyNames,
    DeepForge
) {

    'use strict';

    var MainViewControl;

    MainViewControl = function (options) {

        this._logger = options.logger.fork('Control');

        this._client = options.client;

        // Initialize core collections and variables
        this._widget = options.widget;

        this._currentNodeId = null;
        this._embedded = options.embedded;

        this.territory = {};
        this.ui = {};
        this._blobClient = new BlobClient({
            logger: this._logger.fork('BlobClient')
        });

        this._initWidgetEventHandlers();
        this._logger.debug('ctor finished');
    };

    MainViewControl.prototype._initWidgetEventHandlers = function () {
        this._widget.deleteNode = id => {
            var node = this._client.getNode(id),
                baseId = node.getBaseId(),
                base = this._client.getNode(baseId),
                baseName = base.getAttribute('name'),
                name = node.getAttribute('name'),
                msg = `Deleting ${baseName} "${name}"`;

            this._client.startTransaction(msg);
            this._client.delMoreNodes([id]);
            this._client.completeTransaction();
        };

        this._widget.dataUrlFor = id => {
            var node = this._client.getNode(id),
                hash = node.getAttribute('data');

            if (hash) {
                return this._blobClient.getDownloadURL(hash);
            } else {
                return null;
            }
        };

        this._widget.toggleEmbeddedPanel = () => this.toggleEmbeddedPanel();
    };

    /* * * * * * * * Visualizer content update callbacks * * * * * * * */
    // One major concept here is with managing the territory. The territory
    // defines the parts of the project that the visualizer is interested in
    // (this allows the browser to then only load those relevant parts).
    MainViewControl.prototype.selectedObjectChanged = function (nodeId) {
        this._logger.debug('activeObject nodeId \'' + nodeId + '\'');

        // Remove current territory patterns
        this.clearTerritoryRules();

        this._currentNodeId = nodeId;

        if (typeof this._currentNodeId === 'string') {
            var terrTypes = [
                /* [type, root dir] */
                ['arch', 'MyArchitectures'],
                ['artifact', 'MyArtifacts']
            ];

            terrTypes.forEach(pair => {
                var type = pair[0],
                    dirname = pair[1];

                // Update the territory
                this.territory[type] = {};
                this.territory[type][DeepForge.places[dirname]] = {children: 1};
                this.ui[type] = this._client.addUI(this, this.handleEvents.bind(this, type));
                this._client.updateTerritory(this.ui[type], this.territory[type]);
            });
        }
    };

    MainViewControl.prototype.handleEvents = function (type, events) {
        var event;

        // Remove the containing dir
        events = events.filter(e => !this.territory[type][e.eid]);
        this._logger.debug('_eventCallback \'' + i + '\' items');

        for (var i = events.length; i--;) {
            event = events[i];
            switch (event.etype) {

            case CONSTANTS.TERRITORY_EVENT_LOAD:
                this.onLoad(type, event.eid);
                break;
            case CONSTANTS.TERRITORY_EVENT_UPDATE:
                this._onUpdate(type, event.eid);
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

    MainViewControl.prototype.onLoad = function(type, id) {
        // Load a node of the given type
        var desc = this._getObjectDescriptor(type, id);
        if (type === 'arch') {
            this._widget.addArch(desc);
        } else {  // artifacts
            this._widget.addArtifact(desc);
        }
    };

    // This next function retrieves the relevant node information for the widget
    MainViewControl.prototype._getArtifactDesc = function (id) {
        var node = this._client.getNode(id),
            data = node.getAttribute('data'),
            desc = this._getBasicDesc(id);

        desc.data = data;
        return desc;
    };

    MainViewControl.prototype._getArchDesc =
    MainViewControl.prototype._getBasicDesc = function (id) {
        var node = this._client.getNode(id);

        return {
            id: id,
            name: node.getAttribute('name')
        };
    };

    MainViewControl.prototype._getObjectDescriptor = function (type, id) {
        return type === 'arch' ?
            this._getArchDesc(id) :
            this._getArtifactDesc(id);
    };

    /* * * * * * * * Node Event Handling * * * * * * * */
    MainViewControl.prototype._onUpdate = function (type, gmeId) {
        var description = this._getObjectDescriptor(type, gmeId);
        this._widget.updateNode(description);
    };

    MainViewControl.prototype._onUnload = function (gmeId) {
        this._widget.removeNode(gmeId);
    };

    MainViewControl.prototype._stateActiveObjectChanged = function (model, activeObjectId) {
        if (this._currentNodeId !== activeObjectId) {
            this.selectedObjectChanged(activeObjectId);
        }
    };

    /* * * * * * * * Visualizer life cycle callbacks * * * * * * * */
    MainViewControl.prototype.destroy = function () {
        this._detachClientEventListeners();
        this.clearTerritoryRules();
    };

    MainViewControl.prototype._attachClientEventListeners = function () {
        this._detachClientEventListeners();
        if (!this._embedded) {
            WebGMEGlobal.State.on('change:' + CONSTANTS.STATE_ACTIVE_OBJECT,
                this._stateActiveObjectChanged, this);
        }
    };

    MainViewControl.prototype._detachClientEventListeners = function () {
        if (!this._embedded) {
            WebGMEGlobal.State.off('change:' + CONSTANTS.STATE_ACTIVE_OBJECT,
                this._stateActiveObjectChanged);
        }
    };

    MainViewControl.prototype.onActivate = function () {
        this._attachClientEventListeners();

        if (typeof this._currentNodeId === 'string') {
            WebGMEGlobal.State.registerSuppressVisualizerFromNode(true);
            WebGMEGlobal.State.registerActiveObject(this._currentNodeId);
            WebGMEGlobal.State.registerSuppressVisualizerFromNode(false);
        }
    };

    MainViewControl.prototype.clearTerritoryRules = function () {
        if (Object.keys(this.ui).length) {
            Object.keys(this.ui).forEach(id =>
                this._client.removeUI(this.ui[id]));
        }
    };

    MainViewControl.prototype.onDeactivate = function () {
        this._detachClientEventListeners();
    };

    return MainViewControl;
});
