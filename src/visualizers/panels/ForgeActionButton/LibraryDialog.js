/* globals define, $, WebGMEGlobal */
define([
    'common/core/coreQ',
    'common/storage/constants',
    'q',
    'underscore',
    'text!./Libraries.json',
    'text!./LibraryDialogModal.html',
    'css!./LibraryDialog.css'
], function(
    Core,
    STORAGE_CONSTANTS,
    Q,
    _,
    LibrariesText,
    LibraryHtml
) {

    const Libraries = JSON.parse(LibrariesText);
    var LibraryDialog = function(logger) {
        this.logger = logger.fork('LibraryDialog');
        this.client = WebGMEGlobal.Client;
        this.initialize();
    };

    LibraryDialog.prototype.initialize = function() {
        this.$dialog = $(LibraryHtml);
        this.$table = this.$dialog.find('table');
        this.$tableContent = this.$table.find('tbody');

        Libraries.forEach(library => this.addLibraryToTable(library));
    };

    LibraryDialog.prototype.addLibraryToTable = function(libraryInfo) {
        let row = $('<tr>');
        let data = $('<td>');
        data.text(libraryInfo.name);
        row.append(data);

        data = $('<td>');
        data.text(libraryInfo.description);
        data.addClass('library-description');
        row.append(data);

        // Check if it is installed
        let libraries = this.client.getLibraryNames();
        let installed = libraries.includes(libraryInfo.name);
        let icon = $('<i>');
        icon.addClass('material-icons');
        if (installed) {
            row.addClass('success');
            data = $('<td>');
            let badge = $('<span>');
            badge.text('Installed');
            data.append(badge);
            badge.addClass('new badge');
            row.append(data);

            icon.text('clear');
            icon.on('click', () => this.uninstall(libraryInfo));
        } else {
            icon.text('get_app');
            icon.on('click', () => this.import(libraryInfo));
        }
        data = $('<td>');
        data.append(icon);
        row.append(data);

        this.$tableContent.append(row);
    };

    LibraryDialog.prototype.show = function() {
        this.$dialog.modal('show');
    };

    LibraryDialog.prototype.hide = function() {
        this.$dialog.modal('hide');
    };

    LibraryDialog.prototype.import = function(libraryInfo) {
        // Load by hash for now. This might be easiest with a server side plugin
        const pluginId = 'ImportLibrary';
        const context = this.client.getCurrentPluginContext(pluginId);
        context.pluginConfig = {
            libraryInfo: libraryInfo
        };

        return Q.ninvoke(this.client, 'runServerPlugin', pluginId, context)
            .then(() => {
                this.logger.info('imported library: ', libraryInfo.name);
                this.onChange();
                this.hide();
            })
            .fail(err => this.logger.error(err));
    };

    LibraryDialog.prototype.uninstall = function(libraryInfo) {
        const commitMsg = `Removed "${libraryInfo.name}" library`;
        const rootGuid = this.client.getActiveRootHash();
        const branchName = this.client.getActiveBranchName();
        const project = this.client.getProjectObject();
        const startCommit = this.client.getActiveCommitHash();
        const libName = libraryInfo.name;
        const core = new Core(project, {
            globConf: WebGMEGlobal.gmeConfig,
            logger: this.logger.fork('core')
        });

        // Load the first node/commit...
        let root;
        return core.loadRoot(rootGuid)
            .then(node => {
                root = node;
                return core.loadChildren(root);
            })
            .then(nodes => {
                const metanodes = _.values(core.getAllMetaNodes(root));
                const libraryCode = metanodes
                    .find(node => core.getAttribute(node, 'name') === 'LibraryCode');
                const libraryNode = nodes.find(node => {
                    return core.isLibraryRoot(node) &&
                        core.getAttribute(node, 'name') === libName;
                });
                const libPath = core.getPath(libraryNode);

                // Remove any LibraryCode nodes with a ptr to the given library
                const libraryCodeNodes = nodes
                    .filter(node => core.isTypeOf(node, libraryCode))
                    .filter(node => core.getPointerPath(node, 'library') === libPath);

                libraryCodeNodes.forEach(node => core.deleteNode(node));
                this.logger.info(`Removed ${libraryCodeNodes.length} library code nodes`);

                core.removeLibrary(root, libName);
                this.logger.info(`Removed ${libName} library`);
                // Make the given commit
                const persisted = core.persist(root);
                return project.makeCommit(
                    branchName,
                    [ startCommit ],
                    persisted.rootHash,
                    persisted.objects,
                    commitMsg
                );
            })
            .then(result => {
                if (result.status === STORAGE_CONSTANTS.SYNCED) {
                    // Throw out the changes... warn the user?
                    this.logger.info('SYNCED!');
                } else {
                    // Throw out the changes... warn the user?
                    this.logger.warn(`Could not remove library ${libName}`);
                }
                this.onChange();
                this.hide();
            })
            .catch(err => this.logger.error(`Could not remove lib ${libName}: ${err}`));
    };

    LibraryDialog.prototype.onChange = function() {
    };

    return LibraryDialog;
});
