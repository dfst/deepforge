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

    DcOpDecorator.prototype.castOutputType = function(targetId) {
        var target = this.client.getNode(targetId),
            baseId = target.getBaseId(),
            outputId = this._node.outputs[0] && this._node.outputs[0].id,
            hash;

        if (!outputId) {  // create the output node
            outputId = this._createOutputNode(baseId);
        }
        // Copy the data content to the output node
        hash = target.getAttribute('data');
        this.client.setAttribute(outputId, 'data', hash);

        const type = target.getAttribute('type');
        this.client.setAttribute(outputId, 'type', type);
    };

    DcOpDecorator.prototype._createOutputNode = function(baseId) {
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

        return this.client.createNode({
            baseId: baseId,
            parentId: outputCntrId
        });
    };

    return DcOpDecorator;
});
