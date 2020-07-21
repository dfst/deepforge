/*globals define*/
define([
    'panels/EasyDAG/EasyDAGControl.WidgetEventHandlers',
    'deepforge/OperationCode',
    'deepforge/Constants',
    './Colors',
    'text!panels/ForgeActionButton/Libraries.json',
], function(
    EasyDAGControlEventHandlers,
    OperationCode,
    Constants,
    COLORS,
    LibrariesText
) {
    'use strict';
    const Libraries = JSON.parse(LibrariesText);
    var OperationInterfaceEditorEvents = function() {
        this.logger = this._logger;
        this._widget.allDataTypeIds = this.allDataTypeIds.bind(this);
        this._widget.allValidReferences = this.allValidReferences.bind(this);
        this._widget.addRefTo = this.addRefTo.bind(this);
        this._widget.setRefType = this.setRefType.bind(this);
        this._widget.changePtrName = this.changePtrName.bind(this);
        this._widget.removePtr = this.removePtr.bind(this);
        this._widget.getCreationNode = this.getCreationNode.bind(this);

        this._widget.setAttributeMeta = this.setAttributeMeta.bind(this);
        this._widget.deleteAttribute = this.deleteAttribute.bind(this);
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

    OperationInterfaceEditorEvents.prototype.getResourcesNodeTypes = function() {
        return this._client.getAllMetaNodes()
            .filter(node => {  // Check that the node is a top level type from a library
                const name = node.getAttribute('name');
                const namespace = node.getNamespace();
                if (!namespace) return false;

                const isResourceFromLibrary = Libraries.find(library => {
                    return library.name === namespace &&
                        library.nodeTypes.includes(name);
                });
                return isResourceFromLibrary;
            });
    };

    OperationInterfaceEditorEvents.prototype.allValidReferences = function() {
        return this.getResourcesNodeTypes()
            .map(node => {
                return {
                    node: this._getObjectDescriptor(node.getId())
                };
            });
    };

    OperationInterfaceEditorEvents.prototype.allDataTypeIds = function(incAbstract) {
        return this.allDataTypes(incAbstract).map(node => node.getId());
    };

    OperationInterfaceEditorEvents.prototype.allDataTypes = function(incAbstract) {
        return this._client.getAllMetaNodes()
            .filter(node => this.hasMetaName(node.getId(), 'Data', incAbstract))
            .filter(node => !node.isAbstract());
    };

    OperationInterfaceEditorEvents.prototype.getValidSuccessors = function(nodeId) {
        if (nodeId !== this._currentNodeId) {
            return [];
        }

        return [{
            node: this._getObjectDescriptor(this.getDataTypeId())
        }];
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
        this.updateCode(operation => operation.addReference(ptrName));
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
        this._client.setPointer(this._currentNodeId, ptrName, null);
        this._client.completeTransaction();
    };

    OperationInterfaceEditorEvents.prototype.setRefType = function(ref, targetId) {
        var meta = this._client.getPointerMeta(this._currentNodeId, ref),
            msg = `Setting ${ref} reference type to ${targetId}`;

        if (!meta) {
            this.logger.debug(`No meta found for ${ref}. Creating a new reference to ${targetId}`);
            meta = {
                min: 1,
                max: 1,
                items: []
            };
        }

        meta.items.push({
            id: targetId,
            max: 1
        });

        this._client.startTransaction(msg);
        this._client.setPointerMeta(this._currentNodeId, ref, meta);
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

        this.updateCode(operation =>
            operation.renameIn(OperationCode.CTOR_FN, from, to));

        // Currently, this will not update children already using old name...
        this._client.delPointerMeta(this._currentNodeId, from);
        this._client.delPointer(this._currentNodeId, from);
        this._client.setPointerMeta(this._currentNodeId, ptrName, meta);
        this._client.setPointer(this._currentNodeId, ptrName, null);

        this._client.completeTransaction();
    };

    OperationInterfaceEditorEvents.prototype.removePtr = function(name) {
        var opName = this._client.getNode(this._currentNodeId).getAttribute('name'),
            msg = `Removing ref "${name}" from "${opName}" operation`;

        this._client.startTransaction(msg);
        // Currently, this will not update children already using old name...
        this.removeReference(this._currentNodeId, name);

        this.updateCode(operation => operation.removeReference(name));
        this._client.completeTransaction();
    };

    OperationInterfaceEditorEvents.prototype._createConnectedNode = function(typeId, isInput, baseName) {
        var node = this._client.getNode(this._currentNodeId),
            name = node.getAttribute('name'),
            msg = `Updating the interface of ${name}`,
            id,
            dataName;

        // Update the source code if the inputs/outputs changed
        // we know that we are adding a node, so we don't need to do 
        // the comparing and diffing current vs new

        this._client.startTransaction(msg);
        id = this.createIONode(this._currentNodeId, typeId, isInput, baseName, true);
        dataName = this._client.getNode(id).getAttribute('name');

        if (isInput) {
            this.updateCode(operation => operation.addInput(dataName));
        } else {
            this.updateCode(operation => operation.addOutput(dataName));
        }
        this._client.completeTransaction();

        return id;
    };

    OperationInterfaceEditorEvents.prototype._deleteNode = function(nodeId) {
        var dataName = this._client.getNode(nodeId).getAttribute('name'),
            node = this._client.getNode(this._currentNodeId),
            name = node.getAttribute('name'),
            isInput = this.isInputData(nodeId),
            msg = `Updating the interface of ${name}`;

        // If the input name is used in the code, maybe just comment it out in the args
        this._client.startTransaction(msg);
        if (isInput) {
            this.updateCode(operation => operation.removeInput(dataName));
        } else {
            this.updateCode(operation => operation.removeOutput(dataName));
        }
        this._client.deleteNode(nodeId);
        //EasyDAGControlEventHandlers.prototype._deleteNode.apply(this, nodeId, true);
        this._client.completeTransaction();
    };

    OperationInterfaceEditorEvents.prototype._saveAttributeForNode = function(nodeId, attr, value) {
        // If nodeId is an input data node, rename the input
        // If nodeId is an output data node, rename the output
        var isDataNode = nodeId !== this._currentNodeId && nodeId.indexOf(this._currentNodeId) === 0,
            msg;

        if (attr === 'name') {  // rename input/output
            if (isDataNode) {
                var dataNode = this._client.getNode(nodeId),
                    oldName = dataNode.getAttribute(attr);

                msg = `Renaming ${oldName}->${value} in ${name}`;
                this._client.startTransaction(msg);

                this.updateCode(operation => operation.rename(oldName, value));
                // if any of the inputs have the same name, they should also be renamed.
                // We are assuming that they are likely using the same variable
                // and we don't want to change the behavior of the code...
                var dataNodes = this.getInputNodes().concat(this.getOutputNodes());
                var matching = dataNodes.filter(node => node.getAttribute('name') === oldName);
                matching.forEach(node =>
                    EasyDAGControlEventHandlers.prototype._saveAttributeForNode.call(this, node.getId(), attr, value)
                );
                this._client.completeTransaction();
            } else {
                this._client.startTransaction(`Renaming ${oldName}->${value}`);
                this.updateCode(operation => operation.setName(value));
                EasyDAGControlEventHandlers.prototype._saveAttributeForNode.apply(this, arguments);
                this._client.completeTransaction();
            }
        } else if (nodeId === this._currentNodeId) {  // edit operation attributes
            msg = `Setting attribute default ${attr}->${value} in ${name}`;
            this._client.startTransaction(msg);
            const isOperationAttribute = !Object.values(Constants.OPERATION).includes(attr);
            if (isOperationAttribute) {
                this.updateCode(operation => operation.setAttributeDefault(attr, value));
            }
            EasyDAGControlEventHandlers.prototype._saveAttributeForNode.apply(this, arguments);
            this._client.completeTransaction();
        }
    };

    OperationInterfaceEditorEvents.prototype.getOperationName = function() {
        return this._client.getNode(this._currentNodeId).getAttribute('name');
    };

    OperationInterfaceEditorEvents.prototype.setAttributeMeta = function(nodeId, name, desc) {
        var schema,
            opName = this.getOperationName(),
            isRename = name && name !== desc.name,
            isNewAttribute = name === null,
            msg = `Updating "${name}" attribute in "${opName}" operation`;

        // Create the schema from the desc
        schema = {
            type: desc.type,
            min: desc.min,
            max: desc.max,
            regexp: desc.regexp
        };

        if (desc.isEnum) {
            schema.enum = desc.enumValues;
        }

        // Update the operation's attribute
        this._client.startTransaction(msg);

        // update the operation code
        this.updateCode(operation => {
            if (isRename) {
                operation.renameIn(OperationCode.CTOR_FN, name, desc.name);
            } else if (isNewAttribute) {
                operation.addAttribute(desc.name);
            }
            operation.setAttributeDefault(desc.name, desc.defaultValue);
        });

        if (isRename) {  // Renaming attribute
            if (name) {
                this._client.delAttributeMeta(nodeId, name);
                this._client.delAttribute(nodeId, name);
            }
            name = desc.name;
        }

        this._client.setAttributeMeta(nodeId, desc.name, schema);
        this._client.setAttribute(nodeId, desc.name, desc.defaultValue);

        this._client.completeTransaction();
    };

    OperationInterfaceEditorEvents.prototype.deleteAttribute = function(nodeId, name) {
        var opName = this._client.getNode(nodeId).getAttribute('name'),
            msg = `Deleting "${name}" attribute from "${opName}" operation`;

        this._client.startTransaction(msg);
        this.removeAttribute(nodeId, name);

        // update the operation code
        this.updateCode(operation => operation.removeAttribute(name));
        this._client.completeTransaction();
    };

    return OperationInterfaceEditorEvents;
});
