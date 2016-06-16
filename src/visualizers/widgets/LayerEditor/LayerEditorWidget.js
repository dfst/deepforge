/*globals define, WebGMEGlobal*/
/*jshint browser: true*/

define([
    'widgets/TextEditor/TextEditorWidget'
], function (
    TextEditorWidget
) {
    'use strict';

    var LayerEditorWidget;

    LayerEditorWidget = function () {
        TextEditorWidget.apply(this, arguments);
    };

    LayerEditorWidget.prototype.addNode = function(desc) {
        // Update the text value of the given node
        // TODO
        TextEditorWidget.prototype.addNode.call(this, desc);
    };

    return LayerEditorWidget;
});
