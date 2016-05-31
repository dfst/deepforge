/*globals define, */
/*jshint browser: true*/

define([
    'panels/TilingViz/TilingVizPanel',
    'panels/OperationCodeEditor/OperationCodeEditorPanel',
    'panels/OperationInterfaceEditor/OperationInterfaceEditorPanel',
    'underscore'
], function (
    TilingViz,
    CodeEditor,
    InterfaceEditor,
    _
) {
    'use strict';

    var OperationEditorPanel;

    OperationEditorPanel = function (layoutManager, params) {
        TilingViz.call(this, layoutManager, params);
    };

    //inherit from TilingViz
    _.extend(OperationEditorPanel.prototype, TilingViz.prototype);

    OperationEditorPanel.prototype.getPanels = function () {
        return [CodeEditor, InterfaceEditor];
    };

    return OperationEditorPanel;
});
