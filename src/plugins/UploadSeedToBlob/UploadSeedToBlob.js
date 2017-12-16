/*globals define*/
/*jshint node:true, browser:true*/

define([
    'plugin/PluginBase',
    'module',
    'path',
    'fs',
    'q',
    './metadata.json'
], function (
    PluginBase,
    module,
    path,
    fs,
    Q,
    pluginMetadata
) {
    'use strict';

    const __dirname = path.dirname(module.uri);
    const PROJECT_ROOT = path.join(__dirname, '..', '..', '..');
    const SEEDS_DIR = path.join(PROJECT_ROOT, 'src', 'seeds');
    const config = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'webgme-setup.json')), 'utf8');

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
            .then(data => this.blobClient.putFile(`${name}.webgmex`, data));
    };

    UploadSeedToBlob.prototype.getSeedDataPath = function (name) {
        return path.join(this.getSeedDir(name), name + '.webgmex');
    };

    UploadSeedToBlob.prototype.getSeedDir = function (name) {
        if (config.components.seeds[name]) {
            return path.join(SEEDS_DIR, name);
        } else if (config.dependencies.seeds[name]) {
            const entry = config.dependencies.seeds[name];
            return path.join(PROJECT_ROOT, entry.path);
        }
        throw new Error(`Seed ${name} not found!`);
    };

    return UploadSeedToBlob;
});
