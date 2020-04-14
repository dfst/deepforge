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
        const base = this.getBaseNode();
        const path = config.dataPath;
        const baseName = config.dataTypeId;

        if (!base) {
            callback(`Could not find data type "${baseName}"`, this.result);
            return;
        }

        const parent = await this.getArtifactsDir();
        const dataNode = this.core.createNode({base, parent});

        const name = await this.getAssetNameFromPath(path) ||
            baseName[0].toLowerCase() + baseName.substring(1);
        let assetInfo;

        try {

            assetInfo = await this.symLink(path, config.storage);
            this.assignAssetAttributes(dataNode, {data: assetInfo, name: name, type: baseName});
            await this.save(`Transferred "${name}" data`);
            this.result.setSuccess(true);
            callback(null, this.result);
        } catch (err) {
            callback(err, this.result);
        }

    };

    ImportArtifact.prototype.symLink = async function(path, storage) {
        const {id, config} = storage;
        if(path.includes(`${this.projectId}/artifacts`)){
            throw new Error('Cannot import from project root directory');
        }
        const srcStorage = await Storage.getBackend(id).getClient(this.logger, config);
        return await srcStorage.stat(path);
    };

    return ImportArtifact;
});
