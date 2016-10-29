/*globals define, _*/
/*jshint browser: true*/

define([
    'panels/TextEditor/TextEditorControl',
    'deepforge/LayerParser',
    'deepforge/utils',
    'deepforge/Constants'
], function (
    TextEditorControl,
    LayerParser,
    utils,
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
            baseId = node.getBaseId(),
            base = this._client.getNode(baseId),
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
            var baseTorchType = 'nn.Module';
            // If the base type is 'Criterion', set the base type to nn.Criterion
            if (base.getAttribute('name') === 'Criterion') {
                baseTorchType = 'nn.Criterion';
            }

            desc.text = _.template(template)({
                name: desc.name,
                baseTorchType: baseTorchType
            });
        }
        return desc;
    };

    LayerEditorControl.prototype.saveTextFor = function (id, text) {
        var node = this._client.getNode(id),
            currentAttrs = node.getValidAttributeNames(),
            types,
            ctorAttrs = [],
            setterNames,
            schema,
            currentPtrs = {base: true},
            type,
            ptr,
            msg = `Updating layer definition for ${node.getAttribute('name')}`,
            i;

        // Parse the ctorAttrs and update the node!
        var layerSchema = LayerParser.parse(text);
        if (!layerSchema) {
            return TextEditorControl.prototype.saveTextFor.call(this, id, text);
        }

        if (layerSchema.params) {
            ctorAttrs = layerSchema.params;
        } else {  // inheriting __init
            ctorAttrs = this.getInheritedAttrs(layerSchema);
        }

        this._client.startTransaction(msg);

        TextEditorControl.prototype.saveTextFor.call(this, id, text, true);
        this._client.setAttribute(id, 'name', layerSchema.name);

        this._logger.debug(`Setting ctor args to ${ctorAttrs.join(',')}`);
        this._client.setAttribute(id, Constants.CTOR_ARGS_ATTR, ctorAttrs.join(','));

        types = layerSchema.types || {};
        schema = this.getPointerMeta();

        // Handle pointer types
        for (i = ctorAttrs.length; i--;) {
            type = types[ctorAttrs[i]];
            if (type && type.substring(0, 3) === 'nn.') {
                ptr = ctorAttrs.splice(i, 1)[0];
                this._client.setPointerMeta(id, ptr, schema);
                currentPtrs[ptr] = true;
            }
        }

        // Remove old pointers
        node.getPointerNames().filter(ptr => !currentPtrs[ptr])
            .forEach(ptr => this._client.delMetaPointer(id, ptr));

        // Remove old attributes
        setterNames = Object.keys(layerSchema.setters);
        _.difference(currentAttrs, ctorAttrs, setterNames)
            .forEach(attr => this._client.delAttributeMeta(id, attr));

        // Add setters
        for (i = setterNames.length; i--;) {
            schema = utils.getSetterSchema(setterNames[i], layerSchema.setters, layerSchema.defaults);
            // Get setter attr schema
            if (schema.hasOwnProperty('default')) {
                this._client.setAttribute(id, setterNames[i], schema.default);
                delete schema.default;
            }
            if (types[setterNames[i]]) {
                schema.type = types[setterNames[i]];
            }
            this._client.setAttributeMeta(id, setterNames[i], schema);
        }

        ctorAttrs.forEach(attr =>
            this._client.setAttributeMeta(id, attr, {
                type: types[attr] || 'string'
            })
        );

        this._client.completeTransaction();
    };

    LayerEditorControl.prototype.getPointerMeta = function () {
        var archNode = this._client.getAllMetaNodes()
            .find(node => node.getAttribute('name') === 'Architecture');

        if (!archNode) {
            throw 'Could not find the "Architecture" node!';
        }

        return {
            min: 1,
            max: 1,
            items: [
                {
                    id: archNode.getId(),
                    max: 1
                }
            ]
        };
    };

    LayerEditorControl.prototype.getInheritedAttrs = function (layerSchema) {
        // Get the base class
        var metanode;

        if (layerSchema.baseType) {
            this._logger.debug(`inheriting the attributes from ${layerSchema.baseType}`);

            // Get the meta node and valid attribute names
            metanode = this._client.getAllMetaNodes()
                .find(node => node.getAttribute('name') === layerSchema.baseType);

            if (metanode) {
                return metanode.getValidAttributeNames()
                    .filter(attr => attr !== 'name');
            } else {
                // Check if the type is known by torch
                this._logger.warn(`Unknown base type ${layerSchema.baseType}. Assuming attributes are []`);
            }
        }
        return [];
    };

    return LayerEditorControl;
});
