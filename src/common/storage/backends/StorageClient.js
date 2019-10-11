/* globals define, WebGMEGlobal */
define([
    'client/logger'
], function(
    Logger
) {
    const StorageClient = function(id, name, logger) {
        this.id = id;
        this.name = name;
        if (!logger) {
            let gmeConfig;
            if (require.isBrowser) {
                gmeConfig = WebGMEGlobal.gmeConfig;
            } else {
                gmeConfig = require.nodeRequire('../../../../config');
            }
            logger = Logger.create(`gme:storage:${id}`, gmeConfig.client.log);
        }
        this.logger = logger.fork(`storage:${id}`);
    };

    StorageClient.prototype.getFile = async function() {
        throw new Error(`File download not implemented for ${this.name}`);
    };

    StorageClient.prototype.putFile = async function() {
        throw new Error(`File upload not supported by ${this.name}`);
    };

    StorageClient.prototype.getDownloadURL = async function() {
        // TODO: Remove this in favor of directly downloading w/ getFile, etc
        throw new Error(`getDownloadURL not implemented for ${this.name}`);
    };

    StorageClient.prototype.getMetadata = async function() {
        throw new Error(`getDownloadURL not implemented for ${this.name}`);
    };

    StorageClient.prototype.createDataInfo = function(data) {
        return {backend: this.id, data};
    };

    return StorageClient;
});
