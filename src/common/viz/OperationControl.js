/* globals define */
// A mixin containing helpers for working with operations
define([
], function(
) {
    'use strict';
    var OperationControl = function() {
    };

    OperationControl.prototype.hasMetaName = function(id, name, inclusive) {
        var node = this._client.getNode(id),
            bId = inclusive ? id : node.getBaseId(),
            baseName;

        while (bId) {
            node = this._client.getNode(bId);
            baseName = node.getAttribute('name');
            if (baseName === name) {
                return true;
            }
            bId = node.getBaseId();
        }
        return false;
    };

    OperationControl.prototype.getOperationInputs = function(node) {
        return this.getOperationData(node, 'Inputs');
    };

    OperationControl.prototype.getOperationOutputs = function(node) {
        return this.getOperationData(node, 'Outputs');
    };

    OperationControl.prototype.getOperationData = function(node, type) {
        var childrenIds = node.getChildrenIds(),
            typeId = childrenIds.find(cId => this.hasMetaName(cId, type));

        return typeId ? this._client.getNode(typeId).getChildrenIds() : [];
    };

    return OperationControl;
});
