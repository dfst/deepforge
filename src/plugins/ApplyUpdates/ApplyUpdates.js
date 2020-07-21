/*globals define*/
/*eslint-env node, browser*/

define([
    'deepforge/updates/Updates',
    'text!./metadata.json',
    'plugin/ImportLibrary/ImportLibrary/ImportLibrary',
], function (
    Updates,
    pluginMetadata,
    PluginBase,
) {
    'use strict';

    pluginMetadata = JSON.parse(pluginMetadata);

    const ApplyUpdates = function () {
        PluginBase.call(this);
        this.pluginMetadata = pluginMetadata;
    };

    ApplyUpdates.metadata = pluginMetadata;

    // Prototypical inheritance from PluginBase.
    ApplyUpdates.prototype = Object.create(PluginBase.prototype);
    ApplyUpdates.prototype.constructor = ApplyUpdates;

    ApplyUpdates.prototype.main = async function (callback) {
        // Retrieve the updates to apply
        const config = this.getCurrentConfig();
        if (!config.updates.length) {
            this.result.setSuccess(true);
            return callback(null, this.result);
        }

        const [libUpdates, migrations] = partition(
            config.updates,
            update => update.type === Updates.SEED
        );
        await this.applyLibraryUpdates(libUpdates);
        await this.applyMigrations(migrations);
        const updateDisplayNames = config.updates
            .map(update => update.type === Updates.SEED ? `${update.name} (library)` : update.name)
            .join(', ');

        await this.save(`Applied project updates: ${updateDisplayNames}`);

        this.result.setSuccess(true);
        callback(null, this.result);
    };

    ApplyUpdates.prototype.applyLibraryUpdates = async function (updates) {
        for (let i = 0; i < updates.length; i++) {
            const {name} = updates[i];
            const {branchInfo, rootHash, libraryData} = await this.createGMELibraryFromSeed(name);
            await this.core.updateLibrary(this.rootNode, name, rootHash, libraryData);
            await this.removeTemporaryBranch(branchInfo);
        }
    };

    ApplyUpdates.prototype.applyMigrations = async function (migrations) {
        const updateNames = migrations.map(migration => migration.name);
        const updates = Updates.getUpdates(updateNames);

        for (let i = 0, len = updates.length; i < len; i++) {
            const update = updates[i];
            this.logger.info(`Applying update: ${update.name} to ${this.projectId}`);
            await update.apply(this.core, this.rootNode, this.META);
        }

    };

    function partition(data, fn) {
        const partitioned = [[], []];
        data.forEach(datum => {
            const partitionIndex = fn(datum) ? 0 : 1;
            const partition = partitioned[partitionIndex];
            partition.push(datum);
        });
        return partitioned;
    }

    return ApplyUpdates;
});
