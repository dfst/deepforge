/*globals define*/
/*eslint-env node, browser*/

define([
    'plugin/ImportLibrary/ImportLibrary/ImportLibrary',
    'deepforge/updates/Updates',
    'text!./metadata.json',
    'underscore',
], function (
    PluginBase,
    Updates,
    pluginMetadata,
    _,
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
        const {updates=[]} = config;

        if (!updates.length) {
            this.result.setSuccess(true);
            return callback(null, this.result);
        }

        // Apply each of the updates
        const [migrations, libUpdates] = _.partition(
            updates,
            update => update.type === Updates.MIGRATION
        );

        for (let i = 0, len = migrations.length; i < len; i++) {
            const update = migrations[i];
            this.logger.info(`Applying update: ${update.name} to ${this.projectId}`);
            await update.apply(this.core, this.rootNode, this.META);
        }

        for (let i = libUpdates.length; i--;) {
            const libraryInfo = libUpdates[i].info;
            await this.importLibrary(libraryInfo);
        }

        // Save the project
        const updateNames = updates.map(update => update.name);
        await this.save(`Applied project updates: ${updateNames.join(',')}`);

        this.result.setSuccess(true);
        callback(null, this.result);
    };

    return ApplyUpdates;
});
