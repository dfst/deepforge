/*globals define */
/*jshint browser: true*/

define([
    'widgets/TextEditor/TextEditorWidget',
    'underscore',
    'css!./styles/SerializeEditorWidget.css'
], function (
    TextEditorWidget,
    _
) {
    'use strict';

    var SerializeEditorWidget;
        //WIDGET_CLASS = 'serialize-editor';

    SerializeEditorWidget = function (logger, container) {
        TextEditorWidget.call(this, logger, container);
        this._name = null;
    };

    _.extend(SerializeEditorWidget.prototype, TextEditorWidget.prototype);

    SerializeEditorWidget.prototype.getHeader = function(desc) {
        this._name = desc.name;
        return this.comment([
            `The serialization function for ${desc.name}`,
            'Globals:',
            '  `path` - target filename',
            `  \`data\` - the ${desc.name} to store`
        ].join('\n'));
    };

    SerializeEditorWidget.prototype.getNameRegex = function () {
        return /The serialization function for (.*)/;
    };

    SerializeEditorWidget.prototype.getName = function () {
        var text = this.editor.getValue(),
            r = this.getNameRegex(),
            match = text.match(r);

        return match && match[1].replace(/\s+$/, '');
    };

    SerializeEditorWidget.prototype.saveText = function () {
        var name = this.getName();

        if (this.readOnly) {
            return;
        }

        if (name && this._name !== name) {
            this.setName(name);
        }
        TextEditorWidget.prototype.saveText.call(this);
    };

    SerializeEditorWidget.prototype.updateNode = function(desc) {
        if (this._name !== desc.name) {
            // Check if the name updated. If so, update the text
            this.addNode(desc);
        }
    };

    return SerializeEditorWidget;
});
