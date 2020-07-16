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

    return StorageHelpers;
});
