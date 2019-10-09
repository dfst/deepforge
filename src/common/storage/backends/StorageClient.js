/* globals define */
define([], function() {
    const StorageClient = function(id, name, logger) {
        this.id = id;
        this.name = name;
        this.logger = logger.fork('storage');
    };

    StorageClient.prototype.getFile = async function() {
        throw new Error(`File download not implemented for ${this.name}`);
    };

    StorageClient.prototype.putFile = async function() {
        throw new Error(`File upload not supported by ${this.name}`);
    };

    StorageClient.prototype.createDataInfo = function(filename, data) {
        return {backend: this.id, filename, data};
    };

    return StorageClient;
});
