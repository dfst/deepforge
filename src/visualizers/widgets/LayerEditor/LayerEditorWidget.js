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

    return LayerEditorWidget;
});
