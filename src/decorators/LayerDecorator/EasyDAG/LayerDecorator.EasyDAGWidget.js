/*globals define, _, WebGMEGlobal*/
/*jshint browser: true, camelcase: false*/

define([
    'decorators/EllipseDecorator/EasyDAG/EllipseDecorator.EasyDAGWidget',
    'deepforge/Constants',
    './LayerField'
], function (
    EllipseDecorator,
    Constants,
    LayerField
) {

    'use strict';

    var LayerDecorator,
        DECORATOR_ID = 'LayerDecorator';

    // Layer nodes need to be able to...
    //     - show their ports
    //     - highlight ports
    //     - unhighlight ports
    //     - report the location of specific ports
    LayerDecorator = function (options) {
        options.skipAttributes = {name: true};
        options.skipAttributes[Constants.CTOR_ARGS_ATTR] = true;
        EllipseDecorator.call(this, options);
    };

    _.extend(LayerDecorator.prototype, EllipseDecorator.prototype);

    LayerDecorator.prototype.DECORATOR_ID = DECORATOR_ID;
    LayerDecorator.prototype.PointerField = LayerField;
    LayerDecorator.prototype.getDisplayName = function() {
        return this._node.name;
    };

    // Create the pointer fields and change the event handlers
    LayerDecorator.prototype.createPointerFields = function() {
        var i = this.fields.length,
            y,
            ptr;

        // Get the fields
        y = EllipseDecorator.prototype.createPointerFields.apply(this, arguments);
        while (i < this.fields.length) {
            // Update the event handlers
            ptr = this.fields[i].name;
            // TODO: This should be changed in EasyDAG
            this.fields[i].selectTarget = this.getValidNestedLayers.bind(this, ptr);
            i++;
        }
        return y;
    };

    LayerDecorator.prototype.getValidNestedLayers = function(ptr) {
        var tgtId = this._node.pointers[ptr];
        if (tgtId) {
            WebGMEGlobal.State.registerActiveObject(tgtId);
        } else {
            this.createLayerArg(ptr);
        }
    };

    LayerDecorator.prototype.createLayerArg = function(ptr) {
        // Find the Architecture node type
        var metanodes = this.client.getAllMetaNodes(),
            base = metanodes.find(node => node.getAttribute('name') === 'Architecture'),
            baseId,
            msg = `Creating layers for "${ptr}" of ${this._node.name}`,
            tgtId;

        if (!base) {
            return this.logger.error('Could not find "Architecture" type!');
        }

        // Create a nested "architecture" node and set the ptr target to it
        baseId = base.getId();
        this.client.startTransaction(msg);
        tgtId = this.client.createNode({
            parentId: this._node.id,
            baseId: baseId
        });
        this.client.setAttribute(tgtId, 'name', `${ptr} (${this._node.name})`);
        this.savePointer(ptr, tgtId);
        this.client.completeTransaction();
        WebGMEGlobal.State.registerActiveObject(tgtId);
    };

    LayerDecorator.prototype.savePointer = function(ptr, to) {
        if (!to) {  // delete the current target
            var currentId = this._node.pointers[ptr],
                name = this._node.name;

            // If the target is contained in the current node, delete it!
            if (currentId.indexOf(this._node.id) === 0) {
                this.client.startTransaction(`Removing layer for ${ptr} of ${name}`);
                this.client.deleteNode(currentId);
                this.client.completeTransaction();
                this.logger.info(`Removed ${ptr} and deleted target (${currentId})`);
            } else {
                this.logger.info(`Removed ${ptr} (external architecture)`);
            }
        } else {  // create and set the node
            EllipseDecorator.prototype.savePointer.apply(this, arguments);
        }
    };

    return LayerDecorator;
});
