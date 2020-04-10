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
        const hashOrPath = config.dataHash || config.dataPath;
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

        const name = await this.getAssetName(hashOrPath) ||
            baseName[0].toLowerCase() + baseName.substring(1);
        let assetInfo;

        try {
            if(config.dataHash){
                assetInfo = await this.transfer(hashOrPath, config.storage, name);
            } else if(config.dataPath) {

                assetInfo = await this.symLink(hashOrPath, config.storage);
            }

            this.core.setAttribute(dataNode, 'data', JSON.stringify(assetInfo));
            this.core.setAttribute(dataNode, 'type', baseName);
            this.core.setAttribute(dataNode, 'createdAt', Date.now());
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

    ImportArtifact.prototype.symLink = async function(path, storage) {
        const {id, config} = storage;
        if(path.includes(`${this.projectId}/artifacts`)){
            throw new Error('Cannot import from project root directory');
        }
        const srcStorage = await Storage.getBackend(id).getClient(this.logger, config);
        return await srcStorage.stat(path);
    };

    ImportArtifact.prototype.getAssetName = async function (hashOrPath) {
        try{
            const metadata = await this.blobClient.getMetadata(hashOrPath);
            return metadata.name.replace(/\.[^.]*?$/, '');
        } catch (err) {
            const pathArray = hashOrPath.split('/');
            return pathArray[pathArray.length-1].replace(/\.[^.]*?$/, '');
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
