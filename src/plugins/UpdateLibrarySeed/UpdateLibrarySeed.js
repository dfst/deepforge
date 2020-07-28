/*globals define*/
/*jshint node:true, browser:true*/

define([
    'text!./metadata.json',
    'child_process',
    'path',
    'q',
    'fs',
    'module',
    'plugin/PluginBase'
], function (
    pluginMetadata,
    childProcess,
    path,
    Q,
    fs,
    module,
    PluginBase
) {
    'use strict';

    pluginMetadata = JSON.parse(pluginMetadata);
    var SEEDS_DIR = path.join(path.dirname(module.uri), '..', '..', 'seeds');

    /**
     * Initializes a new instance of UpdateLibrarySeed.
     * @class
     * @augments {PluginBase}
     * @classdesc This class represents the plugin UpdateLibrarySeed.
     * @constructor
     */
    var UpdateLibrarySeed = function () {
        // Call base class' constructor.
        PluginBase.call(this);
        this.pluginMetadata = pluginMetadata;
    };

    /**
     * Metadata associated with the plugin. Contains id, name, version, description, icon, configStructue etc.
     * This is also available at the instance at this.pluginMetadata.
     * @type {object}
     */
    UpdateLibrarySeed.metadata = pluginMetadata;

    // Prototypical inheritance from PluginBase.
    UpdateLibrarySeed.prototype = Object.create(PluginBase.prototype);
    UpdateLibrarySeed.prototype.constructor = UpdateLibrarySeed;

    /**
     * Main function for the plugin to execute. This will perform the execution.
     * Notes:
     * - Always log with the provided logger.[error,warning,info,debug].
     * - Do NOT put any user interaction logic UI, etc. inside this method.
     * - callback always has to be called even if error happened.
     *
     * @param {function(string, plugin.PluginResult)} callback - the result callback
     */
    UpdateLibrarySeed.prototype.main = function (callback) {
        // get the root hash
        var name = this.projectName,
            version;

        // get the name and validate
        return this.getLibraryVersion()
            .then(vers => {
                version = vers;
                return this.checkForLibName(name);
            })
            .then(valid => {
                if (!valid) {
                    var err = `Invalid library name "${name}"`;
                    this.logger.error(err);
                    return callback(err, this.result);
                }
                return this.updateSeed(name);
            })
            .then(() => this.recordRelease(name, version))
            .then(() => {
                this.logger.info(`Finished updating library seed for ${name}`);
                this.result.setSuccess(true);
                callback(null, this.result);
            })
            .fail(err => callback(err, this.result));
    };

    UpdateLibrarySeed.prototype.bumpVersion = function (rawVersion, releaseType) {
        var vnames = ['major', 'minor', 'patch'],
            bumpIndex = vnames.indexOf(releaseType),
            version = rawVersion.split('.').map(num => parseInt(num));

        version[bumpIndex]++;
        // zero out the smaller numbers
        while (++bumpIndex < version.length) {
            version[bumpIndex] = 0;
        }
        return version.join('.');
    };

    UpdateLibrarySeed.prototype.getLibraryVersion = function () {
        var version,
            config = this.getCurrentConfig(),
            newVersion;

        version = (this.core.getAttribute(this.rootNode, 'version') || '0.0.0');
        newVersion = this.bumpVersion(version, config.releaseType);

        this.core.setAttribute(this.rootNode, 'version', newVersion);
        return this.save(`Bumped version to ${newVersion}`).then(() => newVersion);
    };

    UpdateLibrarySeed.prototype.checkForLibName = function (name) {
        // check for the library name from the fs
        return Q.nfcall(fs.readdir, SEEDS_DIR).then(seeds => seeds.indexOf(name) !== -1);
    };

    UpdateLibrarySeed.prototype.updateSeed = function (seedName) {
        var deferred = Q.defer(),
            err,
            job = childProcess.spawn('webgme', ['new', 'seed', seedName], {
                cwd: path.dirname(module.uri)
            });

        this.logger.info(`Updating ${seedName} seed`);
        job.on('error', _err => {
            err = _err;
            if (err.code === 'ENOENT') {
                return deferred.reject('"webgme" command not found. Is webgme-cli installed on the server?');
            }
            return deferred.reject(err);
        });

        job.on('exit', code => {
            if (!code) {
                deferred.resolve();
            } else {
                deferred.reject(err || code);
            }
        });

        return deferred.promise;
    };

    UpdateLibrarySeed.prototype.recordRelease = function (seed, version) {
        const {changelog} = this.getCurrentConfig();
        const release = {version, changelog};
        const versionPath = path.join(SEEDS_DIR, seed, 'releases.jsonl');
        this.logger.info(`Updating ${seed} version (${version})`);
        return Q.nfcall(fs.appendFile, versionPath, `\n${JSON.stringify(release)}`);
    };

    return UpdateLibrarySeed;
});
