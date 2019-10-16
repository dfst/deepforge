/* globals define */
define([
    '../StorageClient',
    'blob/BlobClient',
    'module',
], function(
    StorageClient,
    BlobClient,
    module,
) {
    const GMEStorage = function(/*name, logger*/) {
        StorageClient.apply(this, arguments);
        const params = {
            logger: this.logger.fork('BlobClient')
        };
        if (!require.isBrowser) {
            const path = require.nodeRequire('path');
            const PROJECT_ROOT = path.join(path.dirname(module.uri), '..', '..', '..', '..', '..');
            const configPath = path.join(PROJECT_ROOT, 'config');
            const gmeConfig = require.nodeRequire(configPath);
            params.server = '127.0.0.1';
            params.serverPort = gmeConfig.server.port;
            params.httpsecure = false;
        }
        this.blobClient = new BlobClient(params);
    };

    GMEStorage.prototype = Object.create(StorageClient.prototype);

    GMEStorage.prototype.getFile = async function(dataInfo) {
        const {data} = dataInfo;
        return await this.blobClient.getObject(data);
    };

    GMEStorage.prototype.putFile = async function(filename, content) {
        const hash = await this.blobClient.putFile(filename, content);
        return this.createDataInfo(hash);
    };

    GMEStorage.prototype.getMetadata = async function(dataInfo) {
        const {data} = dataInfo;
        return await this.blobClient.getMetadata(data);
    };

    GMEStorage.prototype.getDownloadURL = async function(dataInfo) {
        const {data} = dataInfo;
        return this.blobClient.getDownloadURL(data);
    };

    GMEStorage.prototype.getCachePath = async function(dataInfo) {
        const metadata = await this.getMetadata(dataInfo);
        const hash = metadata.content;
        const dir = hash.substring(0, 2);
        const filename = hash.substring(2);
        return `${this.id}/${dir}/${filename}`;
    };

    return GMEStorage;
});
