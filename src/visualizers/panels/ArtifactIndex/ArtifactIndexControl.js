/*globals define, WebGMEGlobal*/
/*jshint browser: true*/

define([
    'deepforge/storage/index',
    'blob/BlobClient',
    'js/Constants'
], function (
    Storage,
    BlobClient,
    CONSTANTS
) {

    'use strict';

    var ArtifactIndexControl;

    ArtifactIndexControl = function (options) {

        this._logger = options.logger.fork('Control');
        this.blobClient = new BlobClient({
            logger: this._logger.fork('BlobClient')
        });

        this._client = options.client;
        this._embedded = options.embedded;

        // Initialize core collections and variables
        this._widget = options.widget;

        this._currentNodeId = null;
        this._initWidgetEventHandlers();

        this._logger.debug('ctor finished');
    };

    ArtifactIndexControl.prototype._initWidgetEventHandlers = function () {
        this._widget.onNodeClick = (/*id*/) => {
            // Change the current active object
            // This is currently disabled as there are not any good
            // visualizers for the data types
            // WebGMEGlobal.State.registerActiveObject(id);
        };

        this._widget.onNodeDeleteClicked = async (id, config) => {
            const node = this._client.getNode(id);
            const name = node.getAttribute('name');
            const msg = `Deleted "${name}" artifact (${id})`;

            const deleteDataFromStorage = !!config;
            if (deleteDataFromStorage) {
                const dataInfo = this.getDataInfo(node);
                const {backend} = dataInfo;
                const storage = await Storage.getClient(backend, this._logger, config);
                await storage.deleteFile(dataInfo);
            }

            this._client.startTransaction(msg);
            this._client.deleteNode(id);
            this._client.completeTransaction();
        };

        this._widget.onAttributeChange = (id, attr, newValue) => {
            const node = this._client.getNode(id);
            const name = node.getAttribute('name');
            const oldValue = node.getAttribute(attr);
            const fromMsg = oldValue ? ` (from ${oldValue})` : '';
            const msg = `Set ${name} artifact's ${attr} to ${newValue}${fromMsg}`;
            this._client.startTransaction(msg);
            this._client.setAttribute(id, attr, newValue);
            this._client.completeTransaction();
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
    ArtifactIndexControl.prototype._getObjectDescriptor = async function (nodeId) {
        const node = this._client.getNode(nodeId);
        const dataInfo = this.tryGetDataInfo(node);
        let backendName;
        if(dataInfo) {
            backendName = Storage.getStorageMetadata(dataInfo.backend).name;
        }

        if (node && dataInfo) {
            const type = node.getAttribute('type');
            const metadata = await Storage.getMetadata(dataInfo, this._logger);
            const size = this._humanFileSize(metadata.size);

            return {
                id: node.getId(),
                type: type,
                name: node.getAttribute('name'),
                createdAt: node.getAttribute('createdAt'),
                parentId: node.getParentId(),
                backendName: backendName,
                dataInfo,
                size,
            };
        }

    };

    ArtifactIndexControl.prototype.getDataInfo = function (node) {
        const rawDataInfo = node.getAttribute('data');
        try {
            return JSON.parse(rawDataInfo);
        } catch (err) {
            if (rawDataInfo) {
                throw new Error(`Invalid DataInfo: "${rawDataInfo}"`);
            } else {
                throw new Error('Missing DataInfo');
            }
        }
    };

    ArtifactIndexControl.prototype.tryGetDataInfo = function (node) {
        try {
            return this.getDataInfo(node);
        } catch (err) {
            return null;
        }
    };

    ArtifactIndexControl.prototype._humanFileSize = function (bytes, si) {
        var thresh = si ? 1000 : 1024,
            units = si ?
                ['kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'] :
                ['KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'],
            u = -1;

        if (bytes < thresh) {
            return bytes + ' B';
        }

        do {
            bytes = bytes / thresh;
            u += 1;
        } while (bytes >= thresh);

        return bytes.toFixed(1) + ' ' + units[u];
    };

    /* * * * * * * * Node Event Handling * * * * * * * */
    ArtifactIndexControl.prototype._eventCallback = function (events) {
        events = events.filter(event => event.eid !== this._currentNodeId);
        let i = events ? events.length : 0;
        this._logger.debug('_eventCallback \'' + i + '\' items');

        let event;
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
        this._getObjectDescriptor(gmeId).then(desc => this._widget.addNode(desc));
    };

    ArtifactIndexControl.prototype._onUpdate = function (gmeId) {
        this._getObjectDescriptor(gmeId).then(desc => this._widget.updateNode(desc));
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
        if (!this._embedded) {
            WebGMEGlobal.State.on('change:' + CONSTANTS.STATE_ACTIVE_OBJECT, this._stateActiveObjectChanged, this);
        }
    };

    ArtifactIndexControl.prototype._detachClientEventListeners = function () {
        if (!this._embedded) {
            WebGMEGlobal.State.off('change:' + CONSTANTS.STATE_ACTIVE_OBJECT, this._stateActiveObjectChanged);
        }
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
