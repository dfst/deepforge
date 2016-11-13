/*globals define, _, */
/*jshint browser: true, camelcase: false*/

define([
    'decorators/LayerDecorator/EasyDAG/LayerDecorator.EasyDAGWidget',
    'js/Constants',
    'deepforge/Constants',
    './NestedLayer',
    'css!./ContainerLayerDecorator.EasyDAGWidget.css'
], function (
    LayerDecorator,
    GME_CONSTANTS,
    CONSTANTS,
    NestedLayer
) {

    'use strict';

    var ContainerLayerDecorator,
        ZOOM = 0.8,
        DECORATOR_ID = 'ContainerLayerDecorator';

    // Container layer nodes need to be able to nest the targets of their
    // 'addLayers' set in order inside of themselves when expanded
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
            console.log('creating node of type:', layerId);
            return this.addLayer(layerId, true);
        };

        NestedLayer.prototype.addLayerAfter = function(layerId) {
            return this.addLayer(layerId);
        };

        NestedLayer.prototype.addLayer = function(baseId, infront) {
            var decorator = this._parent,
                client = decorator.client,
                parentId = decorator._node.id,
                archNode,
                index,
                newId,
                msg;

            // Get the index of the given layer
            index = decorator._node.containedLayers.indexOf(this.id);
            if (infront) {
                index--;
            } else {
                index++;
            }
            index = Math.max(index, 0);

            archNode = client.getAllMetaNodes()
                .find(node => node.getAttribute('name') === 'Architecture');

            // Create a new Architecture node in the given node
            msg = `Adding layer to ${decorator._node.name} at position ${index}`;
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
            decorator._node.containedLayers.splice(index, 0, newId);
            decorator._updateNestedIndices();

            client.completeTransaction();
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
        var updateOrder = false;
        if (!this.expanded) {
            return;
        }

        for (var i = events.length; i--;) {
            switch (events[i].etype) {
            case GME_CONSTANTS.TERRITORY_EVENT_LOAD:
                if (!this.nestedLayers[events[i].eid]) {
                    this.createNestedWidget(events[i].eid);
                }
                break;

            case GME_CONSTANTS.TERRITORY_EVENT_UPDATE:
                console.log('node updated!', events[i].eid);
                updateOrder = true;
                break;

            case GME_CONSTANTS.TERRITORY_EVENT_UNLOAD:
                this.removeNestedWidget(events[i].eid);
                break;
            }
        }
        //if (this.expanded) {
            this._expand();
        //}
    };

    ContainerLayerDecorator.prototype.update = function() {
        LayerDecorator.prototype.update.apply(this, arguments);
        // Update the order of the nested layers
        // TODO
        console.log('updated node!');
    };

    ContainerLayerDecorator.prototype.updateExpand = function() {
        if (this.expanded) {
            this._expand();
        }
    };

    ContainerLayerDecorator.prototype.createNestedWidget = function(id) {
        var index = this._node.containedLayers.indexOf(id),
            len = this._node.containedLayers.length,
            type = index === 0 ? NestedLayer.FIRST : (index === len-1 ? NestedLayer.LAST : null);

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
            type: type,
            id: id
        });
        return this.nestedLayers[id];
    };

    ContainerLayerDecorator.prototype.removeNestedWidget = function(id) {
        this.nestedLayers[id].destroy();
        delete this.nestedLayers[id];
        this.updateExpand();
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
            nestedMargin = 10,
            margin = 5,
            y = margin,
            x = margin,
            dx, dy, i;

        // Only expand if the node has attributes to show
        //if (force || nameCount > 0) {

        y += initialY;

        // Add the nested children
        var ids = this._node.containedLayers.filter(id => this.nestedLayers[id]),
            totalNestedWidth = 0,
            maxNestedHeight = 0,
            widget;

        for (i = 0; i < ids.length; i++) {
            widget = this.nestedLayers[ids[i]].widget;
            totalNestedWidth += widget.getSvgWidth() * ZOOM;
            maxNestedHeight = Math.max(widget.getSvgHeight() * ZOOM, maxNestedHeight);
        }

        width = Math.max(
            this.nameWidth + 2 * NAME_MARGIN,
            this.size.width,
            this.fieldsWidth + 3 * NAME_MARGIN,
            totalNestedWidth + (ids.length + 1) * nestedMargin
        );

        // Render attributes
        y = this._renderInfo(y, width);
        // Get the height from the number of attributes

        // Shift name down
        this.$name.attr('y', 20);

        // Update width, height
        rx = width/2;
        dy = y - margin - initialY;
        height = margin + this.dense.height + dy + maxNestedHeight;

        if (maxNestedHeight) {
            height += margin;
        }

        // Equally space the nested widgets
        nestedMargin = (width - totalNestedWidth)/(ids.length + 1);
        x = nestedMargin - width/2;
        for (i = 0; i < ids.length; i++) {
            this.nestedLayers[ids[i]].$el
                .attr('transform', `translate(${x}, ${y}) scale(${ZOOM})`);
            x += this.nestedLayers[ids[i]].widget.getSvgWidth() * ZOOM + nestedMargin;
        }

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

        if (this.height !== height || this.width !== width) {
            this.height = height;
            this.width = width;
            this.expanded = true;
            this.$el
                .attr('transform', `translate(${this.width/2}, 0)`);

            this.onResize();
        }
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
