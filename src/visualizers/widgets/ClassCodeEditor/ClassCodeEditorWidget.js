/*globals define */
/*jshint browser: true*/

define([
    'widgets/TextEditor/TextEditorWidget',
    'underscore'
], function (
    TextEditorWidget,
    _
) {
    'use strict';

    var ClassCodeEditorWidget;

    ClassCodeEditorWidget = function (logger, container) {
        TextEditorWidget.call(this, logger, container);
    };

    _.extend(ClassCodeEditorWidget.prototype, TextEditorWidget.prototype);

    ClassCodeEditorWidget.prototype.getHeader = function(desc) {
        return [
            `-- The class definition for ${desc.name}`
        ].join('\n');
    };

    ClassCodeEditorWidget.prototype.updateNode = function() {
        // nop
    };

    return ClassCodeEditorWidget;
});
