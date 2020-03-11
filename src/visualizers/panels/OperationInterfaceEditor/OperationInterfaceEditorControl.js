/*globals define, */
/*jshint browser: true*/
// OpInterface visualizes the interface of the given operation and allows the
// user to edit the meta definition of the given operation. That is, it will
// show the operation's input data nodes as incoming connections; outputs as
// outgoing connections and the defined attributes/ptrs in the expanded view
// of the node.

define([
    'panels/EasyDAG/EasyDAGControl',
    'js/Constants',
    'deepforge/Constants',
    'deepforge/viz/OperationControl',
    './OperationInterfaceEditorControl.EventHandlers',
    './Colors',
    'underscore'
], function (
    EasyDAGControl,
    GME_CONSTANTS,
    CONSTANTS,
    OperationControl,
    OperationInterfaceEditorControlEvents,
    COLORS,
    _
) {

    'use strict';

    var CONN_ID = 0,
        OperationInterfaceEditorControl;

    OperationInterfaceEditorControl = function (options) {
        EasyDAGControl.call(this, options);
        OperationInterfaceEditorControlEvents.call(this);
        this._connections = {};
        this._pointers = {};

        this._usage = {};  // info about input usage
        this._inputs = {};
    };

    _.extend(
        OperationInterfaceEditorControl.prototype,
        EasyDAGControl.prototype,
        OperationControl.prototype,
        OperationInterfaceEditorControlEvents.prototype
    );

    OperationInterfaceEditorControl.prototype.TERRITORY_RULE = {children: 3};
    OperationInterfaceEditorControl.prototype.DEFAULT_DECORATOR = 'OpIntDecorator';
    OperationInterfaceEditorControl.prototype.selectedObjectChanged = function (nodeId) {
        this._logger.debug('activeObject nodeId \'' + nodeId + '\'');

        // Remove current territory patterns
        if (this._currentNodeId) {
            this._client.removeUI(this._territoryId);
        }

        this._currentNodeId = nodeId;
        this._currentNodeParentId = undefined;

        if (typeof this._currentNodeId === 'string') {
            var node = this._client.getNode(nodeId),
                name = node.getAttribute('name'),
                parentId = node.getParentId();

            this._widget.setTitle(name.toUpperCase());

            if (typeof parentId === 'string') {
                this.$btnModelHierarchyUp.show();
            } else {
                this.$btnModelHierarchyUp.hide();
            }

            this._currentNodeParentId = parentId;

            // Put new node's info into territory rules
            this.updateTerritory();
        }
    };

    OperationInterfaceEditorControl.prototype._eventCallback = function (events) {
        var event;

        // Remove any events about the current node
        this._logger.debug('_eventCallback \'' + i + '\' items');

        for (var i = 0; i < events.length; i++) {
            event = events[i];
            switch (event.etype) {
            case GME_CONSTANTS.TERRITORY_EVENT_LOAD:
                this._onLoad(event.eid);
                break;
            case GME_CONSTANTS.TERRITORY_EVENT_UPDATE:
                this._onUpdate(event.eid);
                break;
            case GME_CONSTANTS.TERRITORY_EVENT_UNLOAD:
                this._onUnload(event.eid);
                break;
            default:
                break;
            }
        }

        this._logger.debug('_eventCallback \'' + events.length + '\' items - DONE');
    };

    OperationInterfaceEditorControl.prototype.updateTerritory = function() {
        var nodeId = this._currentNodeId;

        // activeNode rules
        this._territories = {};

        this._territoryId = this._client.addUI(this, events => {
            this._eventCallback(events);
        });

        this._territories[nodeId] = {children: 0};  // Territory "rule"
        this._client.updateTerritory(this._territoryId, this._territories);
        this._logger.debug(`OpIntEditor current territory id is ${this._territoryId}`);

        this._territories[nodeId] = this.TERRITORY_RULE;

        // Add the operation definitions to the territory
        var metanodes = this._client.getAllMetaNodes(),
            operation = metanodes.find(n => n.getAttribute('name') === 'Data');

        // Get all the meta nodes that are instances of Data
        metanodes
            .filter(node => node.isTypeOf(operation.getId()))
            // Add a rule for them
            .forEach(op => this._territories[op.getId()] = {children: 0});

        this._client.updateTerritory(this._territoryId, this._territories);
    };

    OperationInterfaceEditorControl.prototype._getObjectDescriptor = function(gmeId) {
        var desc = EasyDAGControl.prototype._getObjectDescriptor.call(this, gmeId);
        // Check if it is...
        //  - input data
        //  - output data
        //  - operation node
        if (desc.id !== this._currentNodeId && this.containedInCurrent(gmeId)) {
            var cntrType = this._client.getNode(desc.parentId).getMetaTypeId();
            var cntr = this._client.getNode(cntrType).getAttribute('name');

            desc.container = cntr.toLowerCase();
            desc.isInput = desc.container === 'inputs';
            desc.attributes = {};

        } else if (desc.id === this._currentNodeId) {
            desc.pointers = {};

            // Remove DeepForge hidden attributes
            const displayColor = desc.attributes[CONSTANTS.OPERATION.DISPLAY_COLOR];
            desc.displayColor = displayColor && displayColor.value;

            CONSTANTS.OPERATION.RESERVED_ATTRS
                .filter(attrName => attrName !== 'name')
                .forEach(name => delete desc.attributes[name]);
        }

        // Extra decoration for data
        if (this.hasMetaName(desc.id, 'Data', true)) {
            desc.color = this.getDescColor(gmeId);
            desc.isPrimitive = this.hasMetaName(gmeId, 'Primitive');

            var used = desc.isInput ?
                this.isUsedInput(desc.name) : this.isUsedOutput(desc.name);
            if (used !== null) {
                desc.used = used;
                this._usage[desc.id] = desc.used;
            } else {
                desc.used = this._usage[desc.id] !== undefined ?
                    this._usage[desc.id] : true;
            }

            this._inputs[desc.id] = desc.isInput;
        }
        return desc;
    };

    OperationInterfaceEditorControl.prototype.getDescColor = function(gmeId) {
        return !this.hasMetaName(gmeId, 'Primitive', true) ? COLORS.COMPLEX :
            COLORS.PRIMITIVE;
    };

    OperationInterfaceEditorControl.prototype._onUnload = function(gmeId) {
        EasyDAGControl.prototype._onUnload.call(this, gmeId);
        var conn = this._connections[gmeId];
        if (conn) {
            this._widget.removeNode(conn.id);
        }
        delete this._usage[gmeId];
        delete this._inputs[gmeId];
    };

    OperationInterfaceEditorControl.prototype._onLoad = function(gmeId) {
        var desc;
        if (this._currentNodeId === gmeId) {
            desc = this._getObjectDescriptor(gmeId);
            this._widget.addNode(desc);

            // Create nodes for the valid pointers
            this.updatePtrs();

        } else if (this.hasMetaName(gmeId, 'Data') && this.containedInCurrent(gmeId)) {
            desc = this._getObjectDescriptor(gmeId);
            this._widget.addNode(desc);
            this.createConnection(desc);
        }
    };

    OperationInterfaceEditorControl.prototype._onUpdate = function(gmeId) {
        if (gmeId === this._currentNodeId) {
            EasyDAGControl.prototype._onUpdate.call(this, gmeId);

            // Update the valid pointers
            this.updatePtrs();

            // Update the remaining usage info
            // TODO
            try {
                // Parse the operation implementation for visual cues
                // TODO
            } catch (e) {
                this._logger.debug(`failed parsing operation: ${e}`);
            }

        } else if (this.containedInCurrent(gmeId) && this.hasMetaName(gmeId, 'Data')) {
            EasyDAGControl.prototype._onUpdate.call(this, gmeId);
        }
    };

    OperationInterfaceEditorControl.prototype.loadMeta = function() {
        // Load the metamodel. This is kinda a hack to make sure
        // the meta nodes are accessible with `this._client.getNode`
        return this._client.getAllMetaNodes();
    };

    OperationInterfaceEditorControl.prototype.getPtrDescriptor = function(name) {
        var Decorator = this._client.decoratorManager.getDecoratorForWidget('OpIntPtrDecorator', 'EasyDAG'),
            id = 'ptr_'+name,
            used = this.isUsedInput(name),
            ptrMeta = this._client.getPointerMeta(this._currentNodeId, name),
            targetId,
            target,
            baseName;

        if (!ptrMeta || ptrMeta.items.length === 0) {
            // No known type
            this._logger.error(`No known target type for "${name}" reference`);
            baseName = null;
        } else {
            targetId = ptrMeta.items[0].id;
            target = this._client.getNode(targetId);
            baseName = target.getAttribute('name');
        }

        if (used === null) {
            used = this._usage[id] !== undefined ? this._usage[id] : true;
        }

        return {
            id: id,
            isPointer: true,
            baseName: baseName,
            isUnknown: !baseName,
            Decorator: Decorator,
            used: used,
            attributes: {},
            name: name,
            parentId: this._currentNodeId
        };
    };

    OperationInterfaceEditorControl.prototype.updatePtrs = function() {
        // Update the pointer nodes for the current node
        var rmPtrs,
            updatePtrs = [],
            newPtrs,
            newPtrDict = {},
            ptr;

        // Get the pointers that should exist [name, target]
        this.loadMeta();
        newPtrs = this.getCurrentReferences(this._currentNodeId)
            .map(name => this.getPtrDescriptor(name));

        // Compare them to the existing...
        for (var i = newPtrs.length; i--;) {
            ptr = newPtrs[i];
            if (this._pointers[ptr.id]) {  // Check for update
                updatePtrs.push(ptr);
                newPtrs.splice(i, 1);
                newPtrDict[ptr.id] = ptr;
                delete this._pointers[ptr.id];
            }
        }

        rmPtrs = Object.keys(this._pointers);

        // Remove ones that should no longer exist
        rmPtrs.forEach(id => this.rmPtr(id));

        // Add ones that should
        this._pointers = newPtrDict;
        newPtrs.forEach(desc => this.addPtr(desc));
        updatePtrs.forEach(desc => this.updatePtr(desc));
    };

    OperationInterfaceEditorControl.prototype.addPtr = function(desc) {
        this._widget.addNode(desc);
        this._pointers[desc.id] = desc;
        this.createConnection(desc);
    };

    OperationInterfaceEditorControl.prototype.updatePtr = function(desc) {
        this._widget.updateNode(desc);
    };

    OperationInterfaceEditorControl.prototype.rmPtr = function(id) {
        // Remove the pointer's node
        this._widget.removeNode(id);

        // and connection
        var conn = this._connections[id];
        this._widget.removeNode(conn.id);

        // and usage info
        delete this._usage[id];
    };

    OperationInterfaceEditorControl.prototype.containedInCurrent = function(id) {
        return id.indexOf(this._currentNodeId) === 0;
    };

    OperationInterfaceEditorControl.prototype.createConnection = function(desc) {
        var conn = {};
        conn.id = `CONN_${++CONN_ID}`;

        if (desc.container === 'outputs') {
            conn.src = this._currentNodeId;
            conn.dst = desc.id;
        } else {
            conn.src = desc.id;
            conn.dst = this._currentNodeId;
        }
        // Create a connection either to or from desc & the currentNode
        this._widget.addConnection(conn);
        this._connections[desc.id] = conn;

        return conn;
    };

    ////////////////////// Unused input checking //////////////////////
    OperationInterfaceEditorControl.prototype.isUsedInput = function(name, ast) {
        return true;
        //return this._isUsed(name, true, ast);
    };

    OperationInterfaceEditorControl.prototype.isUsedOutput = function(name, ast) {
        return true;
        //return this._isUsed(name, false, ast);
    };

    OperationInterfaceEditorControl.prototype._isUsed = function(name, isInput, ast) {
        var code = this._client.getNode(this._currentNodeId).getAttribute('code'),
            r = new RegExp('\\b' + name + '\\b'),
            hasText = code.match(r) !== null;

        // verify that it is not used only in the left side of an assignment
        if (hasText) {
            try {
                return true;
                //ast = ast || luajs.parser.parse(code);
                //return isInput ? this.isUsedVariable(name, ast) : this.isReturnValue(name, ast);
            } catch(e) {
                this._logger.debug(`failed parsing lua: ${e}`);
                return null;
            }
        }

        return false;
    };

    // Check if it is used in the given ast node
    // TODO: Should I just connect this to something like LSP?
    OperationInterfaceEditorControl.prototype.isUsedVariable = function(name, node) {
        var isUsed = false;

        return true;
        //checker = luajs.codegen.traverse((curr, parent) => {
            //if (curr.type === 'variable' && curr.val === name) {
                //// Ignore if it is being assigned...
                //if (parent.type === 'stat.assignment') {
                    //isUsed = isUsed || parent.right.indexOf(curr) !== -1;
                //} else {
                    //isUsed = true;
                //}
            //}
            //return curr;
        //});

        //checker(node);
        return isUsed;
    };

    OperationInterfaceEditorControl.prototype.isReturnValue = function(name, ast) {
        var firstReturn,
            fields,
            key,
            node;

        for (var i = ast.block.stats.length; i--;) {
            node = ast.block.stats[i];
            if (node.type === 'stat.return') {
                // Check that it returns an object w/ a key of the given name
                firstReturn = node.nret[0];
                if (firstReturn && firstReturn.type === 'expr.constructor') {
                    fields = firstReturn.fields;
                    for (var j = fields.length; j--;) {
                        key = fields[j].key;
                        if (key.type === 'const.string' && key.val === name) {
                            return true;
                        }
                    }
                }
            }
        }
        return false;
    };

    OperationInterfaceEditorControl.prototype._isValidTerminalNode = function() {
        return true;
    };

    return OperationInterfaceEditorControl;
});
