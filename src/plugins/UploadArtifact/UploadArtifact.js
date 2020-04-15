/*globals define*/
/*eslint-env node, browser*/

define([
    'deepforge/storage/index',
    'text!./metadata.json',
    'plugin/PluginBase',
    'deepforge/plugin/Artifacts',
], function (
    Storage,
    pluginMetadata,
    PluginBase,
    Artifacts
) {
    'use strict';

    pluginMetadata = JSON.parse(pluginMetadata);

    /**
     * Initializes a new instance of UploadArtifact.
     * @class
     * @augments {PluginBase}
     * @classdesc This class represents the plugin UploadArtifact.
     * @constructor
     */
    var UploadArtifact = function () {
        // Call base class' constructor.
        PluginBase.call(this);
        this.pluginMetadata = pluginMetadata;
    };

    /**
     * Metadata associated with the plugin. Contains id, name, version, description, icon, configStructue etc.
     * This is also available at the instance at this.pluginMetadata.
     * @type {object}
     */
    UploadArtifact.metadata = pluginMetadata;

    // Prototypical inheritance from PluginBase.
    UploadArtifact.prototype = Object.create(PluginBase.prototype);
    Object.assign(UploadArtifact.prototype, Artifacts.prototype);
    UploadArtifact.prototype.constructor = UploadArtifact;

    /**
     * Main function for the plugin to execute. This will perform the execution.
     * Notes:
     * - Always log with the provided logger.[error,warning,info,debug].
     * - Do NOT put any user interaction logic UI, etc. inside this method.
     * - callback always has to be called even if error happened.
     *
     * @param {function(string, plugin.PluginResult)} callback - the result callback
     */
    UploadArtifact.prototype.main = async function (callback) {
        const config = this.getCurrentConfig();
        const hash = config.dataHash;
        const baseName = config.dataTypeId;

        try {
            this.ensureCompatibleMeta();
            const name = await this.getAssetNameFromHash(hash) ||
                baseName[0].toLowerCase() + baseName.substring(1);
            const assetInfo =  await this.transfer(hash, config.storage, name);
            await this.createArtifact({type: baseName, name: name, data: assetInfo});
            await this.save(`Uploaded "${name}" data`);
            this.result.setSuccess(true);
            callback(null, this.result);
        } catch (err) {
            callback(err, this.result);
        }
    };

    UploadArtifact.prototype.transfer = async function (hash, storage, name) {
        const filename = `${this.projectId}/artifacts/${name}`;
        const gmeStorageClient = await Storage.getBackend('gme').getClient(this.logger);
        const dataInfo = gmeStorageClient.createDataInfo(hash);
        const content = await gmeStorageClient.getFile(dataInfo);

        const {id, config} = storage;
        const dstStorage = await Storage.getBackend(id).getClient(this.logger, config);
        return await dstStorage.putFile(filename, content);
    };

    UploadArtifact.prototype.getAssetNameFromHash = async function(hash){
        const metadata = await this.blobClient.getMetadata(hash);
        if (metadata) {
            return metadata.name.replace(/\.[^.]*?$/, '');
        }
    };

    return UploadArtifact;
});
