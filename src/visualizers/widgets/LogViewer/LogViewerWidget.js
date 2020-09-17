/*globals define, _, monaco*/
/*jshint browser: true*/

define([
    'widgets/TextEditor/TextEditorWidget',
    'css!./styles/LogViewerWidget.css'
], function (
    TextEditorWidget
) {
    'use strict';

    const LogViewerWidget = function () {
        this.readOnly = true;
        TextEditorWidget.apply(this, arguments);
        this._el.addClass('log-viewer');
        this.editor.updateOptions({
            lineNumbers: this.getLineNumbers
        });
        this.setReadOnly(true);
    };

    _.extend(LogViewerWidget.prototype, TextEditorWidget.prototype);

    LogViewerWidget.prototype.getHeader = function(desc) {
        return `Console logging for Operation "${desc.name}":\n`;
    };

    LogViewerWidget.prototype.getLineNumbers = function(lineno) {
        return lineno - 2;
    };

    LogViewerWidget.prototype.addNode = function(desc) {
        TextEditorWidget.prototype.addNode.call(this, desc);
        const revealLineno = Math.ceil(this.model.getLineCount()/2);
        this.editor.revealLineInCenter(
            revealLineno,
            monaco.editor.ScrollType.Smooth
        );
    };

    LogViewerWidget.prototype.getDefaultEditorOptions = function() {
        const opts = TextEditorWidget.prototype.getDefaultEditorOptions.call(this);
        opts.fontSize = 10;
        return opts;
    };

    LogViewerWidget.prototype.getMenuItemsFor = function() {
        const menu = TextEditorWidget.prototype.getMenuItemsFor.call(this);
        delete menu.setKeybindings;
        return menu;
    };

    return LogViewerWidget;
});
