/*globals define*/
/*jshint node:true, browser:true*/

define([
    'plugin/UploadSeedToBlob/UploadSeedToBlob/UploadSeedToBlob',
    'text!./metadata.json'
], function (
    PluginBase,
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

        return this.uploadSeed(libraryInfo.seed)
            .then(hash => this.core.addLibrary(this.rootNode, library.name, hash))
            .then(() => {
                this.result.setSuccess(true);
                callback(null, this.result);
            })
            .fail(err => {
                this.logger.error(`Could not check the libraries: ${err}`);
                callback(err, this.result);
            });

        // update the meta with the types
        // TODO
    };

    //ImportLibrary.prototype.main = function (callback) {
    //};

    return ImportLibrary;
});
