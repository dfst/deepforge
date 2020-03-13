/*globals define, WebGMEGlobal*/
/*jshint browser: true*/

define([
    'deepforge/globals',
    'deepforge/viz/RenameablePanel',
    'panels/TilingViz/TilingVizPanel',
    'panels/OperationCodeEditor/OperationCodeEditorPanel',
    'panels/OperationSecondaryEditor/OperationSecondaryEditorPanel',
    'deepforge/viz/OperationControl',
    'js/Constants',
    'underscore'
], function (
    DeepForge,
    RenameablePanel,
    TilingViz,
    CodeEditor,
    SecondaryEditor,
    OperationControl,
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
        OperationControl.prototype,
        TilingViz.prototype
    );

    OperationEditorPanel.prototype.selectedObjectChanged = function (id) {
        this._currentNodeId = id;
        DeepForge.last.Operation = id;
        TilingViz.prototype.selectedObjectChanged.call(this, id);
    };

    OperationEditorPanel.prototype.editTitle = function () {
        this.$panelHeaderTitle.editInPlace({
            css: {
                'z-index': 1000
            },
            onChange: (oldValue, newValue) => {
                var nodeId = this.currentNodeId(),
                    type = this.currentBaseName(),
                    words = newValue.split(' '),
                    msg;

                if (words.length > 1) {
                    newValue = words.map(word => word[0].toUpperCase() + word.substring(1)).join('');
                }

                msg = `Renamed ${type}: ${oldValue} -> ${newValue}`;

                if (!/^\s*$/.test(newValue)) {
                    this._client.startTransaction(msg);
                    // Update the operation code
                    this.updateCode(operation => operation.setName(newValue));
                    this._client.setAttribute(nodeId, 'name', newValue);
                    this._client.completeTransaction();
                }
            }
        });
    };

    OperationEditorPanel.prototype.getPanels = function () {
        return [CodeEditor, SecondaryEditor];
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
