/*globals define, _*/
/*jshint browser: true, camelcase: false*/

/**
 * @author brollb / https://github.com/brollb
 */

define([
    'js/Constants',
    'decorators/OperationDecorator/EasyDAG/OperationDecorator.EasyDAGWidget',
    'css!./DcOpDecorator.EasyDAGWidget.css'
], function (
    CONSTANTS,
    DecoratorBase
) {

    'use strict';

    var DcOpDecorator,
        DECORATOR_ID = 'DcOpDecorator';

    // DcOp nodes need to be able to...
    //     - dynamically change their outputs (downcast)
    DcOpDecorator = function (options) {
        options.color = options.color || '#78909c';
        DecoratorBase.call(this, options);
    };

    _.extend(DcOpDecorator.prototype, DecoratorBase.prototype);

    DcOpDecorator.prototype.DECORATOR_ID = DECORATOR_ID;

    DcOpDecorator.prototype.getTargetFilterFnFor = function() {
        return id => {
            var node = this.client.getNode(id);
            return node.getId() !== node.getMetaTypeId();  // not meta node
        };
    };

    DcOpDecorator.prototype.savePointer = function(name, to) {
        // When the 'artifact' pointer is changed, we should change the base
        // of the data output node to the target type
        if (name === 'artifact' && (typeof to === 'string')) {
            var output = this._node.outputs[0];

            this.client.startTransaction(`Setting output of ${this.name} to ${to}`);
            if (!output) {
                // create the output node
                this._createOutputNode(to);
            } else {
                this.client.makePointer(output.id, CONSTANTS.POINTER_BASE, to);
            }

            // 'cast' the output node to the correct type
            this.client.makePointer(this._node.id, name, to);
            this.client.completeTransaction();
        } else {
            DecoratorBase.prototype.savePointer.call(this, name, to);
        }
    };

    DcOpDecorator.prototype._createOutputNode = function(baseId) {
        // Get the outputCntrId
        // TOOD
        var n = this.client.getNode(this._node.id),
            outputCntrId;

        outputCntrId = n.getChildrenIds().find(id => {
            var metaTypeId = this.client.getNode(id).getMetaTypeId(),
                metaType = this.client.getNode(metaTypeId);

            if (!metaType) {
                this.logger.error(`Could not check the type of ${id}!`);
                return false;
            }
            return metaType.getAttribute('name') === 'Outputs';
        });

        this.client.createChild({
            baseId: baseId,
            parentId: outputCntrId
        });
    };

    return DcOpDecorator;
});
