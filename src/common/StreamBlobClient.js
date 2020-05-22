/* globals define */
define([
    'blob/BlobClient',
    'deepforge/storage/StorageHelpers'
], function(
    BlobClient,
    StorageHelpers
) {
    class StreamBlobClient extends BlobClient {
        constructor(params) {
            super(params);
        }

        async putStream(filename, stream) {
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
        }

        _getAuthHeaders() {
            if(this.apiToken) {
                return {'x-api-token': this.apiToken};
            } else if(this.webgmeToken) {
                return {'Authorization': `Bearer ${this.webgmeToken}`};
            }
        }
    }

    Object.assign(StreamBlobClient.prototype, StorageHelpers);

    return StreamBlobClient;
});
