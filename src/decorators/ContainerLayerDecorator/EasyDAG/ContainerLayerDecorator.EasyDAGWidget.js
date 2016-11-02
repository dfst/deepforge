/*globals define, _, */
/*jshint browser: true, camelcase: false*/

define([
    'decorators/LayerDecorator/EasyDAG/LayerDecorator.EasyDAGWidget',
    'js/Constants',
    'panels/ArchEditor/ArchEditorControl',
    'widgets/ArchEditor/ArchEditorWidget'
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
        this.nestedLayers = [];
        LayerDecorator.call(this, options);
    };

    _.extend(ContainerLayerDecorator.prototype, LayerDecorator.prototype);

    ContainerLayerDecorator.prototype.DECORATOR_ID = DECORATOR_ID;

    // TODO: when the node is updated, it should add the containedLayers to the territory

    ContainerLayerDecorator.prototype.expand = function() {
        // TODO: instantiate an ArchEditor here...

        return LayerDecorator.prototype.expand.apply(this, arguments);
    };

    ContainerLayerDecorator.prototype.createNestedWidget = function(id) {
        var widget,
            archEditor,
            nop = () => {};

        this.$nested = this.$el.append('g')
            .attr('class', 'nested-layers');
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
        this.nestedLayers.push(archEditor);
        //this.$body.append(widget.$svg);
        return archEditor;
    };

    // Include the nested layers in the updateTerritory method
    ContainerLayerDecorator.prototype.updateTerritory = function() {
        LayerDecorator.prototype.updateTerritory.call(this);
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
            case CONSTANTS.TERRITORY_EVENT_LOAD:
                var editor = this.createNestedWidget(events[i].eid);
                break;

            case CONSTANTS.TERRITORY_EVENT_UNLOAD:
                // TODO: Remove the given 
                break;
            }
        }
    };

    ContainerLayerDecorator.prototype.destroyNested = function() {
        this.nestedLayers.forEach(layer => layer.destroy());
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
