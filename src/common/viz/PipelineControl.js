/* globals define */
// Shared methods for editing pipelines
define([
    'panels/EasyDAG/EasyDAGControl',
    'deepforge/viz/OperationControl',
    'deepforge/Constants',
    'widgets/EasyDAG/AddNodeDialog',
    'underscore'
], function(
    EasyDAGControl,
    OperationControl,
    CONSTANTS,
    AddNodeDialog,
    _
) {
    'use strict';

    var PipelineControl = function() {
    };

    _.extend(PipelineControl.prototype, OperationControl.prototype);

    PipelineControl.prototype.DEFAULT_DECORATOR = 'OperationDecorator';

    PipelineControl.prototype._getAllDescendentIds =
        EasyDAGControl.prototype._getAllDescendentIds;
    PipelineControl.prototype._getAllValidChildren =
        EasyDAGControl.prototype._getAllValidChildren;
    PipelineControl.prototype._getNodeDecorator =
        EasyDAGControl.prototype._getNodeDecorator;

    PipelineControl.prototype.onCreateInitialNode = function() {
        var initialNodes = this.getValidInitialNodes(),
            initialNode = initialNodes[0];

        if (initialNodes.length > 1) {
            // Create the modal view with all possible subsequent nodes
            var dialog = new AddNodeDialog();

            dialog.show(null, initialNodes.map(node => {
                return {node};
            }));
            dialog.onSelect = nodeInfo => {
                if (nodeInfo) {
                    this.createNode(nodeInfo.node.id);
                }
            };
        } else {
            this.createNode(initialNode.id);
        }
    };

    PipelineControl.prototype.getValidInitialNodes = function () {
        // Get all nodes that have no inputs
        return this._getAllValidChildren(this._currentNodeId)
            .map(id => this._client.getNode(id))
            .filter(node => !node.isAbstract() && !node.isConnection())
            // Checking the name (below) is simply convenience so we can
            // still create operation prototypes from Operation (which we
            // wouldn't be able to do if it was abstract - which it probably
            // should be)
            .filter(node => node.getAttribute('name') !== 'Operation')
            .map(node => this._getObjectDescriptor(node.getId()));
    };

    PipelineControl.prototype.createNode = function(baseId) {
        var parentId = this._currentNodeId,
            newNodeId = this._client.createNode({parentId, baseId});

        return newNodeId;
    };

    PipelineControl.prototype._getObjectDescriptor = function(id) {
        var desc = EasyDAGControl.prototype._getObjectDescriptor.call(this, id),
            node = this._client.getNode(id);

        desc.inputs = [];
        desc.outputs = [];
        if (this.hasMetaName(id, 'Operation')) {
            // Only decorate operations in the currently active node
            if (this._currentNodeId !== desc.parentId) {
                return desc;
            }

            // Add inputs and outputs
            var childrenIds = node.getChildrenIds(),
                inputId = childrenIds.find(cId => this.hasMetaName(cId, 'Inputs')),
                outputId = childrenIds.find(cId => this.hasMetaName(cId, 'Outputs')),
                inputs,
                outputs;

            inputs = inputId ? this._client.getNode(inputId).getChildrenIds() : [];
            outputs = outputId ? this._client.getNode(outputId).getChildrenIds() : [];

            // Add the inputs, outputs in the form:
            //   [ name, baseId ]
            desc.inputs = inputs.map(id => this.formatIO(id));
            desc.outputs = outputs.map(id => this.formatIO(id));

            // Remove the 'code' attribute
            if (desc.attributes.code) {
                delete desc.attributes[CONSTANTS.LINE_OFFSET];
                delete desc.attributes.code;
            }

            // Handle the display color
            desc.displayColor = desc.attributes[CONSTANTS.DISPLAY_COLOR] &&
                desc.attributes[CONSTANTS.DISPLAY_COLOR].value;
            delete desc.attributes[CONSTANTS.DISPLAY_COLOR];

        } else if (desc.isConnection) {
            // Set src, dst to siblings and add srcPort, dstPort
            desc.srcPort = desc.src;
            desc.dstPort = desc.dst;

            // Get the src/dst that are in the currentNode
            desc.src = this.getSiblingContaining(desc.src);
            desc.dst = this.getSiblingContaining(desc.dst);

            if (desc.src === null || desc.dst === null) {
                this.logger.warn(`Could not get src/dst for ${desc.id}`);
            }
        } else if (this.hasMetaName(desc.id, 'Data')) {  // port
            // Add nodeId for container
            desc.nodeId = this.getSiblingContaining(desc.id);
            // It is a data port if it has a parentId and the parent is either
            // 'Inputs' or 'Outputs'
            desc.isDataPort = desc.parentId &&
                (this.hasMetaName(desc.parentId, 'Inputs') || this.hasMetaName(desc.parentId, 'Outputs'));
        }
        return desc;
    };

    PipelineControl.prototype.getSiblingContaining = function(containedId) {
        var n = this._client.getNode(containedId);
        while (n && n.getParentId() !== this._currentNodeId) {
            n = this._client.getNode(n.getParentId());
        }
        return n && n.getId();
    };

    PipelineControl.prototype.formatIO = function(id) {
        var node = this._client.getNode(id);
        return {
            id: id,
            name: node.getAttribute('name')
        };
    };

    return PipelineControl;
});
