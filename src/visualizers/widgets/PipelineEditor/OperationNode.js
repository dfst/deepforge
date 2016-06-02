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
        this.inputs = desc.inputs;
        this.outputs = desc.outputs;
        this._visiblePorts = null;
    };

    _.extend(OperationNode.prototype, DAGItem.prototype);

    OperationNode.prototype.setupDecoratorCallbacks = function() {
        DAGItem.prototype.setupDecoratorCallbacks.call(this);
        this.decorator.onPortClick = (id, portId, isSrc) => {
            var srcPort = this.inputs.find(port => port.id === portId);
            if (srcPort && srcPort.connection) {
                this.disconnectPort(portId, srcPort.connection);
            } else {
                this.connectPort(id, portId, isSrc);
            }
        };
    };

    // TODO: Change showPorts to just toggle the ports and show them on render
    OperationNode.prototype.showPorts = function(ids, areInputs) {
        this.decorator.hidePorts();
        this.decorator.showPorts(ids, areInputs);

        if (arguments.length === 0) {  // Show all
            this.decorator.showPorts(ids, !areInputs);
        }

        this._visiblePorts = arguments;
    };

    OperationNode.prototype.refreshPorts = function() {
        if (this._visiblePorts) {
            this.showPorts.apply(this, this._visiblePorts);
        }
    };

    OperationNode.prototype.getPortLocation = function(id, isInput) {
        var relpos = this.decorator.getPortLocation(id, isInput);
        return {
            x: relpos.x + this.x - this.width/2,
            y: relpos.y + this.y
        };
    };

    OperationNode.prototype.hidePorts = function() {
        this.decorator.hidePorts();
        this._visiblePorts = null;
    };

    OperationNode.prototype.updatePort = function(/*desc*/) {
        // TODO
    };

    OperationNode.prototype.addPort = function(/*desc*/) {
        // TODO
    };

    OperationNode.prototype.onSelect = function() {
        this.decorator.onSelect();
        this.showPorts();
    };

    OperationNode.prototype.onDeselect = function() {
        this.decorator.onDeselect();
        this.hidePorts();
    };

    return OperationNode;
});
