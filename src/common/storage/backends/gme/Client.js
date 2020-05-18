/* globals define */
define([
    '../StorageClient',
    'deepforge/StreamBlobClient'
], function(
    StorageClient,
    BlobClient
) {

    const GMEStorage = function(/*name, logger*/) {
        StorageClient.apply(this, arguments);
        this.blobClient = new BlobClient(this.logger);
    };

    GMEStorage.prototype = Object.create(StorageClient.prototype);

    GMEStorage.prototype.getFile = async function(dataInfo) {
        const {data} = dataInfo;
        return await this.blobClient.getObject(data);
    };

    GMEStorage.prototype.getStream = async function(dataInfo) {
        const url = await this.getDownloadURL(dataInfo);
        const response = await this.fetch(url, {method: 'GET'});
        return response.body;
    };

    GMEStorage.prototype.putFile = async function(filename, content) {
        const hash = await this.blobClient.putFile(filename, content);
        return this.createDataInfo(hash);
    };

    GMEStorage.prototype.putStream = async function(filename, stream) {
        await this.checkStreamsInBrowser();
        const hash = await this.blobClient.putStream(filename, stream);
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
