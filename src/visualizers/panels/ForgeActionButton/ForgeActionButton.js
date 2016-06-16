/*globals define, _ */
/*jshint browser: true*/

define([
    'js/Constants',
    'panel/FloatingActionButton/FloatingActionButton',
    'deepforge/viz/PipelineControl',
    './Actions',
    'widgets/EasyDAG/AddNodeDialog',
    'js/RegistryKeys',
    'js/Panels/MetaEditor/MetaEditorConstants',
    'q',
    'text!./PluginConfig.json'
], function (
    CONSTANTS,
    PluginButton,
    PipelineControl,
    ACTIONS,
    AddNodeDialog,
    REGISTRY_KEYS,
    META_CONSTANTS,
    Q,
    PluginConfig
) {
    'use strict';

    var ForgeActionButton= function (layoutManager, params) {
        PluginButton.call(this, layoutManager, params);
        this._pluginConfig = JSON.parse(PluginConfig);
        this._client = this.client;
        this._actions = [];

        this.logger.debug('ctor finished');
    };

    // inherit from PanelBaseWithHeader
    _.extend(
        ForgeActionButton.prototype,
        PluginButton.prototype,
        PipelineControl.prototype
    );

    ForgeActionButton.prototype.findActionsFor = function(nodeId) {
        var node = this.client.getNode(nodeId),
            base = this.client.getNode(node.getMetaTypeId()),
            isMeta = base && base.getId() === node.getId(),
            suffix = isMeta ? '_META' : '',
            actions,
            basename;

        while (base && !(actions && actions.length)) {
            basename = base.getAttribute('name') + suffix;
            base = this.client.getNode(base.getBaseId());
            actions = ACTIONS[basename];
            if (actions) {
                actions = actions.filter(action => !action.filter || action.filter());
            }
        }

        return actions || [];
    };

    ForgeActionButton.prototype.onNodeLoad = function(nodeId) {
        PluginButton.prototype.onNodeLoad.call(this, nodeId);
        this.addActionsForObject(nodeId);
    };

    ForgeActionButton.prototype.addActionsForObject = function(nodeId) {
        var actions = this.findActionsFor(nodeId),
            i;

        // Remove old actions
        for (i = this._actions.length; i--;) {
            delete this.buttons[this._actions[i].name];
        }

        // Get node name and look up actions
        for (i = actions.length; i--;) {
            this.buttons[actions[i].name] = actions[i];
        }

        this._actions = actions;
        this.update();
    };

    // Helper functions
    ForgeActionButton.prototype.addToMetaSheet = function(nodeId, metasheetName) {
        var root = this.client.getNode(CONSTANTS.PROJECT_ROOT_ID),
            metatabs = root.getRegistry(REGISTRY_KEYS.META_SHEETS),
            metatab = metatabs.find(tab => tab.title === metasheetName) || metatabs[0],
            metatabId = metatab.SetID;

        // Add to the general meta
        this.client.addMember(
            CONSTANTS.PROJECT_ROOT_ID,
            nodeId,
            META_CONSTANTS.META_ASPECT_SET_NAME
        );
        this.client.setMemberRegistry(
            CONSTANTS.PROJECT_ROOT_ID,
            nodeId,
            META_CONSTANTS.META_ASPECT_SET_NAME,
            REGISTRY_KEYS.POSITION,
            {
                x: 100,
                y: 100
            }
        );

        // Add to the specific sheet
        this.client.addMember(CONSTANTS.PROJECT_ROOT_ID, nodeId, metatabId);
        this.client.setMemberRegistry(
            CONSTANTS.PROJECT_ROOT_ID,
            nodeId,
            metatabId,
            REGISTRY_KEYS.POSITION,
            {
                x: 100,
                y: 100
            }
        );
    };

    ForgeActionButton.prototype.createNamedNode = function(baseId, isMeta) {
        var parentId = this._currentNodeId,
            newId = this.client.createChild({parentId, baseId}),
            basename = 'New' + this.client.getNode(baseId).getAttribute('name'),
            newName = this.getUniqueName(parentId, basename);

        // If instance, make the first char lowercase
        if (!isMeta) {
            newName = newName.substring(0, 1).toLowerCase() + newName.substring(1);
        }
        this.client.setAttributes(newId, 'name', newName);
        return newId;
    };

    ForgeActionButton.prototype.getUniqueName = function(parentId, basename) {
        var pNode = this.client.getNode(parentId),
            children = pNode.getChildrenIds().map(id => this.client.getNode(id)),
            name = basename,
            exists = {},
            i = 2;

        children.forEach(child => exists[child.getAttribute('name')] = true);

        while (exists[name]) {
            name = basename + '_' + i;
            i++;
        }

        return name;
    };

    ForgeActionButton.prototype.getLayerTypeDesc = function(node) {
        var decManager = this.client.decoratorManager,
            desc = {};

        desc.id = node.getId();
        desc.name = node.getAttribute('name');
        desc.baseName = desc.name;
        desc.attributes = {};
        desc.pointers = {};

        // Get the decorator
        desc.Decorator = decManager.getDecoratorForWidget('EllipseDecorator', 'EasyDAG');

        // Set the color
        desc.color = '#9e9e9e';
        return desc;
    };

    ForgeActionButton.prototype.promptLayerType = function() {
        // Prompt for the new custom layer's base type
        var deferred = Q.defer(),
            metanodes = this.client.getAllMetaNodes(),
            baseLayerId = metanodes.find(n => n.getAttribute('name') === 'Layer').getId(),
            layerType,
            types;

        // PoA:
        //   - Get the layer type ids
        //   - Create the descriptors
        //     - Get the color for the given types
        //       - Move colors to a constants dir?

        // Get the layer type ids
        layerType = metanodes
            .filter(node => node.getBaseId() === baseLayerId);

        //   - Create the descriptors
        types = layerType.map(node => {
            return {
                node: this.getLayerTypeDesc(node)
            };
        });

        AddNodeDialog.prompt(types, deferred.resolve);
        return deferred.promise;
    };

    return ForgeActionButton;
});
