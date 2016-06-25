/*globals define */
/*jshint browser: true*/

define([
    'panels/TilingViz/TilingVizPanel',
    'panels/ClassCodeEditor/ClassCodeEditorPanel',
    'underscore'
], function (
     TilingViz,
     ClassCodeEditor,
     _
) {
    'use strict';

    var ClassEditorPanel;

    ClassEditorPanel = function (layoutManager, params) {
        TilingViz.call(this, layoutManager, params);
    };

    //inherit from PanelBaseWithHeader
    _.extend(ClassEditorPanel.prototype, TilingViz.prototype);

    ClassEditorPanel.prototype.getPanels = function () {
        return [ClassCodeEditor];
    };

    return ClassEditorPanel;
});
