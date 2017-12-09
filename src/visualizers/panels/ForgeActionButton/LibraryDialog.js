/* globals define */
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
        //row.addClass('success');
        let data = $('<td>');
        data.text(libraryInfo.name);
        row.append(data);

        data = $('<td>');
        data.text(libraryInfo.description);
        data.addClass('library-description');
        row.append(data);

        // Check if it is installed
        // TODO
        data = $('<td>');
        let badge = $('<span>');
        badge.text('Installed');
        data.append(badge);
        badge.addClass('new badge');
        row.append(data);

        // If not installed
        row.on('click', () => this.import(libraryInfo));

        this.$tableContent.append(row);
    };

    LibraryDialog.prototype.show = function() {
        this.$dialog.modal('show');
    };

    LibraryDialog.prototype.import = function(libraryInfo) {
        // Load by hash for now. This might be easiest with a server side plugin
        const client = WebGMEGlobal.Client;
        const pluginId = 'UploadSeedToBlob';
        const context = client.getCurrentPluginContext(pluginId);
        context.pluginConfig = {
            libraryInfo: libraryInfo
        };

        // Pass in the library info
        return Q.ninvoke(client, 'runServerPlugin', pluginId, context)
            .then(res => {
                let hash = res.messages.pop().message;
                libraryInfo.hash = hash;
                return Q.ninvoke(this._client, 'updateLibrary', libraryInfo.name, hash)
            })
            .then(() => this.logger.log('imported library: ', libraryInfo.name));
    };

    return LibraryDialog;
});
