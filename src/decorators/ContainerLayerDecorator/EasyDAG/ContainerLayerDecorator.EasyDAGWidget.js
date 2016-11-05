/*globals define, _, */
/*jshint browser: true, camelcase: false*/

define([
    'decorators/LayerDecorator/EasyDAG/LayerDecorator.EasyDAGWidget',
    'js/Constants',
    'panels/ArchEditor/ArchEditorControl',
    'widgets/ArchEditor/ArchEditorWidget',
    'css!./ContainerLayerDecorator.EasyDAGWidget.css'
], function (
    LayerDecorator,
    CONSTANTS,
    ArchEditor,
    ArchEditorWidget
) {

    'use strict';

    var ContainerLayerDecorator,
        DECORATOR_ID = 'ContainerLayerDecorator';

    // Container layer nodes need to be able to nest the targets of their
    // 'addLayers' set in order inside of themselves when expanded
    ContainerLayerDecorator = function (options) {
        this.nestedLayers = {};
        LayerDecorator.call(this, options);
        this.$nested = this.$el.append('g')
            .attr('class', 'nested-layers');
    };

    _.extend(ContainerLayerDecorator.prototype, LayerDecorator.prototype);

    ContainerLayerDecorator.prototype.DECORATOR_ID = DECORATOR_ID;

    // TODO: when the node is updated, it should add the containedLayers to the territory

    ContainerLayerDecorator.prototype.expand = function() {
        // Load the new territory
        this.expanded = true;
        this.$el.attr('class', 'centering-offset expand');
        this.updateNestedTerritory();
    };

    ContainerLayerDecorator.prototype.condense = function() {
        // hide the nested layers
        this.$el.attr('class', 'centering-offset condense');
        return LayerDecorator.prototype.condense.apply(this, arguments);
    };

    // Include the nested layers in the updateTerritory method
    //ContainerLayerDecorator.prototype.updateTerritory = function() {
    //};
    ContainerLayerDecorator.prototype.updateNestedTerritory = function() {
        // Add the nested layers and update
        if (!this._nestedTerritoryUI) {
            this._nestedTerritoryUI = this.client.addUI(this, this._containedEvents.bind(this));
        }
        this._territory = {};
        this._node.containedLayers.forEach(id => this._territory[id] = {children: 0});
        this.client.updateTerritory(this._nestedTerritoryUI, this._territory);
    };

    ContainerLayerDecorator.prototype._containedEvents = function(events) {
        if (!this.expanded) {
            return;
        }

        for (var i = events.length; i--;) {
            switch (events[i].etype) {
            case CONSTANTS.TERRITORY_EVENT_LOAD:
                this.createNestedWidget(events[i].eid);
                break;

            case CONSTANTS.TERRITORY_EVENT_UNLOAD:
                this.removeNestedWidget(events[i].eid);
                break;
            }
        }
        //if (this.expanded) {
            this._expand();
        //}
    };

    ContainerLayerDecorator.prototype.createNestedWidget = function(id) {
        var widget,
            archEditor,
            nop = () => {};

        if (!this.$nested) {
            this.$nested = this.$el.append('g')
                .attr('class', 'nested-layers');
        }

        widget = new ArchEditorWidget({
            logger: this.logger.fork('ArchWidget'),
            svg: this.$nested
        });
        widget.setTitle = () => {};
        archEditor = new ArchEditor({
            logger: this.logger.fork('ArchControl'),
            client: this.client,
            embedded: true,
            widget: widget
        });
        // hack :(
        archEditor.$btnModelHierarchyUp = {
            show: nop,
            hide: nop
        };
        widget.active = true;
        archEditor.selectedObjectChanged(id);

        // Add the nested widget to the visualizer
        this.nestedLayers[id] = archEditor;
        return archEditor;
    };

    ContainerLayerDecorator.prototype.removeNestedWidget = function(id) {
        this.nestedLayers[id].destroy();
        delete this.nestedLayers[id];
    };

    ContainerLayerDecorator.prototype._renderInfo = function(y, width) {
        var isAnUpdate = this.expanded;

        // Add the attribute fields
        y += y;
        this.clearFields();
        this.$attributes = this.$el.append('g')
            .attr('fill', '#222222');

        if (!isAnUpdate) {
            this.$attributes.attr('opacity', 0);
        }

        y = this.createAttributeFields(y, width);
        y = this.createPointerFields(y, width);
        return y;
    };

    ContainerLayerDecorator.prototype._expand = function(force) {
        // TODO: render the expanded node; assume that the nested layers are loaded
        // TODO
        //
        // This should be rendered with the attributes
        var height,
            width,
            rx,

            // Attributes
            initialY = 25,
            attrNames = Object.keys(this._attributes),
            nameCount = (this.ptrNames.length + attrNames.length),
            isAnUpdate = this.expanded,
            NAME_MARGIN = 15,
            margin = 5,
            y = margin,
            dy;

        // Only expand if the node has attributes to show
        //if (force || nameCount > 0) {
            width = Math.max(
                this.nameWidth + 2 * NAME_MARGIN,
                this.size.width,
                this.fieldsWidth + 3 * NAME_MARGIN
            );

            y += initialY;
            // TODO: Add the nested children
            // this.addNestedChildren();
            var ids = Object.keys(this.nestedLayers),
                totalNestedWidth = 0,
                widget;

            // TODO: Sort these by their registry value
            for (var i = ids.length; i--;) {
                widget = this.nestedLayers[ids[i]]._widget;
                totalNestedWidth += widget.getSvgWidth();

                // Position the widgets
                // TODO
            }

            y = this._renderInfo(y, width);
            // Get the height from the number of attributes

            // Shift name down
            this.$name.attr('y', 20);

            // Update width, height
            rx = width/2;
            dy = y - margin - initialY;
            height = margin + this.dense.height + dy;
            this.$body
                .transition()
                .attr('x', -rx)
                .attr('y', 0)
                .attr('rx', 0)
                .attr('ry', 0)
                .attr('width', width)
                .attr('height', height)
                .each('end', (a1, a2) => {
                    if (!isAnUpdate) {
                        this.$attributes.attr('opacity', 1);
                    }
                });

            this.height = height;
            this.width = width;
            this.expanded = true;
            this.$el
                .attr('transform', `translate(${this.width/2}, 0)`);
        //} else if (isAnUpdate) {
            //this.condense();
        //}
    };

    ContainerLayerDecorator.prototype.addNestedChildren = function() {
        // TODO
    };

    ContainerLayerDecorator.prototype.destroyNested = function() {
        Object.keys(this.nestedLayers).forEach(id => this.nestedLayers[id].destroy());
        this.nestedLayers = {};

        if (this.$nested) {
            this.$nested.remove();
            this.$nested = this.$el.append('g')
                .attr('class', 'nested-layers');
        }
    };

    ContainerLayerDecorator.prototype.destroy = function() {
        LayerDecorator.prototype.destroy.call(this);
        if (this._nestedTerritoryUI) {
            this.client.removeUI(this._nestedTerritoryUI);
        }
        this.destroyNested();
    };

    // TODO: Override 'expand' to add the set members and an 'add' button
    // Can I make a nested architecture editor and put it in this decorator?
    // - Some events may need to be synchronized (exiting connection mode)
    return ContainerLayerDecorator;
});
