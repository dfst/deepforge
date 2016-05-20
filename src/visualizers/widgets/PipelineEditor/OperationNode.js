/*globals define */
define([
    'widgets/EasyDAG/DAGItem',
    'underscore'
], function(
    DAGItem,
    _
) {

    'use strict';
    var OperationNode = function(parentEl, desc) {
        DAGItem.call(this, parentEl, desc);
    };

    _.extend(OperationNode.prototype, DAGItem.prototype);

    OperationNode.prototype.updatePort = function(desc) {
        // TODO
    };

    OperationNode.prototype.addPort = function(desc) {
        // TODO
    };

    return OperationNode;
});
