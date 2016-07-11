/*globals define */
/*jshint browser: true*/

define([
    'panels/TextEditor/TextEditorControl',
    'underscore',
    'text!./DefaultCodeTemplate.ejs'
], function (
    TextEditorControl,
    _,
    CODE_TEMPLATE
) {

    'use strict';

    var ClassCodeEditorControl,
        getBoilerplate = _.template(CODE_TEMPLATE);

    ClassCodeEditorControl = function (options) {
        options.attributeName = 'code';
        TextEditorControl.call(this, options);
    };

    _.extend(
        ClassCodeEditorControl.prototype,
        TextEditorControl.prototype
    );

    // input/output updates are actually activeNode updates
    ClassCodeEditorControl.prototype._onUpdate = function (id) {
        if (id === this._currentNodeId) {
            TextEditorControl.prototype._onUpdate.call(this, id);
        }
    };

    ClassCodeEditorControl.prototype._getObjectDescriptor = function (nodeId) {
        var desc = TextEditorControl.prototype._getObjectDescriptor.call(this, nodeId),
            node = this._client.getNode(nodeId),
            ownCode = node.getOwnAttribute(this.ATTRIBUTE_NAME);

        // If the 'text' attribute is not set, and it's not inheriting anything
        if (!desc.text && ownCode === undefined) {
            desc.text = getBoilerplate(desc);
        }
        return desc;
    };

    ClassCodeEditorControl.prototype.saveTextFor = function (id, text) {
        // On save, update the node's name
        // For now, simply use regex to grab the returned name
        var i = text.lastIndexOf('return') + 7,
            returned = text.substring(i),
            match = returned.match(/[a-zA-Z0-9_]+/),
            node = this._client.getNode(id),
            nodeName = node.getAttribute('name'),
            name;

        if (match) {
            name = match[0];
        }

        this._client.startTransaction(`Updating class "${name || nodeName}"`);
        if (name) {
            this._client.setAttributes(id, 'name', name);
        }
        TextEditorControl.prototype.saveTextFor.call(this, id, text);
        this._client.completeTransaction();
    };

    return ClassCodeEditorControl;
});
