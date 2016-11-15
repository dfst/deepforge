/*globals define, _, */
/*jshint browser: true, camelcase: false*/

define([
    'decorators/LayerDecorator/EasyDAG/LayerDecorator.EasyDAGWidget',
    'js/Constants',
    'deepforge/Constants',
    './NestedLayer',
    'widgets/EasyDAG/Buttons',
    'css!./ContainerLayerDecorator.EasyDAGWidget.css'
], function (
    LayerDecorator,
    GME_CONSTANTS,
    CONSTANTS,
    NestedLayer,
    Buttons
) {

    'use strict';

    var ContainerLayerDecorator,
        ZOOM = 0.8,
        DECORATOR_ID = 'ContainerLayerDecorator';

    // Container layer nodes need to be able to nest the containedLayers
    // in order inside of themselves when expanded
    ContainerLayerDecorator = function (options) {
        this.nestedLayers = {};
        LayerDecorator.call(this, options);
        this.$nested = this.$el.append('g')
            .attr('class', 'nested-layers');

        // If clicked, deselect the given nested layer
        this.$el.on('click', () => {
            if (this.expanded) {
                Object.keys(this.nestedLayers).forEach(id => {
                    this.nestedLayers[id].widget.onBackgroundClick();
                });
            }
        });
        this.onNestedRefresh = _.debounce(this.updateExpand.bind(this), 50);

        // Add event handlers
        NestedLayer.prototype.addLayerBefore = function(layerId) {
            var decorator = this._parent,
                index = decorator._node.containedLayers.indexOf(this.id);
            return decorator.addLayerAt(layerId, index - 1);
        };

        NestedLayer.prototype.addLayerAfter = function(layerId) {
            var decorator = this._parent,
                index = decorator._node.containedLayers.indexOf(this.id);
            return decorator.addLayerAt(layerId, index + 1);
        };

        NestedLayer.prototype.isLast = function() {
            var index = this._parent._node.containedLayers.length - 1;
            return this._parent._node.containedLayers[index] === this.id;
        };

        NestedLayer.prototype.isFirst = function() {
            return this._parent._node.containedLayers[0] === this.id;
        };

        NestedLayer.prototype.moveLayerForward = function() {
            return this.moveLayer(true);
        };

        NestedLayer.prototype.moveLayerBackward = function() {
            return this.moveLayer();
        };

        NestedLayer.prototype.moveLayer = function(forward) {
            var decorator = this._parent,
                index = decorator._node.containedLayers.indexOf(this.id),
                client = decorator.client,
                msg;

            decorator._node.containedLayers.splice(index, 1);
            if (forward) {
                index = Math.max(0, index - 1);
            } else {
                index++;
            }

            decorator._node.containedLayers.splice(index, 0, this.id);

            msg = `Swapping nested layers at ${index} and ${forward ? index-1 : index+1}`;
            client.startTransaction(msg);
            decorator._updateNestedIndices();
            client.completeTransaction();
        };

        NestedLayer.prototype.onLastNodeRemoved = function() {
            var decorator = this._parent,
                index = decorator._node.containedLayers.indexOf(this.id),
                msg = `Removing nested layer of ${decorator._node.name} at position ${index}`;

            decorator.client.startTransaction(msg);
            decorator.client.deleteNode(this.id);
            decorator.client.completeTransaction();
        };
        this.updateNestedTerritory();
    };

    _.extend(ContainerLayerDecorator.prototype, LayerDecorator.prototype);

    ContainerLayerDecorator.prototype.DECORATOR_ID = DECORATOR_ID;

    ContainerLayerDecorator.prototype._updateNestedIndices = function() {
        this._node.containedLayers.forEach((layerId, index) => {
            // Set the layer's member registry to it's index
            this.client.setMemberRegistry(
                this._node.id,
                layerId,
                CONSTANTS.CONTAINED_LAYER_SET,
                CONSTANTS.CONTAINED_LAYER_INDEX,
                index
            );
        });
    };

    ContainerLayerDecorator.prototype.addLayerAt = function(baseId, index) {
        var client = this.client,
            parentId = this._node.id,
            archNode,
            newId,
            msg;

        // Get the index of the given layer
        index = Math.max(index, 0);

        archNode = client.getAllMetaNodes()
            .find(node => node.getAttribute('name') === 'Architecture');

        // Create a new Architecture node in the given node
        msg = `Adding layer to ${this._node.name} at position ${index}`;
        client.startTransaction(msg);

        newId = client.createNode({
            parentId: parentId,
            baseId: archNode.getId()
        });
        // Create the selected layer
        client.createNode({
            parentId: newId,
            baseId: baseId
        });
        client.addMember(parentId, newId, CONSTANTS.CONTAINED_LAYER_SET);
        this._node.containedLayers.splice(index, 0, newId);
        this._updateNestedIndices();

        client.completeTransaction();
    };

    ContainerLayerDecorator.prototype.condense = function() {
        // hide the nested layers
        this.$el.attr('class', 'centering-offset condense');
        this.removeCreateNestedBtn();
        return LayerDecorator.prototype.condense.apply(this, arguments);
    };

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
        for (var i = events.length; i--;) {
            switch (events[i].etype) {
            case GME_CONSTANTS.TERRITORY_EVENT_LOAD:
                if (!this.nestedLayers[events[i].eid]) {
                    this.createNestedWidget(events[i].eid);
                }
                break;

            case GME_CONSTANTS.TERRITORY_EVENT_UNLOAD:
                this.removeNestedWidget(events[i].eid);
                break;
            }
        }
        if (events.length > 1) {  // if more than just 'complete' event
            this.updateExpand();
        }
    };

    ContainerLayerDecorator.prototype.update = function(node) {
        var attrsUpdated = false,
            attrs = this._attributes;

        this._node = node;
        // Update the attributes
        this.setAttributes();
        attrsUpdated = !_.isEqual(attrs, this._attributes);

        // Check for a new nested layer
        var hasNewLayers = this._node.containedLayers
            .filter(id => !this.nestedLayers[id])
            .length > 0;

        if (hasNewLayers) {
            this.updateNestedTerritory();
        } else {
            // Update the order of the nested layers
            if (this._selected) {
                this.expand();
            } else {
                this.condense();
            }
        }
        // Only reset fieldsWidth if the attribute has gotten larger
        if (attrsUpdated) {
            this.fieldsWidth = null;
        }
    };

    ContainerLayerDecorator.prototype.updateExpand = function() {
        if (this.expanded) {
            this.expand();
        }
    };

    ContainerLayerDecorator.prototype.createNestedWidget = function(id) {
        if (!this.$nested) {
            this.$nested = this.$el.append('g')
                .attr('class', 'nested-layers');
        }

        this.nestedLayers[id] = new NestedLayer({
            $container: this.$nested,
            parent: this,
            client: this.client,
            logger: this.logger,
            onRefresh: this.onNestedRefresh,
            id: id
        });
        return this.nestedLayers[id];
    };

    ContainerLayerDecorator.prototype.removeNestedWidget = function(id) {
        this.nestedLayers[id].destroy();
        delete this.nestedLayers[id];
        this.updateExpand();
    };

    ContainerLayerDecorator.prototype._renderInfo = function(top, width) {
        var isAnUpdate = this.expanded,
            y = top;

        // Add the attribute fields
        this.clearFields();
        this.$attributes = this.$el.append('g')
            .attr('fill', '#222222');

        if (!isAnUpdate) {
            this.$attributes.attr('opacity', 0);
        }

        y = this.createAttributeFields(y, width);
        y = this.createPointerFields(y, width);

        if (y !== top) {
            y += this.ROW_HEIGHT/2;
        }
        return y;
    };

    ContainerLayerDecorator.prototype.expand = function() {
        // This should be rendered with the attributes
        var height,
            width,

            // Attributes
            initialY = 25,
            isAnUpdate = this.expanded,
            NAME_MARGIN = 15,
            nestedMargin = 15,  // minimum
            margin = 5,
            y = margin + initialY,
            x = margin,
            i;

        // Shift name down
        this.$name.attr('y', 20);

        // Add the nested children
        var ids = this._node.containedLayers.filter(id => this.nestedLayers[id]),
            totalNestedWidth = 0,
            maxNestedHeight = 0,
            fieldWidth,
            widget;

        if (ids.length === 0) {
            maxNestedHeight = CreateNestedBtn.SIZE * 2;
        } else {
            for (i = 0; i < ids.length; i++) {
                widget = this.nestedLayers[ids[i]].widget;
                totalNestedWidth += widget.getSvgWidth() * ZOOM;
                maxNestedHeight = Math.max(widget.getSvgHeight() * ZOOM, maxNestedHeight);

                // Update the buttons (in case of reorder)
                this.nestedLayers[ids[i]].refreshButtons();
            }
        }

        fieldWidth = this.fieldsWidth + 3 * NAME_MARGIN;
        width = Math.max(
            this.nameWidth + 2 * NAME_MARGIN,
            this.size.width,
            fieldWidth,
            totalNestedWidth + (ids.length + 1) * nestedMargin
        );

        // Render attributes
        y = this._renderInfo(y, fieldWidth);
        y += nestedMargin;

        // Update width, height
        height = y + maxNestedHeight + nestedMargin;

        // Equally space the nested widgets
        nestedMargin = (width - totalNestedWidth)/(ids.length + 1);
        x = nestedMargin - width/2;
        for (i = 0; i < ids.length; i++) {
            this.nestedLayers[ids[i]].$el
                .attr('transform', `translate(${x}, ${y}) scale(${ZOOM})`);
            x += this.nestedLayers[ids[i]].widget.getSvgWidth() * ZOOM + nestedMargin;
        }

        this.removeCreateNestedBtn();

        if (ids.length === 0) {
            // Add the 'create nested layer' button if no nested layers
            this.$createNestedBtn = new CreateNestedBtn({
                context: this,
                $pEl: this.$el,
                y: y + CreateNestedBtn.SIZE
            });
        }

        this.$body
            .transition()
            .attr('x', -width/2)
            .attr('y', 0)
            .attr('rx', 0)
            .attr('ry', 0)
            .attr('width', width)
            .attr('height', height)
            .each('end', () => {
                if (!isAnUpdate) {
                    this.$attributes.attr('opacity', 1);
                    this.$el.attr('class', 'centering-offset expand');
                }
            });

        if (this.height !== height || this.width !== width) {
            this.height = height;
            this.width = width;
            this.expanded = true;
            this.$el
                .attr('transform', `translate(${this.width/2}, 0)`);

            this.onResize();
        }
    };

    ContainerLayerDecorator.prototype.removeCreateNestedBtn = function() {
        if (this.$createNestedBtn) {
            this.$createNestedBtn.remove();
            this.$createNestedBtn = null;
        }
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
            this._nestedTerritoryUI = null;
        }
        this.destroyNested();
    };

    var CreateNestedBtn = function(params) {
        params.title = 'Add nested layer';
        Buttons.Add.call(this, params);
    };

    CreateNestedBtn.SIZE = Buttons.Add.SIZE;
    CreateNestedBtn.prototype = Object.create(Buttons.Add.prototype);

    CreateNestedBtn.prototype._onClick = function() {
        // Call addLayerAfter and prompt for a layer
        this.promptLayer()
            .then(layerId => this.addLayerAt(layerId, 0));
    };

    return ContainerLayerDecorator;
});
