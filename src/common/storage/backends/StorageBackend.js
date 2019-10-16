/* globals define */
define([
    'module',
    'q',
], function(
    module,
    Q,
) {

    const StorageBackend = function(id, metadata) {
        const {name, client} = metadata;
        this.id = id;
        this.name = name;
        this.clientPath = client || './Client';
    };

    StorageBackend.prototype.getClient = async function(logger, config) {
        //if (require.isBrowser) {
            //throw new Error('Storage clients cannot be loaded in the browser.');
        //}

        const Client = await this.require(`deepforge/storage/backends/${this.id}/${this.clientPath}`);
        return new Client(this.id, this.name, logger, config);
    };

    StorageBackend.prototype.require = function(path) {  // helper for loading async
        const deferred = Q.defer();
        require([path], deferred.resolve, deferred.reject);
        return deferred.promise;
    };

    return StorageBackend;
});
