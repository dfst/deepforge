/*globals define*/
/*eslint-env node, browser*/

define([
    'plugin/PluginConfig',
    'text!./metadata.json',
    'plugin/PluginBase',
    'deepforge/storage/index',
    'deepforge/plugin/Artifacts'
], function (
    PluginConfig,
    pluginMetadata,
    PluginBase,
    Storage,
    Artifacts) {
    'use strict';

    pluginMetadata = JSON.parse(pluginMetadata);
    const ImportArtifact = function () {
        // Call base class' constructor.
        PluginBase.call(this);
        this.pluginMetadata = pluginMetadata;
    };

    ImportArtifact.metadata = pluginMetadata;

    // Prototypical inheritance from PluginBase.
    ImportArtifact.prototype = Object.create(PluginBase.prototype);
    Object.assign(ImportArtifact.prototype, Artifacts.prototype);

    ImportArtifact.prototype.constructor = ImportArtifact;

    ImportArtifact.prototype.main = async function (callback) {
        const config = this.getCurrentConfig();
        const path = config.dataPath;
        const baseName = config.dataTypeId;

        try {
            this.ensureCompatibleMeta();
            const name = await this.getAssetNameFromPath(path) ||
                baseName[0].toLowerCase() + baseName.substring(1);
            const assetInfo = await this.symLink(path, config.storage);
            await this.createArtifact({data: assetInfo, name: name, type: baseName});
            await this.save(`Successfully imported ${name} data`);
            this.result.setSuccess(true);
            callback(null, this.result);
        } catch (err) {
            callback(err, this.result);
        }

    };

    ImportArtifact.prototype.symLink = async function(path, storage) {
        const {id, config} = storage;
        const srcStorage = await Storage.getBackend(id).getClient(this.logger, config);
        return await srcStorage.stat(path);
    };

    ImportArtifact.prototype.getAssetNameFromPath = async function (path) {
        return path.split('/').pop();
    };

    return ImportArtifact;
});
