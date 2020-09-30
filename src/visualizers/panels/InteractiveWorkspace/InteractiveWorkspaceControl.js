/*globals define, WebGMEGlobal*/

define([
    'js/Constants',
    'js/Utils/GMEConcepts',
    'js/NodePropertyNames',
    'deepforge/globals',
    'text!./InteractiveEditors.json',
], function (
    CONSTANTS,
    GMEConcepts,
    nodePropertyNames,
    DeepForge,
    InteractiveEditors,
) {

    'use strict';

    InteractiveEditors = JSON.parse(InteractiveEditors);
    const BROWSE_EDITORS_TEXT = 'Open editor';
    function InteractiveWorkspaceControl(options) {

        this._logger = options.logger.fork('Control');

        this._client = options.client;

        // Initialize core collections and variables
        this._widget = options.widget;

        this._currentNodeId = null;
        this._currentNodeParentId = undefined;

        this.editors = [];
        this._initWidgetEventHandlers();
        this._logger.debug('ctor finished');
    }

    InteractiveWorkspaceControl.prototype._initWidgetEventHandlers = function () {
        DeepForge.registerAction(
            BROWSE_EDITORS_TEXT,
            'add',
            10,
            () => this.openEditorBrowser()
        );
    };

    InteractiveWorkspaceControl.prototype.openEditorBrowser = async function () {
        // TODO: Create TrainKeras
        const editorInfo = InteractiveEditors.find(info => info.id === 'TrainKeras');

        const EditorPanel = await this.require(editorInfo.panel);
        if (!this.session) {
            const connectedEditor = this.editors
                .find(editor => editor.control.session);
            this.session = connectedEditor && connectedEditor.control.session.fork();
        }

        const editor = new EditorPanel(null, {
            client: this._client,
            embedded: this._embedded,
            session: this.session,
        });
        if (editor.control && editor.control.selectedObjectChanged) {
            const nodeId = await DeepForge.places.MyArtifacts();
            editor.control.selectedObjectChanged(nodeId);
        }
        this.editors.push(editor);

        this._widget.addEditor(editorInfo.title, editor);
        // TODO: Show the modal
        // TODO: If one selected, import it
    };

    InteractiveWorkspaceControl.prototype.require = function (path) {
        return new Promise((resolve, reject) => require([path], resolve, reject));
    };

    /* * * * * * * * Visualizer content update callbacks * * * * * * * */
    // One major concept here is with managing the territory. The territory
    // defines the parts of the project that the visualizer is interested in
    // (this allows the browser to then only load those relevant parts).
    InteractiveWorkspaceControl.prototype.selectedObjectChanged = function (nodeId) {
        var desc = this._getObjectDescriptor(nodeId),
            self = this;

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
            self._selfPatterns[nodeId] = {children: 0};  // Territory "rule"

            self._currentNodeParentId = desc.parentId;

            self._territoryId = self._client.addUI(self, function (events) {
                self._eventCallback(events);
            });

            // Update the territory
            self._client.updateTerritory(self._territoryId, self._selfPatterns);

            self._selfPatterns[nodeId] = {children: 1};
            self._client.updateTerritory(self._territoryId, self._selfPatterns);
        }
    };

    // This next function retrieves the relevant node information for the widget
    InteractiveWorkspaceControl.prototype._getObjectDescriptor = function (nodeId) {
        var node = this._client.getNode(nodeId),
            objDescriptor;
        if (node) {
            objDescriptor = {
                id: node.getId(),
                name: node.getAttribute(nodePropertyNames.Attributes.name),
                childrenIds: node.getChildrenIds(),
                parentId: node.getParentId(),
                isConnection: GMEConcepts.isConnection(nodeId)
            };
        }

        return objDescriptor;
    };

    /* * * * * * * * Node Event Handling * * * * * * * */
    InteractiveWorkspaceControl.prototype._eventCallback = function (events) {
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

    InteractiveWorkspaceControl.prototype._onLoad = function (gmeId) {
        var description = this._getObjectDescriptor(gmeId);
        this._widget.addNode(description);
    };

    InteractiveWorkspaceControl.prototype._onUpdate = function (gmeId) {
        var description = this._getObjectDescriptor(gmeId);
        this._widget.updateNode(description);
    };

    InteractiveWorkspaceControl.prototype._onUnload = function (gmeId) {
        this._widget.removeNode(gmeId);
    };

    InteractiveWorkspaceControl.prototype._stateActiveObjectChanged = function (model, activeObjectId) {
        if (this._currentNodeId === activeObjectId) {
            // The same node selected as before - do not trigger
        } else {
            this.selectedObjectChanged(activeObjectId);
        }
    };

    /* * * * * * * * Visualizer life cycle callbacks * * * * * * * */
    InteractiveWorkspaceControl.prototype.destroy = function () {
        DeepForge.unregisterAction(BROWSE_EDITORS_TEXT);
        this._detachClientEventListeners();
    };

    InteractiveWorkspaceControl.prototype._attachClientEventListeners = function () {
        this._detachClientEventListeners();
        WebGMEGlobal.State.on('change:' + CONSTANTS.STATE_ACTIVE_OBJECT, this._stateActiveObjectChanged, this);
    };

    InteractiveWorkspaceControl.prototype._detachClientEventListeners = function () {
        WebGMEGlobal.State.off('change:' + CONSTANTS.STATE_ACTIVE_OBJECT, this._stateActiveObjectChanged);
    };

    InteractiveWorkspaceControl.prototype.onActivate = function () {
        if (!this._embedded) {
            this._attachClientEventListeners();

            if (typeof this._currentNodeId === 'string') {
                WebGMEGlobal.State.registerActiveObject(this._currentNodeId, {suppressVisualizerFromNode: true});
            }
        }
    };

    InteractiveWorkspaceControl.prototype.onDeactivate = function () {
        if (!this._embedded) {
            this._detachClientEventListeners();
        }
    };

    return InteractiveWorkspaceControl;
});
