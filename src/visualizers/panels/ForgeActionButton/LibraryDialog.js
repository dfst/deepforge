/* globals define */
define([
    'text!./Libraries.json',
    'text!./LibraryDialogModal.html'
], function(
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
        let data = $('<td>');
        data.text(libraryInfo.name);
        row.append(data);
        row.on('click', () => this.import(libraryInfo));

        this.$tableContent.append(row);
    };

    LibraryDialog.prototype.show = function() {
        this.$dialog.modal('show');
    };

    LibraryDialog.prototype.import = function(libraryInfo) {
        console.log('importing library:', libraryInfo);
        // Get the seed and load it
        // TODO: 

        // How do they do this in the Template File things?
        // TODO: 

        //client.updateLibrary
        //client.addLibrary(name, blobHash, cb)
    };

    return LibraryDialog;
});
