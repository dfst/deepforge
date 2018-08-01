/* globals define */
// A mixin containing helpers for working with operations
define([
    'deepforge/OperationCode',
    'deepforge/Constants',
    'js/Constants'
], function(
    OperationCode,
    CONSTANTS,
    GME_CONSTANTS
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

    OperationControl.prototype.isInputData = function(nodeId) {
        var node = this._client.getNode(nodeId);
        return this.hasMetaName(node.getParentId(), 'Inputs');
    };

    // References and attributes
    OperationControl.prototype.getCurrentReferences = function(opId) {
        var node = this._client.getNode(opId);

        return node.getPointerNames()
            .filter(name => name !== GME_CONSTANTS.POINTER_BASE);
    };

    OperationControl.prototype.removeReference = function(opId, name) {
        this._client.delPointerMeta(opId, name);
        this._client.delPointer(opId, name);
    };

    var RESERVED_ATTRIBUTES = [
        CONSTANTS.DISPLAY_COLOR,
        CONSTANTS.LINE_OFFSET,
        'name',
        'code'
    ];

    OperationControl.prototype.getAttributeNames = function(opId) {
        var node = this._client.getNode(opId);
        return node.getAttributeNames()
            .filter(name => RESERVED_ATTRIBUTES.indexOf(name) === -1);
    };

    OperationControl.prototype.getAttributes = function(opId) {
        opId = opId === undefined ? this._currentNodeId : opId;
        return this.getAttributeNames(opId).map(name => this.getAttribute(opId, name));
    };

    OperationControl.prototype.getAttribute = function(opId, name) {
        var node = this._client.getNode(opId);
        var schema = node.getAttributeMeta(name);
        return {
            name: name,
            type: schema.type,
            value: node.getAttribute(name)
        };
    };

    OperationControl.prototype.addAttribute = function(opId, name, value) {
        var type = 'string';

        if (value === undefined) {
            value = null;
        } else {  // determine the attribute type
            type = typeof value;

            // Figure out the type
            if (type === 'number') {
                type = parseInt(value) === value ? 'integer' : 'float';
            }
        }
        this._client.setAttributeMeta(opId, name, {type: type});
        this._client.setAttribute(opId, name, value);
    };

    OperationControl.prototype.removeAttribute = function(opId, name) {
        this._client.delAttributeMeta(opId, name);
        this._client.delAttribute(opId, name);
    };

    OperationControl.prototype.setAttributeDefault = function(opId, name, value) {
        if (value) {
            this.removeAttribute(opId, name);
            this.addAttribute(opId, name, value);
        } else {  // just remove the default
            value = value !== undefined ? value : null;
            this._client.setAttribute(opId, name, value);
        }
    };

    OperationControl.prototype.updateCode = function(fn, nodeId) {
        const node = this._client.getNode(nodeId || this._currentNodeId);
        const code = node.getAttribute('code');
        const operation = OperationCode.findOperation(code);
        const opCode = operation.getCode();
        const offset = code.indexOf(opCode);
        const preCode = code.substring(0, offset);
        const postCode = code.substring(offset+opCode.length);

        try {
            fn(operation);
            const entireCode = preCode + operation.getCode() + postCode;
            this._client.setAttribute(nodeId || this._currentNodeId, 'code', entireCode);
        } catch(e) {
            this.logger.debug(`could not update the code - invalid python!: ${e}`);
        }
    };

    OperationControl.prototype.getInputNodes = function(nodeId) {
        nodeId = nodeId || this._currentNodeId;
        var node = this._client.getNode(nodeId);
        return this.getOperationInputs(node).map(id => this._client.getNode(id));
    };

    OperationControl.prototype.getOutputNodes = function(nodeId) {
        nodeId = nodeId || this._currentNodeId;
        var node = this._client.getNode(nodeId);
        return this.getOperationOutputs(node).map(id => this._client.getNode(id));
    };

    return OperationControl;
});
