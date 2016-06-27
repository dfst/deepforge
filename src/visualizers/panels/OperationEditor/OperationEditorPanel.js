/*globals define, WebGMEGlobal*/
/*jshint browser: true*/

define([
    'panels/TilingViz/TilingVizPanel',
    'panels/OperationCodeEditor/OperationCodeEditorPanel',
    'panels/OperationInterfaceEditor/OperationInterfaceEditorPanel',
    'js/Constants',
    'underscore'
], function (
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
        //var titleCntr = $();
        this.$panelHeaderTitle.on('dblclick', this.editTitle.bind(this));
    };

    //inherit from TilingViz
    _.extend(OperationEditorPanel.prototype, TilingViz.prototype);

    OperationEditorPanel.prototype.editTitle = function () {
        this.$panelHeaderTitle.editInPlace({
            css: {
                'z-index': 1000
            },
            onChange: (oldValue, newValue) => {
                var msg = `Renamed operation: ${oldValue} -> ${newValue}`;
                if (!/^\s*$/.test(newValue)) {
                    this._client.startTransaction(msg);
                    this._client.setAttributes(this._currentNodeId, 'name',
                        newValue);
                    this._client.completeTransaction();
                }
            }
        });
    };

    OperationEditorPanel.prototype.selectedObjectChanged = function (id) {
        this._currentNodeId = id;
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
