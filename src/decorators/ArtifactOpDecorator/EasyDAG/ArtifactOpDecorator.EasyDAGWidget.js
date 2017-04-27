/*globals define, _*/
/*jshint browser: true, camelcase: false*/

define([
    'deepforge/Constants',
    'decorators/DcOpDecorator/EasyDAG/DcOpDecorator.EasyDAGWidget',
    'css!./ArtifactOpDecorator.EasyDAGWidget.css'
], function (
    CONSTANTS,
    DecoratorBase
) {

    'use strict';

    var ArtifactOpDecorator,
        DECORATOR_ID = 'ArtifactOpDecorator',
        CAST_OPTS = {
            ArtifactFinder: {
                ptr: 'type',
                metaTgt: true
            }
        };

    CAST_OPTS[CONSTANTS.OP.INPUT] = {
        ptr: 'artifact',
        metaTgt: false
    };

    // ArtifactOp nodes need to be able to...
    //     - dynamically change their outputs (downcast)
    ArtifactOpDecorator = function (options) {
        options.color = options.color || '#b0bec5';
        DecoratorBase.call(this, options);
        // set the opts...
        this.castOpts = CAST_OPTS[this._node.baseName];
    };

    _.extend(ArtifactOpDecorator.prototype, DecoratorBase.prototype);

    ArtifactOpDecorator.prototype.DECORATOR_ID = DECORATOR_ID;

    ArtifactOpDecorator.prototype.getTargetFilterFnFor = function() {
        var currentNode,
            pId,
            peerIds,
            currentDataId,
            targetTypeIds = [];

        // Get all connections from this node's data
        if (this._node.outputs[0]) {
            currentNode = this.client.getNode(this._node.id);
            pId = currentNode.getParentId();
            peerIds = this.client.getNode(pId).getChildrenIds();
            currentDataId = this._node.outputs[0].id;

            targetTypeIds = peerIds.map(id => this.client.getNode(id))
                .filter(node => {
                    var ptr = node.getPointer('src');
                    return ptr.to === currentDataId;
                })

                // Get the target data types
                .map(node => this.client.getNode(node.getPointer('dst').to).getMetaTypeId());
        }

        return id => {
            var node = this.client.getNode(id),
                isMetaTgt = node.getId() === node.getMetaTypeId(),
                isValidType = true;

            // make sure it is a type of the target types
            isValidType = targetTypeIds.reduce((passing, typeId) => {
                return passing && node.isTypeOf(typeId);
            }, true);

            return isValidType && isMetaTgt === this.castOpts.metaTgt;
        };
    };

    ArtifactOpDecorator.prototype.savePointer = function(name, to) {
        // When the 'artifact' pointer is changed, we should change the base
        // of the data output node to the target type
        if (typeof to !== 'string') {
            var outputId = this._node.outputs[0] && this._node.outputs[0].id;

            // Clear the data handle of the output
            this.client.startTransaction(`Removing output of ${this.name}`);
            this.client.delPointer(this._node.id, name);
            if (outputId) {
                this.client.delAttribute(outputId, 'data');
            }
            this.client.completeTransaction();
        } else if (name === this.castOpts.ptr) {  // set the casted value
            this.client.startTransaction(`Setting output of ${this.name} to ${to}`);
            this.castOutputType(to);
            this.client.setPointer(this._node.id, name, to);
            this.client.completeTransaction();
        } else {
            DecoratorBase.prototype.savePointer.call(this, name, to);
        }
    };

    ArtifactOpDecorator.prototype.getDisplayName = function() {
        var ptrName = this._node.baseName === CONSTANTS.OP.INPUT ? 'artifact' : 'type',
            id = this._node.pointers[ptrName],
            name = this.nameFor[id] || this._node.name;
        return name;
    };

    ArtifactOpDecorator.prototype.updateDisplayName = function() {
        var newName = this.getDisplayName();
        if (this.name !== newName) {
            this.name = newName;
            this.nameWidth = null;
        }
    };

    ArtifactOpDecorator.prototype.updateTargetName = function(id, name) {
        DecoratorBase.prototype.updateTargetName.apply(this, arguments);
        // Update name
        var ptrName = this._node.baseName === CONSTANTS.OP.INPUT ? 'artifact' : 'type';
        if (this._node.pointers[ptrName] === id) {
            this._name = name;
            this.onResize();
        }
    };

    ArtifactOpDecorator.prototype.expand = function() {
        this.updateDisplayName();
        DecoratorBase.prototype.expand.call(this);
    };

    ArtifactOpDecorator.prototype.condense = function() {
        this.updateDisplayName();
        DecoratorBase.prototype.condense.call(this);
    };

    return ArtifactOpDecorator;
});
