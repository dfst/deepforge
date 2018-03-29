/* globals define, $, WebGMEGlobal */
define([
    'q',
    'text!./Libraries.json',
    'text!./LibraryDialogModal.html',
    'css!./LibraryDialog.css'
], function(
    Q,
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
        // TODO: clicking on them should import the library
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

        // Pass in the library info
        // TODO: show loading circles?
        return Q.ninvoke(this.client, 'runServerPlugin', pluginId, context)
            .then(() => {
                this.logger.info('imported library: ', libraryInfo.name);
                this.onChange();
                this.hide();
            })
            .fail(err => this.logger.error(err));
    };

    LibraryDialog.prototype.uninstall = function(libraryInfo) {
        this.client.startTransaction(`Removed "${libraryInfo.name}" library`);
        this.client.removeLibrary(libraryInfo.name);
        this.client.completeTransaction();
        this.onChange();
        this.hide();
    };

    LibraryDialog.prototype.onChange = function() {
    };

    return LibraryDialog;
});
