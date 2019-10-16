/*globals define*/
/*eslint-env node, browser*/

define([
    'plugin/PluginConfig',
    'text!./metadata.json',
    'plugin/PluginBase',
    'common/storage/util',
    'blob/util',
], function (
    PluginConfig,
    pluginMetadata,
    PluginBase,
    storageUtils,
    blobUtil,
) {
    'use strict';

    pluginMetadata = JSON.parse(pluginMetadata);

    /**
     * Initializes a new instance of ExportBranch.
     * @class
     * @augments {PluginBase}
     * @classdesc This class represents the plugin ExportBranch.
     * @constructor
     */
    function ExportBranch() {
        // Call base class' constructor.
        PluginBase.call(this);
        this.pluginMetadata = pluginMetadata;
    }

    /**
     * Metadata associated with the plugin. Contains id, name, version, description, icon, configStructure etc.
     * This is also available at the instance at this.pluginMetadata.
     * @type {object}
     */
    ExportBranch.metadata = pluginMetadata;

    // Prototypical inheritance from PluginBase.
    ExportBranch.prototype = Object.create(PluginBase.prototype);
    ExportBranch.prototype.constructor = ExportBranch;

    /**
     * Main function for the plugin to execute. This will perform the execution.
     * Notes:
     * - Always log with the provided logger.[error,warning,info,debug].
     * - Do NOT put any user interaction logic UI, etc. inside this method.
     * - callback always has to be called even if error happened.
     *
     * @param {function(Error|null, plugin.PluginResult)} callback - the result callback
     */
    ExportBranch.prototype.main = async function (callback) {
        const {projectId, branchName, commitHash} = this;
        const projectJson = await storageUtils.getProjectJson(
            this.project,
            {branchName, commitHash}
        );

        const shortCommitHash = commitHash.substr(1, 6);
        const filename = `${projectId}_${shortCommitHash}.webgmex`;
        const withAssets = true;
        projectJson.hashes.assets = await this.getUserAssetHashes();

        const hash = await blobUtil.buildProjectPackage(
            this.logger.fork('blobUtil'),
            this.blobClient,
            projectJson,
            withAssets,
            filename
        );

        this.result.addArtifact(hash);
        this.result.setSuccess(true);
        callback(null, this.result);
    };

    ExportBranch.prototype.getUserAssetHashes = async function () {
        const nodes = await this.core.loadSubTree(this.rootNode);
        const hashes = [];
        for (let i = nodes.length; i--;) {
            // If it has any userAssets which have a gme backend, record the hash
            const node = nodes[i];
            const attributes = this.core.getAttributeNames(node)
                .filter(name => {
                    const meta = this.core.getAttributeMeta(node, name) || {};
                    return meta.type === 'userAsset';
                });

            const gmeDataInfos = attributes
                .map(name => JSON.parse(this.core.getAttribute(node, name) || '{}'))
                .filter(dataInfo => dataInfo.backend === 'gme');

            for (let j = gmeDataInfos.length; j--;) {
                // Check if the 
                const hash = gmeDataInfos[j].data;
                if (!hashes.includes(hash)) {
                    hashes.push(hash);
                }
            }
        }
        return hashes;
    };

    return ExportBranch;
});
