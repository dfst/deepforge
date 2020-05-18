/* globals define */
define([
    'client/logger',
    'deepforge/gmeConfig',
    'blob/BlobClient',
    'deepforge/StorageHelpers'
], function(
    Logger,
    gmeConfig,
    BlobClient,
    StorageHelpers
) {
    const StreamBlobClient = function (logger) {
        const params = this.getBlobClientParams(logger);
        BlobClient.call(this, params);
    };

    StreamBlobClient.prototype = BlobClient.prototype;
    StreamBlobClient.prototype.constructor = StreamBlobClient;
    Object.assign(StreamBlobClient.prototype, StorageHelpers);

    StreamBlobClient.prototype.getBlobClientParams = function(logger) {
        logger = logger ?
            Logger.create('gme:StreamBlobClient', gmeConfig.client.log) :
            logger.fork('StreamBlobClient');

        const params = {
            logger: logger
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

    StreamBlobClient.prototype.putStream = async function (filename, stream) {
        if(require.isBrowser) {
            throw new Error('Streaming not supported in browser.');
        } else {
            const opts = {
                'headers' : this._getAuthHeaders() || {},
                'method' : 'POST',
                'body': stream
            };
            let response;
            try{
                response = await this.fetch(
                    this.getCreateURL(filename, false), opts);
            } catch (e) {
                this.logger.error(`PutStream for webgme blob client failed with ${e}`);
                throw e;
            }
            return Object.keys((await response.json()))[0];
        }
    };

    StreamBlobClient.prototype._getAuthHeaders = function () {
        if(this.apiToken) {
            return {'x-api-token': this.apiToken};
        } else if(this.webgmeToken) {
            return {'Authorization': `Bearer ${this.webgmeToken}`};
        }
    };

    return StreamBlobClient;
});
