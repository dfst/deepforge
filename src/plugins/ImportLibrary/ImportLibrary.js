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
    ImportLibrary.prototype.main = async function () {
        const config = this.getCurrentConfig();
        const libraryInfo = config.libraryInfo;

        await this.importLibrary(libraryInfo);
        await this.save(`Imported ${libraryInfo.name} library`);
        this.result.setSuccess(true);
    };

    ImportLibrary.prototype.importLibrary = async function (libraryInfo) {
        const branchName = await this.addSeedToBranch(libraryInfo.seed);
        const branchInfo = await this.createGMELibraryFromBranch(branchName, libraryInfo);
        await this.removeTemporaryBranch(branchInfo);
        await this.updateMetaForLibrary(libraryInfo);
        await this.addLibraryInitCode(libraryInfo);
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
        const alreadyExists = this.core.getLibraryNames(this.rootNode).includes(name);
        if (alreadyExists) {
            await this.core.updateLibrary(this.rootNode, name, rootHash, libraryData);
        } else {
            await this.core.addLibrary(this.rootNode, name, rootHash, libraryData);
        }
        return {
            name: branchName,
            hash: commit._id
        };
    };

    ImportLibrary.prototype.removeTemporaryBranch = function (branch) {
        return this.project.deleteBranch(branch.name, branch.hash);
    };

    ImportLibrary.prototype.updateMetaForLibrary = async function (libraryInfo) {
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
        const children = await this.core.loadChildren(this.rootNode);
        let parent = children.find(node => this.core.getAttribute(node, 'name') === 'MyResources');
        if (!parent) throw new Error('Could not find resources location');
        nodes.forEach(node => this.core.setChildMeta(parent, node));
    };

    ImportLibrary.prototype.addLibraryInitCode = async function (libraryInfo) {
        const libraryNodes = this.getLibraryMetaNodes(libraryInfo.name);
        const node = await this.createLibraryCodeNode(libraryInfo.name);

        this.core.setAttribute(node, 'code', libraryInfo.initCode || '');
        this.core.setAttribute(node, 'name', libraryInfo.name);
        this.core.setAttribute(node, 'version', libraryInfo.version);

        const FCO = this.getFCONode();
        const libraryFCO = libraryNodes
            .find(node => this.core.getPointerPath(node, 'base') === this.core.getPath(FCO));

        this.core.setPointer(node, 'library', libraryFCO);
        return node;
    };

    ImportLibrary.prototype.createLibraryCodeNode = async function (libName) {
        const LibraryCode = this.getLibraryCodeNode();
        const libraryCodeNodes = (await this.core.loadChildren(this.rootNode))
            .filter(node => this.core.isTypeOf(node, LibraryCode));

        return libraryCodeNodes.find(node => {
            const name = this.core.getAttribute(node, 'name');
            return name === libName || name === `${libName}InitCode`;
        }) || this.core.createNode({parent: this.rootNode, base: LibraryCode});
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
