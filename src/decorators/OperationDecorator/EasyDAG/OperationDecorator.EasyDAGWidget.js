/*globals define, _*/
/*jshint browser: true, camelcase: false*/

/**
 * @author brollb / https://github.com/brollb
 */

define([
    'decorators/EllipseDecorator/EasyDAG/EllipseDecorator.EasyDAGWidget',
    'css!./OperationDecorator.EasyDAGWidget.css'
], function (
    DecoratorBase
) {

    'use strict';

    var OperationDecorator,
        DECORATOR_ID = 'OperationDecorator';

    // Operation nodes need to be able to...
    //     - show their ports
    //     - highlight ports
    //     - unhighlight ports
    //     - report the location of specific ports
    OperationDecorator = function (options) {
        DecoratorBase.call(this, options);
    };

    _.extend(OperationDecorator.prototype, DecoratorBase.prototype);

    OperationDecorator.prototype.DECORATOR_ID = DECORATOR_ID;
    OperationDecorator.prototype.expand = function() {
        DecoratorBase.prototype.expand.call(this);
        // Add the ports for data inputs/outputs
        // TODO
        //var inputs = this._node.inputs;
        //var outputs = this._node.outputs;
    };

    OperationDecorator.prototype._highlightPort = function(/*name*/) {
        // Highlight port with the given name
        // TODO
    };

    OperationDecorator.prototype.getPortLocation = function(/*name*/) {
        // Report location of given port
        // TODO
    };

    OperationDecorator.prototype.unhighlightPort = function(/*name*/) {
        // Highlight port with the given name
        // TODO
    };

    OperationDecorator.prototype.getDisplayName = function() {
        return this._node.name;
    };

    return OperationDecorator;
});
