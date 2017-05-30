/*globals define */
/*jshint browser: true*/

define([
    'deepforge/Constants',
    'deepforge/globals',
    'deepforge/viz/panels/ThumbnailControl',
    'js/NodePropertyNames',
    'js/Utils/ComponentSettings',
    'underscore',
    'q'
], function (
    Constants,
    DeepForge,
    ThumbnailControl,
    nodePropertyNames,
    ComponentSettings,
    _,
    Q
) {

    'use strict';

    var ArchEditorControl,
        DEFAULT_CONFIG = {
            DefaultColor: '#80cbc4',
            LayerColors: {
                Container: '#ffb74d',
                NestedContainer: '#ffe0b2',
                Convolution: '#42a5f5',
                Simple: '#ff9100',
                Transfer: '#80deea',
                Misc: '#ce93d8'
            }
        };

    ArchEditorControl = function (options) {
        ThumbnailControl.call(this, options);
        this._config = DEFAULT_CONFIG;
        ComponentSettings.resolveWithWebGMEGlobal(this._config, this.getComponentId());
        this.validateLayers = _.debounce(() => this.validateArchitecture(), 500);
    };

    _.extend(ArchEditorControl.prototype, ThumbnailControl.prototype);

    ArchEditorControl.prototype.TERRITORY_RULE = {children: 1};
    ArchEditorControl.prototype.DEFAULT_DECORATOR = 'LayerDecorator';
    ArchEditorControl.prototype.getComponentId = function() {
        return 'ArchEditor';
    };

    ArchEditorControl.prototype.selectedObjectChanged = function(id) {
        this.nestedLevel = typeof id === 'string' ?
            Math.floor(id.split('/').length/2) % 2 : 0;
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
                    if (desc.layerType === 'Container' && this.nestedLevel) {
                        color = this._config.LayerColors.NestedContainer;
                    }
                    if (!color) {
                        this._logger.warn(`No color found for ${desc.layerType}`);
                        color = this._config.DefaultColor;
                    }
                    desc.color = color;

                    if (desc.layerType === 'Container') {
                        desc.containedLayers = node.getMemberIds(Constants.CONTAINED_LAYER_SET)
                            .map(layerId => {
                                var index = node.getMemberRegistry(
                                    Constants.CONTAINED_LAYER_SET,
                                    layerId,
                                    Constants.CONTAINED_LAYER_INDEX
                                );
                                return [layerId, index];
                            })
                            .sort((a, b) => a[1] < b[1] ? -1 : 1)
                            .map(tuple => tuple[0]);

                        // Set the decorator to ContainerLayerDecorator
                        desc.Decorator = this._client.decoratorManager
                            .getDecoratorForWidget('ContainerLayerDecorator', 'EasyDAG');
                    }
                }
            }
        }
        return desc;
    };

    ////////////////////////// Layer Selection Logic //////////////////////////
    ArchEditorControl.prototype.getValidSuccessors =
    ArchEditorControl.prototype._getValidInitialNodes =
    ArchEditorControl.prototype.getNonCriterionLayers = function() {
        // Return all (non-criterion) layer types
        var metanodes = this._client.getAllMetaNodes(),
            layerId,
            connId,
            conn,
            criterionId,
            allLayers = [],
            layers = [],
            tgts,
            j,
            i;

        for (i = metanodes.length; i--;) {
            if (metanodes[i].getAttribute('name') === 'Layer') {
                layerId = metanodes[i].getId();
                break;
            }
        }

        // Remove all criterion layers and abstract layers
        for (i = metanodes.length; i--;) {
            if (layerId) {
                if (!metanodes[i].isAbstract() && metanodes[i].isTypeOf(layerId)) {

                    if (metanodes[i].getAttribute('name') === 'Criterion') {
                        criterionId = metanodes[i].getId();
                    } else {
                        allLayers.push(metanodes[i]);
                    }
                } else if (!connId && metanodes[i].getAttribute('name') === 'Connection') {  // Detect the layer connection type...
                    tgts = this._client.getPointerMeta(metanodes[i].getId(), 'src').items;
                    for (j = tgts.length; j--;) {
                        if (tgts[j].id === layerId) {
                            connId = metanodes[i].getId();
                        }
                    }
                }
            }
        }

        if (!connId) {
            this._logger.warn('Could not find a layer connector');
            return [];
        }
        // Convert the layers into the correct format
        conn = this._getObjectDescriptor(connId);
        // Remove all criterion layers and abstract layers
        for (i = allLayers.length; i--;) {
            if (!allLayers[i].isTypeOf(criterionId)) {
                layers.push({
                    node: this._getObjectDescriptor(allLayers[i].getId()),
                    conn: conn
                });
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
        this._widget.insertLayer = this.insertLayer.bind(this);
    };

    ArchEditorControl.prototype.getCreateNewDecorator = function() {
        return this._client.decoratorManager.getDecoratorForWidget(
            'LayerDecorator',
            'EasyDAG'
        );
    };

    ArchEditorControl.prototype.insertLayer = function(layerBaseId, connId) {
        var conn = this._client.getNode(connId),
            parentId = conn.getParentId(),
            layerId,
            nextLayerId = conn.getPointer('dst').to,
            connBaseId = conn.getBaseId(),
            newConnId,

            baseName = this._client.getNode(layerBaseId).getAttribute('name'),
            prevLayerId = conn.getPointer('src').to,
            srcName = this._client.getNode(prevLayerId).getAttribute('name'),
            dstName = this._client.getNode(nextLayerId).getAttribute('name'),
            msg = `Inserting ${baseName} layer between ${srcName} and ${dstName}`;

        this._client.startTransaction(msg);
        // Create the new layer
        layerId = this._client.createNode({
            parentId: parentId,
            baseId: layerBaseId
        });

        // Connect the new layer to the previous dst of 'connId'
        newConnId = this._client.createNode({
            parentId: parentId,
            baseId: connBaseId
        });
        this._client.setPointer(newConnId, 'src', layerId);
        this._client.setPointer(newConnId, 'dst', nextLayerId);

        // Change the dst of 'connId' to the new layer
        this._client.setPointer(connId, 'dst', layerId);

        this._client.completeTransaction();
    };

    ArchEditorControl.prototype._eventCallback = function() {
        ThumbnailControl.prototype._eventCallback.apply(this, arguments);
        this.validateLayers();
    };

    ArchEditorControl.prototype.validateArchitecture = function() {
        var pluginId = 'ValidateArchitecture',
            context = this._client.getCurrentPluginContext(pluginId);

        this._logger.info('about to validate arch');
        // Run the plugin in the browser (set namespace)
        context.managerConfig.namespace = 'nn';
        context.pluginConfig = {};
        Q.ninvoke(this._client, 'runServerPlugin', pluginId, context)
            .then(res => {
                var results = res.messages[0].message;
                if (results.errors !== null) {
                    this._widget.displayErrors(results.errors);
                }
            })
            .fail(err => this._logger.warn(`Validation failed: ${err}`));
    };

    return ArchEditorControl;
});
