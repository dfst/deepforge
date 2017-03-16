/*globals define, d3 */
define([
    'widgets/EasyDAG/DAGItem',
    'underscore'
], function(
    DAGItem,
    _
) {

    'use strict';
    var OperationNode = function(parentEl, desc) {
        var decoratorOpts = {
            color: desc.displayColor
        };
        DAGItem.call(this, parentEl, desc, decoratorOpts);
        this.inputs = desc.inputs;
        this.outputs = desc.outputs;
        this._visiblePorts = null;

        this._hovering = false;
        this.$el.on('mouseenter', () => this.onHover());
        this.$el.on('mouseleave', () => this._hovering && this.onUnhover());
    };

    _.extend(OperationNode.prototype, DAGItem.prototype);

    OperationNode.prototype.setupDecoratorCallbacks = function() {
        DAGItem.prototype.setupDecoratorCallbacks.call(this);
        this.decorator.onPortClick = (id, portId, isSrc) => {
            var srcPort = this.inputs.find(port => port.id === portId);

            d3.event.stopPropagation();
            d3.event.preventDefault();

            if (srcPort && srcPort.connection) {
                this.disconnectPort(portId, srcPort.connection);
                this.hidePorts();
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

    OperationNode.prototype.removePort = function(id) {
        // Find the given port and remove it
        [this.inputs, this.outputs]  // Look for the port in both lists
            .forEach(ports => {
                var port = ports.find(p => p.id === id),
                    i;

                if (port) {
                    i = ports.indexOf(port);
                    ports.splice(i, 1);
                }
            });
    };

    OperationNode.prototype.updatePort = function(/*desc*/) {
        // TODO
    };

    OperationNode.prototype.addPort = function(/*desc*/) {
        // TODO
    };

    OperationNode.prototype.onHover = function() {
        if (!this.isSelected() && this.canShowPorts()) {
            this.showPorts();
            this._hovering = true;
        }
    };

    OperationNode.prototype.onUnhover = function() {
        // Only fire these events if:
        //  - not selected
        //  - not creating a connection in the widget
        if (!this.isSelected() && this.canShowPorts()) {
            this.hidePorts();
            this._hovering = false;
        }
    };

    OperationNode.prototype.onSelect = function() {
        DAGItem.prototype.onSelect.call(this);
        if (this._hovering) {
            this._hovering = false;
        }

        this.showPorts();
    };

    OperationNode.prototype.onDeselect = function() {
        DAGItem.prototype.onDeselect.call(this);
        this.hidePorts();
    };

    OperationNode.prototype.update = function(desc) {
        DAGItem.prototype.update.apply(this, arguments);
        this.inputs = desc.inputs;
        this.outputs = desc.outputs;
        if (this._visiblePorts) {
            var areInputs = this._visiblePorts[1];
            this.showPorts.call(this, null, areInputs);
        }
    };

    return OperationNode;
});
