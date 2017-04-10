/*globals define, WebGMEGlobal */
/*jshint browser: true*/

define([
    'js/Constants',
    'deepforge/Constants',
    'panels/EasyDAG/EasyDAGControl',
    'deepforge/viz/PipelineControl',
    'deepforge/viz/Execute',
    'underscore'
], function (
    GME_CONSTANTS,
    CONSTANTS,
    EasyDAGControl,
    PipelineControl,
    Execute,
    _
) {

    'use strict';

    var ExecutionViewControl;

    ExecutionViewControl = function (options) {
        EasyDAGControl.call(this, options);
        Execute.call(this, this._client, this._logger);
        this.addedNodes = {};
        this.originTerritory = {};
        this.originTerritoryId = null;
        this.readOnly = false;
    };

    _.extend(
        ExecutionViewControl.prototype,
        EasyDAGControl.prototype,
        PipelineControl.prototype,
        Execute.prototype
    );

    /* * * * * * * * Visualizer content update callbacks * * * * * * * */
    ExecutionViewControl.prototype.TERRITORY_RULE = {children: 4};
    ExecutionViewControl.prototype.DEFAULT_DECORATOR = 'JobDecorator';

    ExecutionViewControl.prototype.selectedObjectChanged = function(id) {
        EasyDAGControl.prototype.selectedObjectChanged.call(this, id);

        if (this._currentNodeId) {
            var desc = this.getExecDesc(this._currentNodeId);

            this._widget.setExecutionNode(desc);
            this.originId = desc.originId;

            // Add the originId to the territory and update it!
            if (this.originId) {
                if (this.originTerritoryId) {
                    this._client.removeUI(this.originTerritoryId);
                    this.originTerritory = {};
                }

                this.originTerritory[this.originId] = {children: 0};
                this.originTerritoryId = this._client.addUI(this, events => {
                    var event = events.find(event => event.eid !== null &&
                            event.eid === this.originId);

                    if (!event) {  // no relevant events
                        return;
                    }

                    if (event.etype === GME_CONSTANTS.TERRITORY_EVENT_UNLOAD) {
                        this.originId = null;
                        this._widget.onOriginDeleted();
                    } else {
                        var name = this._client.getNode(this.originId).getAttribute('name');
                        this._widget.setOriginPipeline(name);
                    }
                });
                this._client.updateTerritory(this.originTerritoryId, this.originTerritory);
            } else {
                this._widget.onOriginDeleted();
                if (this.originTerritoryId) {
                    this._client.removeUI(this.originTerritoryId);
                }
            }
            if (!this.readOnly) {
                this.checkPipelineExecution(this._client.getNode(id));
            }
        }
    };

    ExecutionViewControl.prototype.getExecDesc = function(id) {
        var node = this._client.getNode(id);

        return {
            isSnapshot: node.getAttribute('snapshot'),
            createdAt: node.getAttribute('createdAt'),
            originId: node.getPointer('origin').to
        };
    };

    ExecutionViewControl.prototype._getObjectDescriptor = function(id) {
        var desc = PipelineControl.prototype._getObjectDescriptor.call(this, id),
            childrenIds,
            node,
            opId;

        // If it is a job, add the operation attributes
        if (this.hasMetaName(id, 'Job')) {
            node = this._client.getNode(id);
            childrenIds = node.getChildrenIds();
            opId = childrenIds.find(id => this.hasMetaName(id, 'Operation'));

            desc.opAttributes = {};
            if (opId) {
                var opNode = this._client.getNode(opId),
                    attrs,
                    allAttrs = {},
                    hiddenAttrs = [
                        CONSTANTS.LINE_OFFSET,
                        CONSTANTS.DISPLAY_COLOR,
                        'code',
                        'name'
                    ],
                    i;

                opNode.getValidAttributeNames().concat(opNode.getAttributeNames())
                    .forEach(attr => allAttrs[attr] = true);

                // Remove skip values
                hiddenAttrs.forEach(attr => delete allAttrs[attr]);

                attrs = Object.keys(allAttrs);
                for (i = attrs.length; i--;) {
                    desc.opAttributes[attrs[i]] = {
                        name: attrs[i],
                        value: opNode.getAttribute(attrs[i]),
                        type: 'string'
                    };
                }

                // Pointers
                var allPtrs = {},
                    ptrs;

                opNode.getValidPointerNames().concat(opNode.getPointerNames())
                    .filter(ptr => ptr !== 'base')
                    .forEach(ptr => allPtrs[ptr] = true);

                ptrs = Object.keys(allPtrs);
                for (i = ptrs.length; i--;) {
                    desc.pointers[ptrs[i]] = opNode.getPointer(ptrs[i]).to;
                }

            } else {
                this.logger.error(`Job "${desc.name}" (${id}) is missing an operation!`);
            }
        }
        return desc;
    };

    ExecutionViewControl.prototype._onLoad = function(id) {
        var desc = this._getObjectDescriptor(id);

        if (desc.parentId === this._currentNodeId) {
            this.addedNodes[id] = true;
            EasyDAGControl.prototype._onLoad.call(this, id);
        }
    };

    ExecutionViewControl.prototype._onUnload = function(id) {
        if (this.addedNodes[id] === true) {
            EasyDAGControl.prototype._onUnload.call(this, id);
            delete this.addedNodes[id];
        }
    };

    ExecutionViewControl.prototype._onUpdate = function(id) {
        if (this.addedNodes[id] === true) {
            EasyDAGControl.prototype._onUpdate.call(this, id);
        }
    };

    ExecutionViewControl.prototype.onOriginClicked = function() {
        if (this.originId) {
            WebGMEGlobal.State.registerActiveObject(this.originId);
        }
    };

    return ExecutionViewControl;
});
