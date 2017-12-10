/*globals define*/
/*jshint node:true, browser:true*/

define([
    'plugin/UploadSeedToBlob/UploadSeedToBlob/UploadSeedToBlob',
    'webgme/src/bin/import',
    'text!./metadata.json'
], function (
    PluginBase,
    ImportProject,
    pluginMetadata
) {

    pluginMetadata = JSON.parse(pluginMetadata);

    /**
     * Initializes a new instance of ImportLibrary.
     * @class
     * @augments {PluginBase}
     * @classdesc This class represents the plugin ImportLibrary.
     * @constructor
     */
    var ImportLibrary = function () {
        // Call base class' constructor.
        PluginBase.call(this);
        this.pluginMetadata = pluginMetadata;
    };

    /**
     * Metadata associated with the plugin. Contains id, name, version, description, icon, configStructue etc.
     * This is also available at the instance at this.pluginMetadata.
     * @type {object}
     */
    ImportLibrary.metadata = pluginMetadata;

    // Prototypical inheritance from PluginBase.
    ImportLibrary.prototype = Object.create(PluginBase.prototype);
    ImportLibrary.prototype.constructor = ImportLibrary;

    /**
     * Main function for the plugin to execute. This will perform the execution.
     * Notes:
     * - Always log with the provided logger.[error,warning,info,debug].
     * - Do NOT put any user interaction logic UI, etc. inside this method.
     * - callback always has to be called even if error happened.
     *
     * @param {function(string, plugin.PluginResult)} callback - the result callback
     */
    ImportLibrary.prototype.main = function (callback) {
        const config = this.getCurrentConfig();
        const libraryInfo = config.libraryInfo;

        return this.addSeedToBranch(libraryInfo.seed)
            .then(branchName => this.createGMELibraryFromBranch(branchName, libraryInfo))
            .then(branch => this.removeTemporaryBranch(branch))
            .then(() => this.updateMetaForLibrary(libraryInfo))
            .then(() => this.save(`Imported ${libraryInfo.name} library`))
            .then(() => {
                this.result.setSuccess(true);
                callback(null, this.result);
            })
            .fail(err => {
                this.logger.error(`Could not check the libraries: ${err}`);
                callback(err, this.result);
            });
    };

    ImportLibrary.prototype.getUniqueBranchName = function (basename) {
        const branches = this.project.branches;
        let name = basename;
        let i = 2;

        while (branches[name]) {
            name = `${basename} ${i}`;
            i++;
        }
        return name;
    };

    ImportLibrary.prototype.addSeedToBranch = function (name) {
        const filepath = this.getSeedDataPath(name);
        const project = this.projectName;
        const branch = this.getUniqueBranchName(`importLibTmpBranch${name}`);
        const argv = `node import ${filepath} -p ${project} -b ${branch}`.split(' ');

        return this.project.createBranch(name, this.commitHash)
            .then(() => ImportProject.main(argv))
            .then(() => branch);
    };

    ImportLibrary.prototype.createGMELibraryFromBranch = function (branchName, libraryInfo) {
        const name = libraryInfo.name;
        const libraryData = {
            projectId: this.projectId,
            branchName: branchName,
            commitHash: null
        };

        console.log('main hash', this.commitHash);
        // TODO: check the branch hash?
        return this.project.getBranchHash(branchName)
            .then(hash => {
                // TODO: get root hash?
                console.log('library hash', hash);
                libraryData.commitHash = hash;
                return this.core.addLibrary(this.rootNode, name, this.commitHash, libraryData);
            });
    };

    ImportLibrary.prototype.removeTemporaryBranch = function (branchName) {
        return this.project.getBranchHash(branchName)
            .then(hash => this.project.deleteBranch(branchName, hash));
    };

    const values = obj => Object.keys(obj).map(k => obj[k]);
    ImportLibrary.prototype.updateMetaForLibrary = function (branchInfo, libraryInfo) {
        const nodeNames = libraryInfo.nodeTypes;
        const libraryNodes = values(this.core.getLibraryMetaNodes(this.rootNode, libraryInfo.name));

        // Get each node from 'nodeTypes'
        const nodes = nodeNames
            .map(name => {
                const node = libraryNodes.find(node => {
                    return this.core.getAttribute(node, 'name') === name;
                });
                if (!node) this.logger.warn(`Could not find ${name} in ${libraryInfo.name}. Skipping...`);
                return node;
            })
            .filter(node => !!node);

        // Add containment relationships to the meta
        return this.core.loadChildren(this.rootNode)
            .then(children => {
                let parent = children.find(node => this.core.getAttribute(node, 'name') === 'MyResources');
                if (!parent) throw new Error('Could not find resources location');
                nodes.forEach(node => this.core.setChildMeta(parent, node));
            });
    };

    return ImportLibrary;
});
