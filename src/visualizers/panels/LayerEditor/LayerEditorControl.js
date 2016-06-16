/*globals define, _*/
/*jshint browser: true*/

define([
    'panels/TextEditor/TextEditorControl'
], function (
    TextEditorControl
) {

    'use strict';

    var NO_CODE_MESSAGE = '-- <%= name %> is not an editable layer!',
        LayerEditorControl;

    LayerEditorControl = function (options) {
        TextEditorControl.call(this, options);
    };

    _.extend(LayerEditorControl.prototype, TextEditorControl.prototype);

    // This next function retrieves the relevant node information for the widget
    LayerEditorControl.prototype._getObjectDescriptor = function (nodeId) {
        var desc = TextEditorControl.prototype._getObjectDescriptor.call(this, nodeId),
            node = this._client.getNode(nodeId),
            hasCode = node.getValidAttributeNames().indexOf('code') > -1,
            template;

        // Get own attribute, if set. Otherwise, set the text to the parent's populated
        // template
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

    return LayerEditorControl;
});
