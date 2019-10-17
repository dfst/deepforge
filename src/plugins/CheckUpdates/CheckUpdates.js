/*globals define*/
/*jshint node:true, browser:true*/

define([
    'deepforge/updates/Updates',
    'deepforge/updates/Version',
    'plugin/UploadSeedToBlob/UploadSeedToBlob/UploadSeedToBlob',
    './metadata.json',
    'module',
    'path',
    'fs',
    'util',
], function (
    Updates,
    Version,
    PluginBase,
    pluginMetadata,
    module,
    path,
    fs,
    util,
) {
    'use strict';

    const writeFile = util.promisify(fs.writeFile);
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
                        node: null,
                        name: update.name
                    };
                })
            );

        msgs.forEach(msg => {
            const {node} = msg;
            if (node) {
                msg.nodeId = this.core.getPath(node);
                delete msg.node;
            }
            this.createMessage(node, JSON.stringify(msg));
        });
        this.result.setSuccess(true);
        return callback(null, this.result);
    };

    CheckUpdates.prototype.checkMainLibraries = async function () {
        const libraries = await this.getAllLibraries();
        const librariesWithUpdates = libraries.filter(library => {
            const [name, latestVersion] = library;
            const currentVersion = this.getLoadedVersion(name);
            return currentVersion.lessThan(latestVersion);
        });

        for (let i = librariesWithUpdates.length; i--;) {
            const library = librariesWithUpdates[i];
            library.push(await this.getLibraryHash.apply(this, library));
        }
        this.logger.info(`Found ${librariesWithUpdates.length} out-of-date libraries`);

        const updates = librariesWithUpdates.map(library => {
            const [name, /*version*/, hash] = library;
            return {
                type: Updates.SEED,
                name: name,
                node: this.libraries[name],
                hash: hash
            };
        });
        return updates;
    };

    CheckUpdates.prototype.getSeedHashPath = function (name) {
        return path.join(this.getSeedDir(name), 'hash.txt');
    };

    CheckUpdates.prototype.getSeedVersionPath = function (name) {
        return path.join(this.getSeedDir(name), 'version.txt');
    };

    CheckUpdates.prototype.getLibraryHash = async function (name, version) {
        let hash;
        try {
            const filename = this.getSeedHashPath(name);
            let [lastHash, versionString] = fs.readFileSync(filename, 'utf8').split(' ');
            const lastVersion = new Version(versionString);
            if (lastVersion.equalTo(version)) {
                hash = lastHash;
            }
        } catch (err) {
            this.logger.info(`Uploading new version of ${name} (${version})`);
        }
        if (!hash) {
            this.logger.info(`Uploading new version of ${name} (${version})`);
            hash = await this.uploadSeed(name);
            await writeFile(this.getSeedHashPath(name), `${hash} ${version}`);
        }
        return hash;
    };

    CheckUpdates.prototype.getAllLibraryNames = async function () {
        const DEFAULT_LIBRARIES = ['pipeline'];
        var name,
            names = [];

        const children = await this.core.loadChildren(this.rootNode);
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
    };

    CheckUpdates.prototype.getAllLibraries = async function () {
        const names = await this.getAllLibraryNames();
        const libraries = [];

        for (let i = names.length; i--;) {
            const name = names[i];
            try {
                const versionPath = this.getSeedVersionPath(name);
                const version = fs.readFileSync(versionPath, 'utf8').trim();
                this.logger.debug(`${name} version is ${version}`);
                if (version) {
                    libraries.push([name, new Version(version)]);
                } else {
                    this.logger.debug(`Invalid version for ${name}: "${version}"`);
                }
            } catch (e) {
                this.logger.warn(`Could not find library version for ${name}`);
            }
        }
        return libraries;
    };

    CheckUpdates.prototype.getLoadedVersion = function (libName) {
        var node = this.libraries[libName],
            version = this.core.getAttribute(node, 'version');  // using library root hash

        return new Version(version);
    };

    return CheckUpdates;
});
