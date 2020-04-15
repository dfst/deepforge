/* globals define */
define([
    '../StorageClient',
    'blob/BlobClient'
], function(
    StorageClient,
    BlobClient
) {

    const GMEStorage = function(/*name, logger*/) {
        StorageClient.apply(this, arguments);
        const params = this.getBlobClientParams();
        this.blobClient = new BlobClient(params);
    };

    GMEStorage.prototype = Object.create(StorageClient.prototype);

    GMEStorage.prototype.getBlobClientParams = function() {
        const params = {
            logger: this.logger.fork('BlobClient')
        };
        if (!require.isBrowser) {
            const [url, isHttps] = this.getServerURL();
            const defaultPort = isHttps ? '443' : '80';
            const [server, port=defaultPort] = url.split(':');
            params.server = server;
            params.serverPort = +port;
            params.httpsecure = isHttps;
        }
        return params;
    };

    GMEStorage.prototype.getFile = async function(dataInfo) {
        const {data} = dataInfo;
        return await this.blobClient.getObject(data);
    };

    GMEStorage.prototype.putFile = async function(filename, content) {
        const hash = await this.blobClient.putFile(filename, content);
        return this.createDataInfo(hash);
    };

    GMEStorage.prototype.deleteDir =
    GMEStorage.prototype.deleteFile = async function() {};

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
