/*globals define, _*/
/*jshint browser: true*/

define([
    'widgets/TextEditor/TextEditorWidget',
    'css!./styles/LogViewerWidget.css'
], function (
    TextEditorWidget
) {
    'use strict';

    var LogViewerWidget,
        ANSI_COLORS = [
            'black',
            'red',
            'green',
            'yellow',
            'blue',
            'magenta',
            'cyan',
            'gray'
        ];

    LogViewerWidget = function () {
        this.readOnly = true;
        TextEditorWidget.apply(this, arguments);
        this._el.addClass('log-viewer');
        this.editor.setTheme('ace/theme/twilight');
        this.editor.setShowPrintMargin(false);
        this.editor.renderer.setScrollMargin(0, 75);
        this.addKeyListeners();

        // Override the textlayer to add support for ansi colors
        this.customizeAce();
    };

    _.extend(LogViewerWidget.prototype, TextEditorWidget.prototype);

    LogViewerWidget.prototype.addKeyListeners = function() {
        // Need to add key listeners to the container itself since ace is in read-only mode
        this._el.on('keydown', event => {
            // ctrl-alt-pagedown -> EOF
            if (event.key === 'PageDown' && event.altKey && (event.ctrlKey || event.metaKey)) {
                this.editor.gotoLine(Infinity);
                event.stopPropagation();
                event.preventDefault();
            }
            // ctrl-alt-pagedown -> beginning of file
            if (event.key === 'PageUp' && event.altKey && (event.ctrlKey || event.metaKey)) {
                this.editor.gotoLine(0);
                event.stopPropagation();
                event.preventDefault();
            }
        });
    };

    LogViewerWidget.prototype.getHeader = function(desc) {
        return `Console logging for Operation "${desc.name}":\n`;
    };

    LogViewerWidget.prototype.customizeAce = function() {
        var textLayer = this.editor.renderer.$textLayer,
            renderToken = textLayer.$renderToken;

        textLayer.$renderToken = function(builder, col, token, value) {
            // check for ansi color
            var ansiBuilder = LogViewerWidget.renderAnsiFromText(value),
                newToken;

            for (var i = 1; i < ansiBuilder.length; i+= 3) {
                builder.push(ansiBuilder[i-1]);
                value = ansiBuilder[i];
                newToken = {
                    type: token.type,
                    value: value
                };
                col = renderToken.call(this, builder, col, newToken, value);
                builder.push(ansiBuilder[i+1]);
            }

            return col;
        };
    };

    // Get the editor text and update wrt ansi colors
    LogViewerWidget.renderAnsiFromText = function(remaining) {
        var r = /\[[0-6][0-9]?(;[0-9]([0-7]))?m/,
            match,
            ansiCode,
            text,
            color,
            nextColor = 'default',
            builder = [];

        color = color || nextColor;
        while (remaining) {
            match = remaining.match(r);
            if (match) {
                ansiCode = match[0];
                if (match[1] && match[1][1] === '3') {  // foreground color
                    nextColor = ANSI_COLORS[match[2]] || null;
                }
                text = remaining.substring(0, match.index);
                remaining = remaining.substring(match.index+ansiCode.length);
            } else {
                text = remaining;
                remaining = '';
            }

            // Add a "span" node w/ the appropriate color class
            builder.push(`<span class='ansi-${color}'>`, text, '</span>');

            color = nextColor;
            nextColor = 'default';
        }
        return builder;
    };

    LogViewerWidget.prototype.getSessionOptions = function() {
        return {
            firstLineNumber: -1
        };
    };

    LogViewerWidget.prototype.addNode = function (desc) {
        var atEOF = this.editor.getLastVisibleRow()+1 ===
            this.editor.session.getLength();

        TextEditorWidget.prototype.addNode.call(this, desc);

        if (atEOF) {  // Scroll to bottom
            this.editor.gotoLine(Infinity);
        }
    };

    LogViewerWidget.prototype.getEditorOptions = function() {
        return {
            fontFamily: 'bitstream vera sans mono',
            fontSize: '10pt'
        };
    };

    return LogViewerWidget;
});
