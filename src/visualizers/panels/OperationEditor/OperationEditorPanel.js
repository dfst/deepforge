/*globals define, WebGMEGlobal*/
/*jshint browser: true*/

define([
    'deepforge/globals',
    'deepforge/viz/RenameablePanel',
    'panels/TilingViz/TilingVizPanel',
    'panels/OperationCodeEditor/OperationCodeEditorPanel',
    'panels/OperationInterfaceEditor/OperationInterfaceEditorPanel',
    'js/Constants',
    'underscore'
], function (
    DeepForge,
    RenameablePanel,
    TilingViz,
    CodeEditor,
    InterfaceEditor,
    CONSTANTS,
    _
) {
    'use strict';

    var OperationEditorPanel;

    OperationEditorPanel = function (layoutManager, params) {
        TilingViz.call(this, layoutManager, params);
        this.initialize();
    };

    OperationEditorPanel.prototype.initialize = function () {
        this.territory = {};
        this.territoryId = null;
        this._currentNodeId = null;

        this.control = this;

        // Set the editable title on node change
        this.initializeRenameable();
    };

    //inherit from TilingViz
    _.extend(
        OperationEditorPanel.prototype,
        RenameablePanel.prototype,
        TilingViz.prototype
    );

    OperationEditorPanel.prototype.selectedObjectChanged = function (id) {
        this._currentNodeId = id;
        DeepForge.last.Operation = id;
        if (typeof this._currentNodeId === 'string') {
            // Setup the territory
            this.territory = {};
            this.territory[this._currentNodeId] = {children: 0};
            this.territoryId = this._client.addUI(this, this._eventCallback.bind(this));
            this._client.updateTerritory(this.territoryId, this.territory);
        }
        TilingViz.prototype.selectedObjectChanged.call(this, id);
    };

    OperationEditorPanel.prototype._eventCallback = function (events) {
        events = events.find(e => e.eid === this._currentNodeId);
        this.updateTitle();
    };

    OperationEditorPanel.prototype.updateTitle = function () {
        var id = this._currentNodeId,
            node = this._client.getNode(id),
            name = node && node.getAttribute('name');

        this.setTitle(name || '');
    };

    OperationEditorPanel.prototype.getPanels = function () {
        return [InterfaceEditor, CodeEditor];
    };

    OperationEditorPanel.prototype.onDeactivate = function () {
        WebGMEGlobal.State.off('change:' + CONSTANTS.STATE_ACTIVE_OBJECT,
            this._stateActiveObjectChanged);

        if (this.territoryId) {
            this._client.removeUI(this.territoryId);
        }

        TilingViz.prototype.onDeactivate.call(this);
    };

    return OperationEditorPanel;
});
