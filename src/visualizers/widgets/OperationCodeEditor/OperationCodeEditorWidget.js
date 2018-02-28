/*globals define */
/*jshint browser: true*/

define([
    'widgets/TextEditor/TextEditorWidget',
    'underscore',
    'css!./styles/OperationCodeEditorWidget.css'
], function (
    TextEditorWidget,
    _
) {
    'use strict';

    var OperationCodeEditorWidget;
        //WIDGET_CLASS = 'operation-editor';

    OperationCodeEditorWidget = function (logger, container) {
        TextEditorWidget.call(this, logger, container);
        this.lineOffset = 0;
        // Add the shift-enter command
        this.editor.commands.addCommand({
            name: 'executeOrStopJob',
            bindKey: {
                mac: 'Shift-Enter',
                win: 'Shift-Enter'
            },
            exec: () => this.executeOrStopJob()
        });
    };

    _.extend(OperationCodeEditorWidget.prototype, TextEditorWidget.prototype);

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
        TextEditorWidget.prototype.addNode.call(this, desc);
        this.updateOffset();
    };

    OperationCodeEditorWidget.prototype.setLineOffset = function (offset) {
        if (this.lineOffset !== offset) {
            this.lineOffset = offset;
            this.updateOffset();
        }
    };

    OperationCodeEditorWidget.prototype.updateOffset = function () {
        var lines,
            actualOffset;

        lines = this.currentHeader.match(/\n/g);
        actualOffset = this.lineOffset - (lines ? lines.length : 0);
        this.editor.setOption('firstLineNumber', actualOffset);
    };

    OperationCodeEditorWidget.prototype.getCompleter = function () {
        var completer = TextEditorWidget.prototype.getCompleter.call(this),
            getBasicCompletions = completer.getCompletionsFor,
            self = this;

        // TODO: update completions for python stuff
        completer.getCompletionsFor = function(obj) {
            if (obj === 'attributes') {
                return self.getOperationAttributes().map(attr => {
                    return {
                        name: attr,
                        value: attr,
                        score: 4,
                        meta: 'operation'
                    };
                });
            } else {
                return getBasicCompletions.apply(this, arguments);
            }
        };
        return completer;
    };

    return OperationCodeEditorWidget;
});
