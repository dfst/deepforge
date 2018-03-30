/*globals define*/
/*jshint node:true, browser:true*/

define([
    'plugin/UploadSeedToBlob/UploadSeedToBlob/UploadSeedToBlob',
    './metadata.json',
    'module',
    'path',
    'fs',
    'q'
], function (
    PluginBase,
    pluginMetadata,
    module,
    path,
    fs,
    Q
) {
    'use strict';

    /**
     * Initializes a new instance of CheckLibraries.
     * @class
     * @augments {PluginBase}
     * @classdesc This class represents the plugin CheckLibraries.
     * @constructor
     */
    var CheckLibraries = function () {
        // Call base class' constructor.
        PluginBase.call(this);
        this.pluginMetadata = pluginMetadata;
        this.libraries = {};
    };

    /**
     * Metadata associated with the plugin. Contains id, name, version, description, icon, configStructue etc.
     * This is also available at the instance at this.pluginMetadata.
     * @type {object}
     */
    CheckLibraries.metadata = pluginMetadata;

    // Prototypical inheritance from PluginBase.
    CheckLibraries.prototype = Object.create(PluginBase.prototype);
    CheckLibraries.prototype.constructor = CheckLibraries;

    /**
     * Main function for the plugin to execute. This will perform the execution.
     * Notes:
     * - Always log with the provided logger.[error,warning,info,debug].
     * - Do NOT put any user interaction logic UI, etc. inside this method.
     * - callback always has to be called even if error happened.
     *
     * @param {function(string, plugin.PluginResult)} callback - the result callback
     */
    CheckLibraries.prototype.main = function (callback) {
        var tuples;

        return this.getAllLibraries()
            .then(libs => {
                tuples = libs
                    .map(lib => {  // map to [name, version, dir]
                        var version,
                            hash,
                            data,
                            versionPath = this.getSeedVersionPath(lib);

                        try {
                            this.logger.info(`Checking for version info at ${versionPath}`);
                            version = fs.readFileSync(versionPath, 'utf8');
                            this.logger.debug(`${lib} version is ${version}`);
                            data = fs.readFileSync(this.getSeedHashPath(lib), 'utf8').split(' ');
                            if (data[1] === version) {
                                hash = data[0];
                                this.logger.debug(`${lib} hash is ${hash}`);
                            }
                        } catch (e) {
                            if (!version) {
                                this.logger.warn(`Could not find library version for ${lib}`);
                            } else {
                                this.logger.warn(`Could not find library hash for ${lib}`);
                            }
                        }

                        return [lib, version, hash];
                    })
                    .filter(tuple => {  // get only the libs w/ updates available
                        let [lib, version] = tuple;

                        if (!version) return false;

                        let projVersion = this.getLoadedVersion(lib);
                        let latest = version.replace(/\s+/g, '');

                        this.logger.info(`${lib} version info:\n${projVersion} ` +
                            `(project)\n${latest} (latest)`);
                        return projVersion < latest;
                    });

                return Q.all(tuples.map(tuple => this.uploadSeed.apply(this, tuple)));
            })
            .then(hashes => {
                var name;

                for (var i = hashes.length; i--;) {
                    name = tuples[i][0];
                    this.createMessage(this.libraries[name], `${name} ${hashes[i]}`);
                }

                this.logger.info(`Found ${hashes.length} out of date libraries`);
                this.result.setSuccess(true);
                callback(null, this.result);
            })
            .fail(err => {
                this.logger.error(`Could not check the libraries: ${err}`);
                callback(err, this.result);
            });
    };

    CheckLibraries.prototype.getSeedHashPath = function (name) {
        return path.join(this.getSeedDir(name), 'hash.txt');
    };

    CheckLibraries.prototype.getSeedVersionPath = function (name) {
        return path.join(this.getSeedDir(name), 'version.txt');
    };

    CheckLibraries.prototype.upgradeSeedToVersion = function (name, version, hash) {
        if (!hash) {  // Upload the seed
            // Get the data
            this.logger.info(`Uploading new version of ${name} (${version})`);
            return this.uploadSeed(name)
                .then(newHash => {  // Store the new hash
                    this.logger.info(`Upload of ${name} finished!`);
                    hash = newHash;
                    return Q.nfcall(
                        fs.writeFile,
                        this.getSeedHashPath(name),
                        `${hash} ${version}`
                    );
                }).then(() => hash);
        }
        return hash;
    };

    CheckLibraries.prototype.getAllLibraries = function () {
        var name,
            names = [];

        return this.core.loadChildren(this.rootNode)
            .then(children => {
                for (var i = children.length; i--;) {
                    if (this.core.isLibraryRoot(children[i])) {
                        name = this.core.getAttribute(children[i], 'name');
                        this.libraries[name] = children[i];
                        names.push(name);
                    }
                }
                if (names.length) {
                    this.logger.debug(`Found libraries: ${names.join(', ')}`);
                } else {
                    this.logger.debug('Found no libraries!');
                }
                return names;
            });
    };

    CheckLibraries.prototype.getLoadedVersion = function (libName) {
        var node = this.libraries[libName],
            version = this.core.getAttribute(node, 'version');  // using library root hash

        return version;
    };

    return CheckLibraries;
});
