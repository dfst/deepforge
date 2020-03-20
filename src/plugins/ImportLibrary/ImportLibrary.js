/*globals define*/
/*jshint node:true, browser:true*/

define([
    'plugin/UploadSeedToBlob/UploadSeedToBlob/UploadSeedToBlob',
    'webgme-engine/src/bin/import',
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
            .then(branchInfo => this.removeTemporaryBranch(branchInfo))
            .then(() => this.updateMetaForLibrary(libraryInfo))
            .then(() => this.addLibraryInitCode(libraryInfo))
            .then(() => this.save(`Imported ${libraryInfo.name} library`))
            .then(() => {
                this.result.setSuccess(true);
                callback(null, this.result);
            })
            .catch(err => {
                this.logger.error(`Could not check the libraries: ${err}`);
                callback(err, this.result);
            });
    };

    ImportLibrary.prototype.getUniqueBranchName = function (basename) {
        return this.project.getBranches()
            .then(branches => {
                let name = basename;
                let i = 2;

                while (branches[name]) {
                    name = `${basename}${i}`;
                    i++;
                }
                return name;
            });
    };

    ImportLibrary.prototype.addSeedToBranch = async function (name) {
        const filepath = this.getSeedDataPath(name);
        const project = this.projectName;
        const userId = this.getUserId();
        const branch = await this.getUniqueBranchName(`importLibTmpBranch${name}`);
        const argv = `node import ${filepath} -u ${userId} -p ${project} -b ${branch}`.split(' ');
        await this.project.createBranch(branch, this.commitHash);
        await ImportProject.main(argv);
        return branch;
    };

    ImportLibrary.prototype.createGMELibraryFromBranch = async function (branchName, libraryInfo) {
        const name = libraryInfo.name;
        const libraryData = {
            projectId: this.projectId,
            branchName: branchName,
            commitHash: null
        };

        // Get the rootHash and commitHash from the commit on the tmp branch
        const commits = await this.project.getHistory(branchName, 1);
        let commit = commits[0];
        let rootHash = commit.root;

        libraryData.commitHash = commit._id;
        await this.core.addLibrary(this.rootNode, name, rootHash, libraryData);
        return {
            name: branchName,
            hash: commit._id
        };
    };

    ImportLibrary.prototype.removeTemporaryBranch = function (branch) {
        return this.project.deleteBranch(branch.name, branch.hash);
    };

    ImportLibrary.prototype.updateMetaForLibrary = function (libraryInfo) {
        const nodeNames = libraryInfo.nodeTypes;
        const libraryNodes = this.getLibraryMetaNodes(libraryInfo.name);

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

    ImportLibrary.prototype.addLibraryInitCode = function (libraryInfo) {
        // Get the library fco node
        // Add the initialization code for this library;
        const libraryNodes = this.getLibraryMetaNodes(libraryInfo.name);
        const LibraryCode = this.getLibraryCodeNode();
        const FCO = this.getFCONode();

        // Make the LibraryCode node
        const node = this.core.createNode({
            parent: this.rootNode,
            base: LibraryCode
        });

        this.core.setAttribute(node, 'code', libraryInfo.initCode || '');
        this.core.setAttribute(node, 'name', `${libraryInfo.name}InitCode`);

        const libraryFCO = libraryNodes
            .find(node => this.core.getPointerPath(node, 'base') === this.core.getPath(FCO));

        this.core.setPointer(node, 'library', libraryFCO);
    };

    ImportLibrary.prototype.getLibraryMetaNodes = function (libraryName) {
        return Object.values(this.core.getLibraryMetaNodes(this.rootNode, libraryName));
    };

    ImportLibrary.prototype.getNonLibraryMeta = function () {
        const meta = Object.values(this.core.getAllMetaNodes(this.rootNode));
        return meta
            .filter(node => !this.core.isLibraryElement(node));
    };

    ImportLibrary.prototype.getLibraryCodeNode = function () {
        return this.getNonLibraryMeta()
            .find(node => this.core.getAttribute(node, 'name') === 'LibraryCode');
    };

    ImportLibrary.prototype.getFCONode = function () {
        return this.getNonLibraryMeta()
            .find(node => !this.core.getPointerPath(node, 'base'));
    };

    return ImportLibrary;
});
