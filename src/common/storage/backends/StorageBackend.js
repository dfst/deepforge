/* globals define */
define([
], function(
) {

    const StorageBackend = function(id, metadata) {
        const {name, client} = metadata;
        this.id = id;
        this.name = name;
        this.clientPath = client || './Client';
        this._metadata = metadata;
    };

    StorageBackend.prototype.getClient = async function(logger, config) {
        const Client = await this.require(`deepforge/storage/backends/${this.id}/${this.clientPath}`);
        return new Client(this.id, this.name, logger, config);
    };

    StorageBackend.prototype.prepareConfig = async function(config) {
        if (this._metadata.prepare) {
            return await this._metadata.prepare(config);
        }
        return config;
    };

    StorageBackend.prototype.require = function(path) {  // helper for loading async
        return new Promise((resolve, reject) =>
            require([path], resolve, reject)
        );
    };

    return StorageBackend;
});
