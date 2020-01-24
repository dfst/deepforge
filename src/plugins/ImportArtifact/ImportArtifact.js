/*globals define*/
/*eslint-env node, browser*/

define([
    'deepforge/storage/index',
    'text!./metadata.json',
    'plugin/PluginBase',
], function (
    Storage,
    pluginMetadata,
    PluginBase,
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
        const metaDict = this.core.getAllMetaNodes(this.activeNode);
        const metanodes = Object.keys(metaDict).map(id => metaDict[id]);
        const base = metanodes.find(node =>
            this.core.getAttribute(node, 'name') === 'Data'
        );

        if (!base) {
            callback(`Could not find data type "${baseName}"`, this.result);
            return;
        }

        // Get the base node
        const parent = await this.getArtifactsDir();
        const dataNode = this.core.createNode({base, parent});

        const name = await this.getAssetName(hash) ||
            baseName[0].toLowerCase() + baseName.substring(1);

        const assetInfo = await this.transfer(hash, config.storage, name);
        this.core.setAttribute(dataNode, 'data', JSON.stringify(assetInfo));
        this.core.setAttribute(dataNode, 'type', baseName);
        this.core.setAttribute(dataNode, 'createdAt', Date.now());

        try {
            this.core.setAttribute(dataNode, 'name', name);
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

    ImportArtifact.prototype.getAssetName = async function (hash) {
        const metadata = await this.blobClient.getMetadata(hash);
        if (metadata) {
            return metadata.name.replace(/\.[^.]*?$/, '');
        }
    };

    ImportArtifact.prototype.getArtifactsDir = async function() {
        // Find the artifacts dir
        const children = await this.core.loadChildren(this.rootNode);
        return children
            .find(child => this.core.getAttribute(child, 'name') === 'MyArtifacts') ||
                this.activeNode;
    };

    return ImportArtifact;
});
