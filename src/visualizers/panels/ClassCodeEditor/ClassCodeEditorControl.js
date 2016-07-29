/*globals define */
/*jshint browser: true*/

define([
    'panels/TextEditor/TextEditorControl',
    'deepforge/lua',
    'underscore',
    'text!./DefaultCodeTemplate.ejs'
], function (
    TextEditorControl,
    lua,
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
            baseName = null,
            basePath,
            name,
            ast;

        if (match) {
            name = match[0];
        }

        // Check if the base needs to be updated
        try {
            ast = lua.parser.parse(text);
            lua.codegen.traverse(curr => {
                // Check for inheritance of the given type
                if (curr.type === 'expr.call') {
                    var object = curr.func.self.val,
                        method = curr.func.key.val,
                        child,
                        base;

                    if (object === 'torch' && method === 'class') {
                        child = curr.args[0];
                        base = curr.args[1];

                        // If the first argument is the given class, get the base
                        if (child.type === 'const.string' && child.val === name) {
                            if (base && base.type === 'const.string') {
                                baseName = base.val;
                            }
                        }
                    }
                }
            })(ast);

            // Get the base path from the base name
            basePath = this.getBasePathFromName(baseName);
            if (!basePath) {
                this._logger.warn(`Could not find base type matching the name ${baseName}`);
            }
        } catch(e) {
            this._logger.warn(`Invalid lua code. Parser failed: ${e}`);
        }

        this._client.startTransaction(`Updating class "${name || nodeName}"`);
        if (name) {
            this._client.setAttributes(id, 'name', name);
        }
        if (basePath) {
            this._client.setBase(id, basePath);
        } else {  // Set base back to 'Complex'
            while (node && (node.getAttribute('name') !== 'Complex' ||
                node.isAbstract() !== true)) {
                node = this._client.getNode(node.getBaseId());
            }

            if (node) {  // node is the base class type
                this._client.setBase(id, node.getId());
            } else {
                this._logger.warn(`Could not find the base class type from ${id}`);
            }
        }

        TextEditorControl.prototype.saveTextFor.call(this, id, text);
        this._client.completeTransaction();
    };

    ClassCodeEditorControl.prototype.getBasePathFromName = function (baseName) {
        var metanodes = this._client.getAllMetaNodes(),
            nameMatches = [],
            classNode,
            i;

        for (i = metanodes.length; i--;) {
            if (metanodes[i].getAttribute('name') === baseName) {
                nameMatches.push(metanodes[i]);
            }
            if (metanodes[i].getAttribute('name') === 'Complex') {
                classNode = metanodes[i];
            }
        }

        for (i = nameMatches.length; i--;) {
            if (this._client.isTypeOf(nameMatches[i].getId(), classNode.getId())) {
                return nameMatches[i].getId();
            }
        }

        return null;
    };

    return ClassCodeEditorControl;
});
