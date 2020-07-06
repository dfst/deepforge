/*globals define */
/*jshint browser: true*/

define([
    'widgets/MonacoEditor/MonacoEditorWidget',
    'underscore',
    'css!./styles/OperationCodeEditorWidget.css'
], function (
    MonacoEditorWidget,
    _
) {
    'use strict';

    var OperationCodeEditorWidget;
        //WIDGET_CLASS = 'operation-editor';

    OperationCodeEditorWidget = function (logger, container) {
        MonacoEditorWidget.call(this, logger, container);
        this.lineOffset = 0;
        this.editor.addCommand(
            monaco.KeyMod.Shift | monaco.KeyCode.Enter,
            this.executeOrStopJob
        );
        this.editor.updateOptions({
            lineNumbers: this.updateOffset.bind(this)
        });
    };

    _.extend(OperationCodeEditorWidget.prototype, MonacoEditorWidget.prototype);

    OperationCodeEditorWidget.prototype.getHeader = function (desc) {
        // Add comment about the inputs, attributes and references
        var header = [
            `Editing "${desc.name}" Implementation`
        ];

        header.push('');
        header.push('The \'execute\' method will be called when the operation is run');

        return this.comment(header.join('\n'));
    };

    OperationCodeEditorWidget.prototype.addNode = function (desc) {
        MonacoEditorWidget.prototype.addNode.call(this, desc);
    };

    OperationCodeEditorWidget.prototype.setLineOffset = function (offset) {
        if (this.lineOffset !== offset) {
            this.lineOffset = offset;
        }
    };

    OperationCodeEditorWidget.prototype.updateOffset = function (originalLineNumber) {
        var lines,
            actualOffset;

        lines = this.currentHeader.match(/\n/g);
        actualOffset = this.lineOffset - (lines ? lines.length + 1 : 0);
        return (originalLineNumber + actualOffset);
    };

    return OperationCodeEditorWidget;
});
