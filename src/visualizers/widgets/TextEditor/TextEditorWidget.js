/*globals $, define*/
/*jshint browser: true*/

define([
    './lib/ace',
    'underscore',
    'css!./styles/TextEditorWidget.css'
], function (
    ace,
    _
) {
    'use strict';

    var TextEditorWidget,
        WIDGET_CLASS = 'text-editor';

    TextEditorWidget = function (logger, container) {
        this._logger = logger.fork('Widget');

        this._el = container;
        this._el.css({height: '100%'});
        this.$editor = $('<div/>');
        this.$editor.css({height: '100%'});
        this._el.append(this.$editor[0]);

        this.readOnly = this.readOnly || false;
        this.editor = ace.edit(this.$editor[0]);

        // Get the config from component settings for themes
        this.editor.getSession().setOptions(this.getSessionOptions());
        this.editor.setOptions(this.getEditorOptions());
        this.editor.$blockScrolling = Infinity;
        this.DELAY = 750;
        // this.editor.setTheme('ace/theme/monokai');

        this.editor.on('input', _.debounce(this.saveText.bind(this), this.DELAY));
        this.setReadOnly(this.readOnly);
        this.currentHeader = '';
        this.activeNode = null;
        this._initialize();

        this._logger.debug('ctor finished');
    };

    TextEditorWidget.prototype.getEditorOptions = function () {
        return {
            fontSize: '12pt'
        };
    };

    TextEditorWidget.prototype.getSessionOptions = function () {
        return {
            mode: 'ace/mode/lua',
            tabSize: 3,
            useSoftTabs: true
        };
    };

    TextEditorWidget.prototype._initialize = function () {
        // set widget class
        this._el.addClass(WIDGET_CLASS);
    };

    TextEditorWidget.prototype.onWidgetContainerResize = function () {
        this.editor.resize();
    };

    // Adding/Removing/Updating items
    TextEditorWidget.prototype.getHeader = function (desc) {
        return `-- Editing "${desc.name}"`;
    };

    TextEditorWidget.prototype.addNode = function (desc) {
        // Set the current text based on the given
        // Create the header
        var header = this.getHeader(desc);

        this.activeNode = desc.id;
        this.editor.setValue(header + '\n' + desc.text, 2);
        this.currentHeader = header;
    };

    TextEditorWidget.prototype.saveText = function () {
        var text;

        if (this.readOnly) {
            return;
        }

        text = this.editor.getValue().replace(this.currentHeader + '\n', '');
        if (typeof this.activeNode === 'string') {
            this.saveTextFor(this.activeNode, text);
        } else {
            this._logger.error(`Active node is invalid! (${this.activeNode})`);
        }
    };

    TextEditorWidget.prototype.removeNode = function (gmeId) {
        if (this.activeNode === gmeId) {
            this.editor.setValue('');
            this.activeNode = null;
        }
    };

    TextEditorWidget.prototype.updateNode = function (desc) {
        // Check for header changes
        if (this.readOnly) {
            this.addNode(desc);
        } else if (this.activeNode === desc.id &&
            this.getHeader(desc) !== this.currentHeader) {
            this.addNode(desc);
        }
        // TODO: Handle concurrent editing... Currently, last save wins and there are no
        // updates after opening the node. Supporting multiple users editing the same
        // operation/layer is important but more work than it is worth for now
        //var currentText = this.editor.getValue().replace(this.currentHeader, '');
        //if (this.activeNode === desc.id && desc.text !== currentText) {
            //this.addNode(desc);
        //}
    };

    /* * * * * * * * Visualizer life cycle callbacks * * * * * * * */
    TextEditorWidget.prototype.destroy = function () {
        this.editor.destroy();
    };

    TextEditorWidget.prototype.onActivate = function () {
        this._logger.debug('TextEditorWidget has been activated');
    };

    TextEditorWidget.prototype.onDeactivate = function () {
        this._logger.debug('TextEditorWidget has been deactivated');
    };

    TextEditorWidget.prototype.setReadOnly = function (isReadOnly) {
        this.readOnly = isReadOnly;
        this.editor.setReadOnly(isReadOnly);
    };

    return TextEditorWidget;
});
