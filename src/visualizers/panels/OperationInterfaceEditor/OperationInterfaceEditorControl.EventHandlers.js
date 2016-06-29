/*globals define*/
define([
    './Colors'
], function(
    COLORS
) {
    'use strict';
    var OperationInterfaceEditorEvents = function() {
        this._widget.allDataTypeIds = this.allDataTypeIds.bind(this);
        this._widget.allValidReferences = this.allValidReferences.bind(this);
        this._widget.addRefTo = this.addRefTo.bind(this);
        this._widget.changePtrName = this.changePtrName.bind(this);
        this._widget.removePtr = this.removePtr.bind(this);
        this._widget.getCreationNode = this.getCreationNode.bind(this);
    };

    OperationInterfaceEditorEvents.prototype.getCreationNode = function(type, id) {
        var typeName = type === 'Complex' ? 'Class' : 'Primitive',
            Decorator = this._client.decoratorManager.getDecoratorForWidget(
                this.DEFAULT_DECORATOR, 'EasyDAG');

        return {
            node: {
                id: id,
                class: 'create-node',
                name: `New ${typeName}...`,
                Decorator: Decorator,
                color: COLORS[type.toUpperCase()],
                isPrimitive: type === 'Primitive',
                attributes: {}
            }
        };
    };

    OperationInterfaceEditorEvents.prototype.allValidReferences = function() {
        // Get all meta nodes that...
        //  - are not data, pipeline or operation (or fco!)
        //  - have a plugin defined?
        // Currently you can't reference operations or pipelines.
        var notTypes = ['Data', 'Operation', 'Pipeline'];
        return this._client.getAllMetaNodes()
            .filter(node => {
                var plugins = node.getRegistry('validPlugins');
                // Convention is enforced; if the plugin generates lua artifacts,
                // it should be called `Generate`.. (something)
                return plugins && plugins.indexOf('Generate') !== -1;
            })
            .filter(node => notTypes.reduce((valid, name) =>
                valid && !this.hasMetaName(node.getId(), name), true))
            .filter(node => node.getAttribute('name') !== 'FCO')
            .map(node => {
                return {
                    node: this._getObjectDescriptor(node.getId())
                };
            });
    };

    OperationInterfaceEditorEvents.prototype.allDataTypeIds = function() {
        return this.allDataTypes().map(node => node.getId());
    };

    OperationInterfaceEditorEvents.prototype.allDataTypes = function() {
        return this._client.getAllMetaNodes()
            .filter(node => this.hasMetaName(node.getId(), 'Data'))
            .filter(node => !node.isAbstract());
    };

    OperationInterfaceEditorEvents.prototype._getValidSuccessorNodes = function(nodeId) {
        // Return all data types in the meta
        if (nodeId !== this._currentNodeId) {
            return [];
        }

        return this.allDataTypeIds().map(id => {
            return {
                node: this._getObjectDescriptor(id)
            };
        });
    };

    OperationInterfaceEditorEvents.prototype._getDataName = function(cntrId, typeId) {
        var otherIds = this._client.getNode(cntrId).getChildrenIds(),
            otherNames = otherIds.map(id => this._client.getNode(id).getAttribute('name')),
            baseName = this._client.getNode(typeId).getAttribute('name').toLowerCase(),
            name = baseName,
            i = 1;

        while (otherNames.indexOf(name) !== -1) {
            i++;
            name = baseName + '_' + i;
        }
        return name;
    };

    OperationInterfaceEditorEvents.prototype.getRefName = function(node, basename) {
        // Get a dict of all invalid ptr names for the given node
        var invalid = {},
            name,
            i = 2;

        name = basename;
        node.getSetNames().concat(node.getPointerNames())
            .forEach(ptr => invalid[ptr] = true);
        
        while (invalid[name]) {
            name = basename + '_' + i;
            i++;
        }

        return name;
    };

    OperationInterfaceEditorEvents.prototype.addRefTo = function(targetId) {
        // Create a reference from the current node to the given type
        var opNode = this._client.getNode(this._currentNodeId),
            target = this._client.getNode(targetId),
            desiredName = target.getAttribute('name').toLowerCase(),
            ptrName = this.getRefName(opNode, desiredName),
            msg = `Adding ref "${ptrName}" to operation "${opNode.getAttribute('name')}"`;

        this._client.startTransaction(msg);
        this._client.setPointerMeta(this._currentNodeId, ptrName, {
            min: 1,
            max: 1,
            items: [
                {
                    id: targetId,
                    max: 1
                }
            ]
        });
        this._client.makePointer(this._currentNodeId, ptrName, null);
        this._client.completeTransaction();
    };

    OperationInterfaceEditorEvents.prototype.changePtrName = function(from, to) {
        var opNode = this._client.getNode(this._currentNodeId),
            name = opNode.getAttribute('name'),
            msg = `Renaming ref from "${from}" to "${to}" for ${name}`,
            meta = this._client.getPointerMeta(this._currentNodeId, from),
            ptrName;

        ptrName = this.getRefName(opNode, to);

        this._client.startTransaction(msg);

        // Currently, this will not update children already using old name...
        this._client.deleteMetaPointer(this._currentNodeId, from);
        this._client.delPointer(this._currentNodeId, from);
        this._client.setPointerMeta(this._currentNodeId, ptrName, meta);
        this._client.makePointer(this._currentNodeId, ptrName, null);

        this._client.completeTransaction();
    };

    OperationInterfaceEditorEvents.prototype.removePtr = function(name) {
        var opName = this._client.getNode(this._currentNodeId).getAttribute('name'),
            msg = `Removing ref "${name}" from "${opName}" operation`;

        this._client.startTransaction(msg);
        // Currently, this will not update children already using old name...
        this._client.deleteMetaPointer(this._currentNodeId, name);
        this._client.delPointer(this._currentNodeId, name);
        this._client.completeTransaction();
    };

    OperationInterfaceEditorEvents.prototype._createConnectedNode = function(typeId, isInput) {
        var node = this._client.getNode(this._currentNodeId),
            name = node.getAttribute('name'),
            cntrs = node.getChildrenIds(),
            cntrType = isInput ? 'Inputs' : 'Outputs',
            cntrId = cntrs.find(id => this.hasMetaName(id, cntrType)),
            dataName = this._getDataName(cntrId, typeId),
            msg;

        msg = `Adding ${isInput ? 'input' : 'output'} "${dataName}" to ${name} interface`;
        this._client.startTransaction(msg);
        var id = this._client.createChild({
            parentId: cntrId,
            baseId: typeId
        });

        // Set the name of the new input
        this._client.setAttributes(id, 'name', dataName);

        this._client.completeTransaction();
    };

    return OperationInterfaceEditorEvents;
});
