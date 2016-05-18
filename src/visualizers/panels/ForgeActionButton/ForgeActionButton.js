/*globals define, _, WebGMEGlobal*/
/*jshint browser: true*/

define([
    'js/Constants',
    'panel/FloatingActionButton/FloatingActionButton',
    './Actions',
    'text!./PluginConfig.json'
], function (
    CONSTANTS,
    PluginButton,
    ACTIONS,
    PluginConfig
) {
    'use strict';

    var ForgeActionButton= function (layoutManager, params) {
        PluginButton.call(this, layoutManager, params);
        this._pluginConfig = JSON.parse(PluginConfig);
        this._actions = [];

        WebGMEGlobal.State.on('change:' + CONSTANTS.STATE_ACTIVE_OBJECT,
            this.addActionsForObject, this);

        this.logger.debug('ctor finished');
    };

    // inherit from PanelBaseWithHeader
    _.extend(ForgeActionButton.prototype, PluginButton.prototype);

    ForgeActionButton.prototype.addActionsForObject = function(models, nodeId) {
        var baseName,
            node = this.client.getNode(nodeId),
            base = this.client.getNode(node.getMetaTypeId()),
            base,
            actions,
            i;

        // Get node baseName and look up actions
        baseName = base ? base.getAttribute('name') : 'ROOT';

        // Remove old actions
        for (i = this._actions.length; i--;) {
            delete this.buttons[this._actions[i].name];
        }

        // Get node name and look up actions
        actions = ACTIONS[baseName] || [];
        for (i = actions.length; i--;) {
            this.buttons[actions[i].name] = actions[i];
        }

        this._actions = actions;
        this.update();
    };

    return ForgeActionButton;
});
