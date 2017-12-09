/*globals define*/
/*jshint node:true, browser:true*/

define([
    'plugin/PluginBase',
    'module',
    'path',
    'fs',
    'q',
    'text!./metadata.json'
], function (
    PluginBase,
    module,
    path,
    fs,
    Q,
    pluginMetadata
) {
    'use strict';

    pluginMetadata = JSON.parse(pluginMetadata);
    const __dirname = path.dirname(module.uri);
    const SEEDS_DIR = path.join(__dirname, '..', '..', 'seeds');

    /**
     * Initializes a new instance of UploadSeedToBlob.
     * @class
     * @augments {PluginBase}
     * @classdesc This class represents the plugin UploadSeedToBlob.
     * @constructor
     */
    var UploadSeedToBlob = function () {
        // Call base class' constructor.
        PluginBase.call(this);
        this.pluginMetadata = pluginMetadata;
    };

    /**
     * Metadata associated with the plugin. Contains id, name, version, description, icon, configStructue etc.
     * This is also available at the instance at this.pluginMetadata.
     * @type {object}
     */
    UploadSeedToBlob.metadata = pluginMetadata;

    // Prototypical inheritance from PluginBase.
    UploadSeedToBlob.prototype = Object.create(PluginBase.prototype);
    UploadSeedToBlob.prototype.constructor = UploadSeedToBlob;

    /**
     * Main function for the plugin to execute. This will perform the execution.
     * Notes:
     * - Always log with the provided logger.[error,warning,info,debug].
     * - Do NOT put any user interaction logic UI, etc. inside this method.
     * - callback always has to be called even if error happened.
     *
     * @param {function(string, plugin.PluginResult)} callback - the result callback
     */
    UploadSeedToBlob.prototype.main = function (callback) {
        const config = this.getCurrentConfig();
        const seedName = config.seedName;

        // Upload the library to the blob
        return this.uploadSeed(seedName)
            .then(hash => {
                this.createMessage(this.rootNode, hash);
                this.result.setSuccess(true);
                callback(null, this.result);
            })
            .fail(err => {
                this.logger.error(`Could not check the libraries: ${err}`);
                callback(err, this.result);
            });
    };

    UploadSeedToBlob.prototype.uploadSeed = function (name) {
        return Q.nfcall(fs.readFile, this.getSeedDataPath(name))
            .then(data => {
                return this.blobClient.putFile(`${name}.webgmex`, data);
            });
    };

    UploadSeedToBlob.prototype.getSeedDataPath = function (name) {
        return path.join(this.getSeedDir(name), name + '.webgmex');
    };

    UploadSeedToBlob.prototype.getSeedDir = function (name) {
        return path.join(SEEDS_DIR, name);
    };

    return UploadSeedToBlob;
});
