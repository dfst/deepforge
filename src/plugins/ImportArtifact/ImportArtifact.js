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
     * Initializes a new instance of ImportArtifact.
     * @class
     * @augments {PluginBase}
     * @classdesc This class represents the plugin ImportArtifact.
     * @constructor
     */
    var ImportArtifact = function () {
        // Call base class' constructor.
        PluginBase.call(this);
        this.pluginMetadata = pluginMetadata;
    };

    /**
     * Metadata associated with the plugin. Contains id, name, version, description, icon, configStructue etc.
     * This is also available at the instance at this.pluginMetadata.
     * @type {object}
     */
    ImportArtifact.metadata = pluginMetadata;

    // Prototypical inheritance from PluginBase.
    ImportArtifact.prototype = Object.create(PluginBase.prototype);
    Object.assign(ImportArtifact.prototype, Artifacts.prototype);
    ImportArtifact.prototype.constructor = ImportArtifact;

    /**
     * Main function for the plugin to execute. This will perform the execution.
     * Notes:
     * - Always log with the provided logger.[error,warning,info,debug].
     * - Do NOT put any user interaction logic UI, etc. inside this method.
     * - callback always has to be called even if error happened.
     *
     * @param {function(string, plugin.PluginResult)} callback - the result callback
     */
    ImportArtifact.prototype.main = async function (callback) {
        const config = this.getCurrentConfig();
        const hash = config.dataHash;
        const baseName = config.dataTypeId;
        const base = this.getBaseNode();

        if (!base) {
            callback(`Could not find data type "${baseName}"`, this.result);
            return;
        }
        try {
            const parent = await this.getArtifactsDir();
            const dataNode = this.core.createNode({base, parent});

            const name = await this.getAssetNameFromHash(hash) ||
                baseName[0].toLowerCase() + baseName.substring(1);
            let assetInfo;

            assetInfo = await this.transfer(hash, config.storage, name);

            this.assignAssetAttributes(dataNode, {type: baseName, name: name, data: assetInfo});
            await this.save(`Uploaded "${name}" data`);
            this.result.setSuccess(true);
            callback(null, this.result);
        } catch (err) {
            callback(err, this.result);
        }
    };

    ImportArtifact.prototype.transfer = async function (hash, storage, name) {
        const filename = `${this.projectId}/artifacts/${name}`;
        const gmeStorageClient = await Storage.getBackend('gme').getClient(this.logger);
        const dataInfo = gmeStorageClient.createDataInfo(hash);
        const content = await gmeStorageClient.getFile(dataInfo);

        const {id, config} = storage;
        const dstStorage = await Storage.getBackend(id).getClient(this.logger, config);
        return await dstStorage.putFile(filename, content);
    };

    return ImportArtifact;
});
