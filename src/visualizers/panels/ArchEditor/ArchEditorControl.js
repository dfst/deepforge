/*globals define */
/*jshint browser: true*/

define([
    'deepforge/globals',
    'panels/EasyDAG/EasyDAGControl',
    'js/NodePropertyNames',
    'js/Utils/ComponentSettings',
    'underscore'
], function (
    DeepForge,
    EasyDAGControl,
    nodePropertyNames,
    ComponentSettings,
    _
) {

    'use strict';

    var ArchEditorControl,
        DEFAULT_CONFIG = {
            DefaultColor: '#ffb74d',
            LayerColors: {
                Containers: '#ffb74d',
                Convolution: '#2196f3',
                Simple: '#ff9100',
                Transfer: '#80deea',
                Misc: '#ce93d8'
            }
        };

    ArchEditorControl = function (options) {
        EasyDAGControl.call(this, options);
        this._config = DEFAULT_CONFIG;
        ComponentSettings.resolveWithWebGMEGlobal(this._config, this.getComponentId());
    };

    _.extend(ArchEditorControl.prototype, EasyDAGControl.prototype);

    ArchEditorControl.prototype.TERRITORY_RULE = {children: 1};
    ArchEditorControl.prototype.getComponentId = function() {
        return 'ArchEditor';
    };

    ArchEditorControl.prototype.selectedObjectChanged = function(id) {
        EasyDAGControl.prototype.selectedObjectChanged.call(this, id);

        DeepForge.last.Architecture = id;
        if (typeof id === 'string') {
            var name = this._client.getNode(id).getAttribute('name');
            this._widget.setTitle(name);
        }
    };

    ArchEditorControl.prototype._getObjectDescriptor = function(id) {
        var desc = EasyDAGControl.prototype._getObjectDescriptor.call(this, id);

        // Filter attributes
        if (!desc.isConnection) {
            var allAttrs = desc.attributes,
                names = Object.keys(allAttrs),
                schema;

            desc.attributes = {};
            for (var i = names.length; i--;) {
                schema = this._client.getAttributeSchema(id, names[i]);
                if (names[i] === 'name' || schema.hasOwnProperty('argindex') ||
                    schema.setterType) {
                    desc.attributes[names[i]] = allAttrs[names[i]];
                }
            }

            // Add layer type (base class's base class)
            desc.layerType = null;
            if (desc.baseName) {
                var node = this._client.getNode(id),
                    base = this._client.getNode(node.getMetaTypeId()),
                    layerType = this._client.getNode(base.getBaseId()),
                    color;

                desc.baseName = base.getAttribute(nodePropertyNames.Attributes.name);
                if (layerType) {
                    desc.layerType = layerType.getAttribute(nodePropertyNames.Attributes.name);

                    color = this._config.LayerColors[desc.layerType];
                    if (!color) {
                        this._logger.warn(`No color found for ${desc.layerType}`);
                        color = this._config.DefaultColor;
                    }
                    desc.color = color;
                }
            }
        }
        return desc;
    };

    ////////////////////////// Layer Selection Logic //////////////////////////
    ArchEditorControl.prototype._getValidInitialNodes = function() {
        return this._client.getChildrenMeta(this._currentNodeId).items
            // For now, anything is possible!
            // FIXME
            .map(info => this._getAllDescendentIds(info.id))
            .reduce((prev, curr) => prev.concat(curr))
            // Filter all abstract nodes
            .filter(nodeId => {
                return !this._client.getNode(nodeId).isAbstract();
            })
            .map(id => this._getObjectDescriptor(id))
            .filter(obj => !obj.isConnection && obj.name !== 'Connection')
            .filter(layer => layer.layerType !== 'Criterion');
    };

    ArchEditorControl.prototype._getValidSuccessorNodes =
    ArchEditorControl.prototype._getValidInitialNodes =
    ArchEditorControl.prototype.getNonCriterionLayers = function() {
        // Return all (non-criterion) layer types
        var metanodes = this._client.getAllMetaNodes(),
            layerId,
            criterionId,
            allLayerIds = [],
            layers = [],
            i;

        for (i = metanodes.length; i--;) {
            if (metanodes[i].getAttribute('name') === 'Layer') {
                layerId = metanodes[i].getId();
                break;
            }
        }

        for (i = metanodes.length; i--;) {
            if (layerId) {
                if (!metanodes[i].isAbstract() &&
                    this._client.isTypeOf(metanodes[i].getId(), layerId)) {

                    if (metanodes[i].getAttribute('name') === 'Criterion') {
                        criterionId = metanodes[i].getId();
                    } else {
                        allLayerIds.push(metanodes[i].getId());
                    }
                }
            }
        }

        // Remove all criterion layers and abstract layers
        for (i = allLayerIds.length; i--;) {
            if (!this._client.isTypeOf(allLayerIds[i], criterionId)) {
                layers.push({node: this._getObjectDescriptor(allLayerIds[i])});
            }
        }

        return layers;
    };

    ArchEditorControl.prototype._isValidTerminalNode = function() {
        return true;
    };

    // Widget extensions
    ArchEditorControl.prototype._initWidgetEventHandlers = function() {
        EasyDAGControl.prototype._initWidgetEventHandlers.call(this);
        this._widget.getCreateNewDecorator = this.getCreateNewDecorator.bind(this);
    };

    ArchEditorControl.prototype.getCreateNewDecorator = function() {
        return this._client.decoratorManager.getDecoratorForWidget(
            'EllipseDecorator',
            'EasyDAG'
        );
    };

    return ArchEditorControl;
});
