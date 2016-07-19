/*globals define */
/*jshint browser: true*/

define([
    'panels/TextEditor/TextEditorControl',
    'deepforge/viz/OperationControl',
    'underscore'
], function (
    TextEditorControl,
    OperationControl,
    _
) {

    'use strict';

    var OperationCodeEditorControl;

    OperationCodeEditorControl = function (options) {
        options.attributeName = 'code';
        TextEditorControl.call(this, options);
    };

    _.extend(
        OperationCodeEditorControl.prototype,
        OperationControl.prototype,
        TextEditorControl.prototype
    );

    // Override ObjectDescriptor
    OperationCodeEditorControl.prototype.TERRITORY_RULE = {children: 3};
    OperationCodeEditorControl.prototype._getObjectDescriptor = function (id) {
        var desc = TextEditorControl.prototype._getObjectDescriptor.call(this, id),
            node = this._client.getNode(id);

        // Add the inputs, outputs, references, and attributes
        desc.inputs = this.getOperationInputs(node).map(id => this.formatIO(id));
        desc.outputs = this.getOperationOutputs(node).map(id => this.formatIO(id));
        desc.references = node.getPointerNames().filter(name => name !== 'base');
        return desc;
    };

    // This will be changed when the input/output reps are updated (soon)
    OperationCodeEditorControl.prototype.formatIO = function (id) {
        // parse arguments are in the form 'arg: Type1, arg2: Type2'
        // and return [[arg1, Type1], [arg2, Type2]]
        var node = this._client.getNode(id),
            mNode = this._client.getNode(node.getMetaTypeId());

        return [node, mNode].map(n => n.getAttribute('name'));
    };

    // input/output updates are actually activeNode updates
    OperationCodeEditorControl.prototype._onUpdate = function (id) {
        if (id === this._currentNodeId || this.hasMetaName(id, 'Data')) {
            TextEditorControl.prototype._onUpdate.call(this, this._currentNodeId);
        }
    };

    // Line offset handling
    OperationCodeEditorControl.prototype.offsetNodeChanged = function (id) {
        // Create a territory for this node
        if (this._offsetUI) {
            this._client.removeUI(this._offsetUI);
        }
        this._offsetNodeId = id;
        this._offsetUI = this._client.addUI(this, this.onOffsetNodeEvents.bind(this));
        this._offsetTerritory = {};
        this._offsetTerritory[id] = {children: 0};
        this._client.updateTerritory(this._offsetUI, this._offsetTerritory);
    };

    OperationCodeEditorControl.prototype.onOffsetNodeEvents = function () {
        var node = this._client.getNode(this._offsetNodeId);
        if (node) {  // wasn't a 'delete' event
            this._widget.setLineOffset(node.getAttribute('lineOffset') || 0);
        }
    };

    OperationCodeEditorControl.prototype.destroy = function () {
        TextEditorControl.prototype.destroy.call(this);
        if (this._offsetUI) {
            this._client.removeUI(this._offsetUI);
        }
    };

    return OperationCodeEditorControl;
});
