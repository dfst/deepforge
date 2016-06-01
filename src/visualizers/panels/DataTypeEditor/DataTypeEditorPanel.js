/*globals define */
/*jshint browser: true*/

define([
    'panels/TilingViz/TilingVizPanel',
    'panels/SerializeEditor/SerializeEditorPanel',
    'panels/DeserializeEditor/DeserializeEditorPanel',
    'underscore'
], function (
     TilingViz,
     SerializeEditor,
     DeserializeEditor,
     _
) {
    'use strict';

    var DataTypeEditorPanel;

    DataTypeEditorPanel = function (layoutManager, params) {
        TilingViz.call(this, layoutManager, params);
    };

    //inherit from PanelBaseWithHeader
    _.extend(DataTypeEditorPanel.prototype, TilingViz.prototype);

    DataTypeEditorPanel.prototype.getPanels = function () {
        return [SerializeEditor, DeserializeEditor];
    };

    return DataTypeEditorPanel;
});
