/* globals define */
define([
    '../StorageClient',
], function(
    StorageClient,
) {
    const fetch = require.isBrowser ? window.fetch :
        require.nodeRequire('node-fetch');
    const Headers = require.isBrowser ? window.Headers : fetch.Headers;

    const BASE_URL = 'https://apps.sciserver.org/fileservice/api/';
    const SciServerFiles = function(id, name, logger, config={}) {
        StorageClient.apply(this, arguments);
        this.token = config.token;
        this.volume = (config.volume || '').replace(/^Storage\//, '');
    };

    SciServerFiles.prototype = Object.create(StorageClient.prototype);

    SciServerFiles.prototype.getFile = async function(dataInfo) {
        const {volume, filename} = dataInfo.data;
        const url = `file/Storage/${volume}/${filename}`;
        const response = await this.fetch(url);
        if (require.isBrowser) {
            return await response.arrayBuffer();
        } else {
            return Buffer.from(await response.arrayBuffer());
        }
    };

    SciServerFiles.prototype.putFile = async function(filename, content) {
        if (!this.volume) {
            throw new Error('Cannot upload file to SciServer. No volume specified.');
        }

        const opts = {
            method: 'PUT',
            body: content,
        };

        const url = `file/Storage/${this.volume}/${filename}`;
        await this.fetch(url, opts);
        const metadata = {
            filename: filename,
            volume: this.volume,
            size: content.byteLength,
        };
        return this.createDataInfo(metadata);
    };

    SciServerFiles.prototype.deleteDir = async function(dirname) {
        const url = `data/Storage/${this.volume}/${dirname}`;
        const opts = {method: 'DELETE'};
        return await this.fetch(url, opts);
    };

    SciServerFiles.prototype.deleteFile = async function(dataInfo) {
        const {volume, filename} = dataInfo.data;
        const url = `data/Storage/${volume}/${filename}`;
        const opts = {method: 'DELETE'};
        return await this.fetch(url, opts);
    };

    SciServerFiles.prototype.getMetadata = async function(dataInfo) {
        const metadata = {size: dataInfo.data.size};
        return metadata;
    };

    SciServerFiles.prototype.getDownloadURL = async function(dataInfo) {
        const {data} = dataInfo;
        return data.url;
    };

    SciServerFiles.prototype._stat = async function(volume, path) {
        const fullpath = volume + '/' + path;
        const url = `1/metadata/sandbox/${fullpath}?list=True&path=${fullpath}`;
        const headers = new Headers();
        headers.append('Content-Type', 'application/xml');
        const response = await this.fetch(url);
        if (response.status === 404) {
            return null;
        }
        return await response.json();
    };

    SciServerFiles.prototype.fetch = async function(url, opts={}) {
        url = BASE_URL + url;
        opts.headers = opts.headers || new Headers();
        opts.headers.append('X-Auth-Token', this.token);
        const response = await fetch(url, opts);
        const {status} = response;
        if (status === 400) {
            throw new Error('Received "Bad Request" from SciServer. Is the token invalid?');
        } else if (status > 399) {
            const contents = await response.json();
            throw new Error(`SciServer Files request failed: ${contents.error}`);
        }
        return response;
    };

    SciServerFiles.prototype.getCachePath = async function(dataInfo) {
        const {volume, filename} = dataInfo.data;
        return `${this.id}/${volume}/${filename}`;
    };

    return SciServerFiles;
});
