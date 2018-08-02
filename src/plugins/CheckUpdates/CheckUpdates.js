/*globals define*/
/*jshint node:true, browser:true*/

define([
    'deepforge/updates/Updates',
    'plugin/UploadSeedToBlob/UploadSeedToBlob/UploadSeedToBlob',
    './metadata.json',
    'module',
    'path',
    'fs',
    'q'
], function (
    Updates,
    PluginBase,
    pluginMetadata,
    module,
    path,
    fs,
    Q
) {
    'use strict';

    /**
     * Initializes a new instance of CheckUpdates.
     * @class
     * @augments {PluginBase}
     * @classdesc This class represents the plugin CheckUpdates.
     * @constructor
     */
    var CheckUpdates = function () {
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
    CheckUpdates.metadata = pluginMetadata;

    // Prototypical inheritance from PluginBase.
    CheckUpdates.prototype = Object.create(PluginBase.prototype);
    CheckUpdates.prototype.constructor = CheckUpdates;

    /**
     * Main function for the plugin to execute. This will perform the execution.
     * Notes:
     * - Always log with the provided logger.[error,warning,info,debug].
     * - Do NOT put any user interaction logic UI, etc. inside this method.
     * - callback always has to be called even if error happened.
     *
     * @param {function(string, plugin.PluginResult)} callback - the result callback
     */
    CheckUpdates.prototype.main = async function (callback) {
        let seedUpdates = [];
        try {
            seedUpdates = await this.checkMainLibraries();
        } catch (err) {
            this.logger.error(`Could not check the libraries: ${err}`);
            return callback(err, this.result);
        }

        // Check for migrations
        const updates = await Updates.getAvailableUpdates(this.core, this.rootNode);
        const updateNames = updates.map(u => u.name).join(', ') || '<none>';
        this.logger.info(`Updates available for ${this.projectId}: ${updateNames}`);

        // Combine and report the result
        const msgs = seedUpdates
            .concat(
                updates.map(update => {
                    return {
                        type: Updates.MIGRATION,
                        nodeId: null,
                        name: update.name
                    };
                })
            );

        msgs.forEach(msg => this.createMessage(msg.nodeId, JSON.stringify(msg)));
        this.result.setSuccess(true);
        return callback(null, this.result);
    };

    CheckUpdates.prototype.checkMainLibraries = async function () {
        const libs = await this.getAllLibraries();
        const tuples = libs
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

        const hashes = await Q.all(tuples.map(tuple => this.uploadSeed.apply(this, tuple)));

        this.logger.info(`Found ${hashes.length} out of date libraries`);

        return hashes.map((hash, i) => {
            const [name] = tuples[i];
            return {
                type: Updates.SEED,
                name: name,
                nodeId: this.core.getPath(this.libraries[name]),
                hash: hash
            };
        });
    };

    CheckUpdates.prototype.getSeedHashPath = function (name) {
        return path.join(this.getSeedDir(name), 'hash.txt');
    };

    CheckUpdates.prototype.getSeedVersionPath = function (name) {
        return path.join(this.getSeedDir(name), 'version.txt');
    };

    CheckUpdates.prototype.upgradeSeedToVersion = function (name, version, hash) {
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

    CheckUpdates.prototype.getAllLibraries = function () {
        const DEFAULT_LIBRARIES = ['pipeline'];
        var name,
            names = [];

        return this.core.loadChildren(this.rootNode)
            .then(children => {
                for (var i = children.length; i--;) {
                    if (this.core.isLibraryRoot(children[i])) {
                        name = this.core.getAttribute(children[i], 'name');
                        this.libraries[name] = children[i];
                        if (DEFAULT_LIBRARIES.includes(name)) {
                            names.push(name);
                        }
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

    CheckUpdates.prototype.getLoadedVersion = function (libName) {
        var node = this.libraries[libName],
            version = this.core.getAttribute(node, 'version');  // using library root hash

        return version;
    };

    return CheckUpdates;
});
