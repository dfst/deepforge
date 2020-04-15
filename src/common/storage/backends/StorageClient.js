/* globals define*/
define([
    'client/logger',
    'deepforge/gmeConfig'
], function(
    Logger,
    gmeConfig
) {
    const fetch = require.isBrowser ? window.fetch :
        require.nodeRequire('node-fetch');
    const Headers = require.isBrowser ? window.Headers : fetch.Headers;
    const StorageClient = function(id, name, logger) {
        this.id = id;
        this.name = name;
        if (!logger) {
            logger = Logger.create(`gme:storage:${id}`, gmeConfig.client.log);
        }
        this.logger = logger.fork(`storage:${id}`);
    };

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

    Object.assign(StorageClient.prototype, StorageHelpers);

    StorageClient.prototype.getFile = async function(/*dataInfo*/) {
        throw new Error(`File download not implemented for ${this.name}`);
    };

    StorageClient.prototype.putFile = async function(/*filename, content*/) {
        throw new Error(`File upload not supported by ${this.name}`);
    };

    StorageClient.prototype.deleteFile = async function(/*dataInfo*/) {
        throw new Error(`File deletion not supported by ${this.name}`);
    };

    StorageClient.prototype.deleteDir = function(/*dirname*/) {
        throw new Error(`Directory deletion not supported by ${this.name}`);
    };

    StorageClient.prototype.getDownloadURL = async function(dataInfo) {
        if (require.isBrowser) {
            const data = await this.getFile(dataInfo);
            const url = window.URL.createObjectURL(new Blob([data]));
            return url;
        } else {
            throw new Error(`getDownloadURL not implemented for ${this.name}`);
        }
    };

    StorageClient.prototype.getMetadata = async function(/*dataInfo*/) {
        throw new Error(`getMetadata not implemented for ${this.name}`);
    };

    StorageClient.prototype.copy = async function(dataInfo, filename) {
        const content = await this.getFile(dataInfo);
        return this.putFile(filename, content);
    };

    StorageClient.prototype.createDataInfo = function(data) {
        return {backend: this.id, data};
    };

    StorageClient.prototype.stat = async function (/*path*/) {
        throw new Error(`stat not implemented for ${this.name}`);
    };

    return StorageClient;
});
