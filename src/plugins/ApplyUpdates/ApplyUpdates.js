/*globals define*/
/*eslint-env node, browser*/

define([
    'deepforge/updates/Updates',
    'text!./metadata.json',
    'plugin/PluginBase'
], function (
    Updates,
    pluginMetadata,
    PluginBase
) {
    'use strict';

    pluginMetadata = JSON.parse(pluginMetadata);

    /**
     * Initializes a new instance of ApplyUpdates.
     * @class
     * @augments {PluginBase}
     * @classdesc This class represents the plugin ApplyUpdates.
     * @constructor
     */
    var ApplyUpdates = function () {
        // Call base class' constructor.
        PluginBase.call(this);
        this.pluginMetadata = pluginMetadata;
    };

    /**
     * Metadata associated with the plugin. Contains id, name, version, description, icon, configStructue etc.
     * This is also available at the instance at this.pluginMetadata.
     * @type {object}
     */
    ApplyUpdates.metadata = pluginMetadata;

    // Prototypical inheritance from PluginBase.
    ApplyUpdates.prototype = Object.create(PluginBase.prototype);
    ApplyUpdates.prototype.constructor = ApplyUpdates;

    /**
     * Main function for the plugin to execute. This will perform the execution.
     * Notes:
     * - Always log with the provided logger.[error,warning,info,debug].
     * - Do NOT put any user interaction logic UI, etc. inside this method.
     * - callback always has to be called even if error happened.
     *
     * @param {function(string, plugin.PluginResult)} callback - the result callback
     */
    ApplyUpdates.prototype.main = async function (callback) {
        // Retrieve the updates to apply
        const config = this.getCurrentConfig();
        const updateNames = config.updates || [];

        if (!updateNames.length) {
            this.result.setSuccess(true);
            return callback(null, this.result);
        }

        // Apply each of the updates
        const updates = Updates.getUpdates(updateNames);

        for (let i = 0, len = updates.length; i < len; i++) {
            const update = updates[i];
            this.logger.info(`Applying update: ${update.name} to ${this.projectId}`);
            await update.apply(this.core, this.rootNode, this.META);
        }

        // Save the project
        await this.save(`Applied project updates: ${updateNames.join(",")}`);

        this.result.setSuccess(true);
        callback(null, this.result);
    };

    return ApplyUpdates;
});
