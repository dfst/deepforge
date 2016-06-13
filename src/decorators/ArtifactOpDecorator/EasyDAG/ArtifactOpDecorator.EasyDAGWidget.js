/*globals define, _*/
/*jshint browser: true, camelcase: false*/

/**
 * @author brollb / https://github.com/brollb
 */

define([
    'js/Constants',
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
            ArtifactLoader: {
                ptr: 'artifact',
                metaTgt: false
            },
            ArtifactFinder: {
                ptr: 'type',
                metaTgt: true
            }
        };

    // ArtifactOp nodes need to be able to...
    //     - dynamically change their outputs (downcast)
    ArtifactOpDecorator = function (options) {
        options.color = options.color || '#78909c';
        DecoratorBase.call(this, options);
        // set the opts...
        this.castOpts = CAST_OPTS[this._node.baseName];
    };

    _.extend(ArtifactOpDecorator.prototype, DecoratorBase.prototype);

    ArtifactOpDecorator.prototype.DECORATOR_ID = DECORATOR_ID;

    ArtifactOpDecorator.prototype.getTargetFilterFnFor = function() {
        return id => {
            var node = this.client.getNode(id),
                isMetaTgt = node.getId() === node.getMetaTypeId();
            return isMetaTgt === this.castOpts.metaTgt;
        };
    };

    ArtifactOpDecorator.prototype.savePointer = function(name, to) {
        // When the 'artifact' pointer is changed, we should change the base
        // of the data output node to the target type
        if (name === this.castOpts.ptr && (typeof to === 'string')) {
            this.client.startTransaction(`Setting output of ${this.name} to ${to}`);
            this.castOutputType(to);
            this.client.makePointer(this._node.id, name, to);
            this.client.completeTransaction();
        } else {
            DecoratorBase.prototype.savePointer.call(this, name, to);
        }
    };

    return ArtifactOpDecorator;
});
