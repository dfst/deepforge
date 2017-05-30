/*globals define, _, Opentip*/
/*jshint browser: true, camelcase: false*/

define([
    'deepforge/Constants',
    'decorators/EllipseDecorator/EasyDAG/EllipseDecorator.EasyDAGWidget',
    'css!./OperationDecorator.EasyDAGWidget.css'
], function (
    CONSTANTS,
    DecoratorBase
) {

    'use strict';

    var OperationDecorator,
        NAME_MARGIN = 25,
        DECORATOR_ID = 'OperationDecorator',
        OPERATION_COLORS = {},
        PORT_TOOLTIP_OPTS = {
            tipJoint: 'left',
            removeElementsOnHide: true,
            style: 'dark'
        };

    // Operation nodes need to be able to...
    //     - show their ports
    //     - highlight ports
    //     - unhighlight ports
    //     - report the location of specific ports
    OPERATION_COLORS[CONSTANTS.OP.OUTPUT] = '#b0bec5';
    OPERATION_COLORS[CONSTANTS.OP.INPUT] = '#b0bec5';
    OperationDecorator = function (options) {
        options.color = OPERATION_COLORS[options.node.name] || options.color || '#78909c';
        DecoratorBase.call(this, options);

        this.id = this._node.id;
        this.$ports = this.$el.append('g')
            .attr('id', 'ports');
        this.$portTooltips = {};
    };

    _.extend(OperationDecorator.prototype, DecoratorBase.prototype);

    OperationDecorator.prototype.DECORATOR_ID = DECORATOR_ID;
    OperationDecorator.prototype.PORT_COLOR = {
        OPEN: '#90caf9',
        OCCUPIED: '#e57373'
    };

    OperationDecorator.prototype.condense = function() {
        var width = Math.max(this.nameWidth + 2 * NAME_MARGIN, this.dense.width);

        this.$body
            .transition()
            .attr('x', -width/2)
            .attr('y', 0)
            .attr('width', width)
            .attr('height', this.dense.height);

        // Clear the attributes
        this.clearFields();
        this.$attributes = this.$el.append('g')
            .attr('fill', 'none');

        this.createAttributeFields(0, width);
        this.createPointerFields(0, width, true);

        this.height = this.dense.height;
        this.width = width;

        this.$name.attr('y', this.height/2);

        this.$el
            .attr('transform', `translate(${this.width/2}, 0)`);
        this.expanded = false;
        this.onResize();
    };

    OperationDecorator.prototype.showPorts = function(ids, areInputs) {
        var allPorts = areInputs ? this._node.inputs : this._node.outputs,
            x = -this.width/2,
            dx = this.width/(allPorts.length+1),
            y = areInputs ? 0 : this.height;  // (this.height/2);

        allPorts.forEach(port => {
            x += dx;
            if (!ids || ids.indexOf(port.id) > -1) {
                this.renderPort(port, x, y, areInputs);
            }
        });
    };

    OperationDecorator.prototype.renderPort = function(port, x, y, isInput) {
        var color = this.PORT_COLOR.OPEN,
            portIcon = this.$ports.append('g'),
            tooltip;

        // If the port is incoming and occupied, render it differently
        if (isInput && port.connection) {
            color = this.PORT_COLOR.OCCUPIED;
        }

        portIcon.append('circle')
            .attr('cx', x)
            .attr('cy', y)
            .attr('r', 10)
            .attr('fill', color);
            
        portIcon.append('text')
                .attr('x', x)
                .attr('y', y)
                .attr('text-anchor', 'middle')
                .attr('dominant-baseline', 'middle')
                .attr('fill', 'black')
                .text(port.name[0]);

        portIcon.on('click', this.onPortClick.bind(this, this.id, port.id, !isInput));

        // Add tooltip with whole name
        if (this.$portTooltips[port.id]) {
            this.$portTooltips[port.id].hide();
        }
        tooltip = new Opentip(portIcon[0][0], PORT_TOOLTIP_OPTS);
        tooltip.setContent(port.name);
        portIcon.on('mouseenter', () => tooltip.show());
        portIcon.on('mouseleave', () => tooltip.hide());
        this.$portTooltips[port.id] = tooltip;
    };

    OperationDecorator.prototype.hidePorts = function() {
        var visiblePortIds = Object.keys(this.$portTooltips);
        this.logger.info(`hiding ports for ${this.name} (${this.id})`);
        this.$ports.remove();
        this.$ports = this.$el.append('g')
            .attr('id', 'ports');
        
        for (var i = visiblePortIds.length; i--;) {
            this.$portTooltips[visiblePortIds[i]].hide();
        }
    };

    OperationDecorator.prototype.getPortLocation = function(id, isInput) {
        // Report location of given port
        var ports = isInput ? this._node.inputs : this._node.outputs,
            i = ports.length-1,
            y;

        while (i >= 0 && ports[i].id !== id) {
            i--;
        }
        if (i !== -1) {
            i += 1;
            y = (this.height/2);
            return {
                x: i * this.width/(ports.length+1),
                y: isInput ? y * -1 : y
            };
        }
        return null;
    };

    OperationDecorator.prototype.onPortClick = function() {
        // Overridden in the widget
    };

    OperationDecorator.prototype.getDisplayName = function() {
        return this._node.name;
    };

    return OperationDecorator;
});
