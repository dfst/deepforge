/* globals define */
define([
    'client/logger',
    'deepforge/gmeConfig'
], function (
    Logger,
    gmeConfig
) {
    const fetch = require.isBrowser ? window.fetch :
        require.nodeRequire('node-fetch');
    const Headers = require.isBrowser ? window.Headers : fetch.Headers;

    const StorageHelpers = {};

    StorageHelpers.getServerURL = function () {
        const {port} = gmeConfig.server;
        let url = require.isBrowser ? window.origin :
            (process.env.DEEPFORGE_HOST || `http://127.0.0.1:${port}`);
        return [url.replace(/^https?:\/\//, ''), url.startsWith('https')];
    };

    StorageHelpers.getURL = function (url) {
        return url;
    };

    StorageHelpers.fetch = async function (url, opts = {}) {
        url = this.getURL(url);
        opts.headers = new Headers(opts.headers || {});
        const response = await fetch(url, opts);
        const {status} = response;
        if (status > 399) {
            return Promise.reject(response);
        }
        return response;
    };

    StorageHelpers.getBlobClientParams = function(logger) {
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

    return StorageHelpers;
});
