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
        var inputs = desc.inputs.map(pair => `-- ${pair[0]} (${pair[1]})`).join('\n'),
            refs = desc.references.map(name => `-- ${name}`).join('\n'),
            header = [
                `-- Editing "${desc.name}" Implementation`
            ];

        if (inputs.length) {
            header.push('--');
            header.push('-- Defined variables:');
            header.push(inputs);
        }
        if (refs) {
            header.push(refs);
        }
        header.push('--');
        header.push('-- The following will be executed when the operation is run:');

        return header.join('\n');
    };

    OperationCodeEditorWidget.prototype.canAddReturnTmpl = function (desc) {
        return desc.outputs.length &&
            (!desc.ownText || desc.ownText.indexOf('return') === -1);
    };

    OperationCodeEditorWidget.prototype.updateText = function (desc) {
        if (this.canAddReturnTmpl(desc)) {
            // Add the return template 
            desc.text += '\n\nreturn {\n' +
                desc.outputs.map((pair, i) =>
                    `   ${pair[0]} = nil${i === desc.outputs.length-1 ? '' : ','}  -- ${pair[1]}`).join('\n') +
                '\n}';
                
        }
    };

    OperationCodeEditorWidget.prototype.addNode = function (desc) {
        this.updateText(desc);
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
