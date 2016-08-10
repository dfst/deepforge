/*globals define, _*/
/*jshint browser: true*/

define([
    'panels/TextEditor/TextEditorControl',
    'deepforge/Constants'
], function (
    TextEditorControl,
    Constants
) {

    'use strict';

    var NO_CODE_MESSAGE = '-- <%= name %> is not an editable layer!',
        LayerEditorControl;

    LayerEditorControl = function (options) {
        TextEditorControl.call(this, options);
    };

    _.extend(LayerEditorControl.prototype, TextEditorControl.prototype);

    LayerEditorControl.prototype.loadMetaNodes = function () {
        return this._client.getAllMetaNodes();
    };

    // This next function retrieves the relevant node information for the widget
    LayerEditorControl.prototype._getObjectDescriptor = function (nodeId) {
        var desc = TextEditorControl.prototype._getObjectDescriptor.call(this, nodeId),
            node = this._client.getNode(nodeId),
            hasCode = node.getValidAttributeNames().indexOf('code') > -1,
            template;

        // Get own attribute, if set. Otherwise, set the text to the parent's populated
        // template
        this.loadMetaNodes();
        if (hasCode) {  // is a custom layer
            if (!node.getOwnAttribute('code')) {
                // Retrieve the template from the mixin
                template = node.getMixinPaths()
                    .map(id => this._client.getNode(id).getAttribute('code'))
                    .find(code => !!code) || NO_CODE_MESSAGE;
            }
        } else {
            template = NO_CODE_MESSAGE;
        }

        if (template) {
            desc.text = _.template(template)(desc);
        }
        return desc;
    };

    LayerEditorControl.prototype.saveTextFor = function (id, text) {
        var r = /:__init\((.*)\)/,
            match = text.match(r),
            textMatch = match && match[1],
            node = this._client.getNode(id),
            currentAttrs = node.getValidAttributeNames(),
            attributes = [],
            msg = `Updating layer definition for ${node.getAttribute('name')}`;

        // Parse the attributes and update the node!
        if (textMatch) {
            attributes = textMatch.split(',')
                .map(arg => arg.replace(/\s+/g, ''))  // trim white space
                .filter(arg => !!arg);  // no empty strings!
        } else {  // inheriting __init
            attributes = this.getInheritedAttrs(text);
        }

        this._client.startTransaction(msg);

        TextEditorControl.prototype.saveTextFor.call(this, id, text);

        // Remove old attributes
        _.difference(currentAttrs, attributes)
            .forEach(attr => this._client.removeAttributeSchema(id, attr));

        attributes.forEach(attr =>
            this._client.setAttributeSchema(id, attr, {type: 'string'}));

        this._logger.debug(`Setting ctor args to ${attributes.join(',')}`);
        this._client.setAttributes(id, Constants.CTOR_ARGS_ATTR, attributes.join(','));
        this._client.completeTransaction();
    };

    LayerEditorControl.prototype.getInheritedAttrs = function (code) {
        // Get the base class
        var r = /torch.class\((.*)\)/,
            match = code.match(r),
            baseType,
            metanode,
            textMatch = match && match[1];

        if (textMatch) {
            baseType = textMatch.split(',')[1]
                .replace(/^\s*['"]nn\./, '')
                .replace(/['"]\s*$/, '');

            this._logger.debug(`inheriting the attributes from ${baseType}`);

            // Get the meta node and valid attribute names
            metanode = this._client.getAllMetaNodes()
                .find(node => node.getAttribute('name') === baseType);

            if (metanode) {
                return metanode.getValidAttributeNames()
                    .filter(attr => attr !== 'name');
            } else {
                // Check if the type is known by torch
                this._logger.warn(`Unknown base type ${baseType}. Assuming attributes are []`);
            }
        }
        return [];
    };

    return LayerEditorControl;
});
