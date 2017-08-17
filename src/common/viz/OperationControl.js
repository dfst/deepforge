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

    OperationControl.prototype.createIONode = function(opId, typeId, isInput, baseName, silent) {
        var cntrId = this.getDataContainerId(opId, isInput),
            name = this._client.getNode(opId).getAttribute('name'),
            dataName,
            msg;

        baseName = baseName || this._client.getNode(typeId).getAttribute('name').toLowerCase();
        dataName = this._getDataName(cntrId, baseName);

        msg = `Adding ${isInput ? 'input' : 'output'} "${dataName}" to ${name} interface`;
        if (!silent) {
            this._client.startTransaction(msg);
        }

        var id = this._client.createNode({
            parentId: cntrId,
            baseId: typeId
        });

        // Set the name of the new input
        this._client.setAttribute(id, 'name', dataName);

        if (!silent) {
            this._client.completeTransaction();
        }
        return id;
    };

    OperationControl.prototype._getDataName = function(cntrId, baseName) {
        var otherNames = this._getDataNames(cntrId),
            name = baseName,
            i = 1;

        while (otherNames.indexOf(name) !== -1) {
            i++;
            name = baseName + '_' + i;
        }
        return name;
    };

    OperationControl.prototype._getDataNames = function(cntrId) {
        var otherIds = this._client.getNode(cntrId).getChildrenIds();

        return otherIds.map(id => this._client.getNode(id).getAttribute('name'));
    };

    OperationControl.prototype.getDataNames = function(opId, isInput) {
        return this._getDataNames(this.getDataContainerId(opId, isInput));
    };

    OperationControl.prototype.getDataContainerId = function(opId, isInput) {
        var node = this._client.getNode(opId),
            cntrs = node.getChildrenIds(),
            cntrType = isInput ? 'Inputs' : 'Outputs';

        return cntrs.find(id => this.hasMetaName(id, cntrType));
    };

    OperationControl.prototype.getDataTypeId = function() {
        var dataNode = this._client.getAllMetaNodes()
            .find(node => node.getAttribute('name') === 'Data');

        return dataNode.getId();
    };

    OperationControl.prototype.addInputData = function(opId, name) {
        return this.createIONode(opId, this.getDataTypeId(), true, name, true);
    };

    OperationControl.prototype.removeInputData = function(opId, name) {
        var cntrId = this.getDataContainerId(opId, true),
            otherIds = this._client.getNode(cntrId).getChildrenIds(),
            dataId = otherIds.find(id => this._client.getNode(id).getAttribute('name') === name);

        if (dataId) {  // ow, data not found
            this._client.deleteNode(dataId);
        }
    };

    OperationControl.prototype.addOutputData = function(opId, name) {
        return this.createIONode(opId, this.getDataTypeId(), false, name, true);
    };

    OperationControl.prototype.removeOutputData = function(opId, name) {
        var cntrId = this.getDataContainerId(opId),
            otherIds = this._client.getNode(cntrId).getChildrenIds(),
            dataId = otherIds.find(id => this._client.getNode(id).getAttribute('name') === name);

        if (dataId) {  // ow, data not found
            this._client.deleteNode(dataId);
        }
    };

    return OperationControl;
});
