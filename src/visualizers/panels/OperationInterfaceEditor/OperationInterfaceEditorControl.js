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
    'deepforge/viz/OperationControl',
    './OperationInterfaceEditorControl.EventHandlers',
    './Colors',
    'underscore'
], function (
    EasyDAGControl,
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
            case CONSTANTS.TERRITORY_EVENT_LOAD:
                this._onLoad(event.eid);
                break;
            case CONSTANTS.TERRITORY_EVENT_UPDATE:
                this._onUpdate(event.eid);
                break;
            case CONSTANTS.TERRITORY_EVENT_UNLOAD:
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
        metanodes.map(n => n.getId())
            .filter(nId => this._client.isTypeOf(nId, operation.getId()))
            // Add a rule for them
            .forEach(opId => this._territories[opId] = {children: 0});

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
            desc.attributes = {};

        } else if (desc.id === this._currentNodeId) {
            desc.pointers = {};
            delete desc.attributes.code;
        }

        // Extra decoration for data
        if (this.hasMetaName(desc.id, 'Data', true)) {
            desc.color = this.getDescColor(gmeId);
            desc.isPrimitive = this.hasMetaName(gmeId, 'Primitive');
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
        var targetId = this._client.getPointerMeta(this._currentNodeId, name)
                .items[0].id,
            target = this._client.getNode(targetId),
            decManager = this._client.decoratorManager,
            Decorator = decManager.getDecoratorForWidget('OpIntPtrDecorator', 'EasyDAG');

        return {
            id: 'ptr_'+name,
            isPointer: true,
            baseName: target.getAttribute('name'),
            Decorator: Decorator,
            attributes: {},
            name: name,
            parentId: this._currentNodeId
        };
    };

    OperationInterfaceEditorControl.prototype.updatePtrs = function() {
        // Update the pointer nodes for the current node
        var node = this._client.getNode(this._currentNodeId),
            rmPtrs,
            updatePtrs = [],
            newPtrs,
            newPtrDict = {},
            ptr;

        // Get the pointers that should exist [name, target]
        this.loadMeta();
        newPtrs = node.getPointerNames()
            .filter(name => name !== CONSTANTS.POINTER_BASE)
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

    return OperationInterfaceEditorControl;
});
