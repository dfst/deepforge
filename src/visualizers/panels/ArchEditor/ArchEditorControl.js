/*globals define */
/*jshint browser: true*/

define([
    'deepforge/Constants',
    'deepforge/globals',
    'deepforge/viz/panels/ThumbnailControl',
    'js/NodePropertyNames',
    'js/Utils/ComponentSettings',
    'underscore'
], function (
    Constants,
    DeepForge,
    ThumbnailControl,
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
        ThumbnailControl.call(this, options);
        this._config = DEFAULT_CONFIG;
        ComponentSettings.resolveWithWebGMEGlobal(this._config, this.getComponentId());
    };

    _.extend(ArchEditorControl.prototype, ThumbnailControl.prototype);

    ArchEditorControl.prototype.TERRITORY_RULE = {children: 1};
    ArchEditorControl.prototype.DEFAULT_DECORATOR = 'LayerDecorator';
    ArchEditorControl.prototype.getComponentId = function() {
        return 'ArchEditor';
    };

    ArchEditorControl.prototype.selectedObjectChanged = function(id) {
        ThumbnailControl.prototype.selectedObjectChanged.call(this, id);

        DeepForge.last.Architecture = id;
        if (typeof id === 'string') {
            var name = this._client.getNode(id).getAttribute('name');
            this._widget.setTitle(name);
        }
    };

    ArchEditorControl.prototype._getObjectDescriptor = function(id) {
        var node = this._client.getNode(id),
            desc = ThumbnailControl.prototype._getObjectDescriptor.call(this, id);

        // Filter attributes
        if (!desc.isConnection) {
            var allAttrs = desc.attributes,
                names = Object.keys(allAttrs),
                ctorInfo = desc.attributes[Constants.CTOR_ARGS_ATTR],
                ctorAttrs = ctorInfo ? ctorInfo.value.split(','): [],
                schema,
                i;

            desc.attributes = {};

            // add ctor attributes
            for (i = 0; i < ctorAttrs.length; i++) {
                if (allAttrs[ctorAttrs[i]]) {  // (not a ref to a layer)
                    desc.attributes[ctorAttrs[i]] = allAttrs[ctorAttrs[i]];
                }
            }

            for (i = names.length; i--;) {
                // check if it is a setter
                schema = node.getAttributeMeta(names[i]);
                if (names[i] === 'name' || schema.setterType) {
                    desc.attributes[names[i]] = allAttrs[names[i]];
                }
            }

            // Add layer type (base class's base class)
            desc.layerType = null;
            if (desc.baseName) {
                var base = this._client.getNode(node.getMetaTypeId()),
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
            allLayers = [],
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
                if (!metanodes[i].isAbstract() && metanodes[i].isTypeOf(layerId)) {

                    if (metanodes[i].getAttribute('name') === 'Criterion') {
                        criterionId = metanodes[i].getId();
                    } else {
                        allLayers.push(metanodes[i].getId());
                    }
                }
            }
        }

        // Remove all criterion layers and abstract layers
        for (i = allLayers.length; i--;) {
            if (!allLayers[i].isTypeOf(criterionId)) {
                layers.push({node: this._getObjectDescriptor(allLayers[i].getId())});
            }
        }

        return layers;
    };

    ArchEditorControl.prototype._isValidTerminalNode = function() {
        return true;
    };

    // Widget extensions
    ArchEditorControl.prototype._initWidgetEventHandlers = function() {
        ThumbnailControl.prototype._initWidgetEventHandlers.call(this);
        this._widget.getCreateNewDecorator = this.getCreateNewDecorator.bind(this);
    };

    ArchEditorControl.prototype.getCreateNewDecorator = function() {
        return this._client.decoratorManager.getDecoratorForWidget(
            'LayerDecorator',
            'EasyDAG'
        );
    };

    return ArchEditorControl;
});
