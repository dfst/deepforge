/*globals define, _ */
/*jshint browser: true*/

define([
    'js/Constants',
    'panel/FloatingActionButton/FloatingActionButton',
    'deepforge/viz/PipelineControl',
    './Actions',
    'text!./PluginConfig.json'
], function (
    CONSTANTS,
    PluginButton,
    PipelineControl,
    ACTIONS,
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
            isMeta = base.getId() === node.getId(),
            suffix = isMeta ? '_META' : '',
            basename;

        while (base && !ACTIONS[basename]) {
            basename = base.getAttribute('name') + suffix;
            base = this.client.getNode(base.getBaseId());
        }

        return ACTIONS[basename] || [];
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

    return ForgeActionButton;
});
