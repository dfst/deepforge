/* globals define */
define([
    '../StorageClient',
    'deepforge/sciserver-auth',
], function (
    StorageClient,
    login,
) {
    const BASE_URL = 'https://apps.sciserver.org/fileservice/api/';
    const SciServerFiles = function (id, name, logger, config = {}) {
        StorageClient.apply(this, arguments);
        this.username = config.username;
        this.password = config.password;
        this.volume = (config.volume || '').replace(/^Storage\//, '');
    };

    SciServerFiles.prototype = Object.create(StorageClient.prototype);

    SciServerFiles.prototype.getFile = async function (dataInfo) {
        const {volume, filename} = dataInfo.data;
        const url = `file/Storage/${volume}/${filename}`;
        const response = await this.fetch(url);
        if (require.isBrowser) {
            return await response.arrayBuffer();
        } else {
            return Buffer.from(await response.arrayBuffer());
        }
    };

    SciServerFiles.prototype.putFile = async function (filename, content) {
        if (!this.volume) {
            throw new Error('Cannot upload file to SciServer. No volume specified.');
        }

        const opts = {
            method: 'PUT',
            body: content,
        };

        const url = `file/Storage/${this.volume}/${filename}`;
        try{
            await this.fetch(url, opts);
        } catch (errRes) {
            const contents = await errRes.json();
            throw new Error(`Operation PutFile For Sciserver Failed with the following response ${JSON.stringify(contents)}`);
        }
        const metadata = {
            filename: filename,
            volume: this.volume,
            size: content.byteLength,
        };
        return this.createDataInfo(metadata);
    };

    SciServerFiles.prototype.deleteDir = async function (dirname) {
        const url = `data/Storage/${this.volume}/${dirname}`;
        const opts = {method: 'DELETE'};
        return await this.fetch(url, opts);
    };

    SciServerFiles.prototype.deleteFile = async function (dataInfo) {
        const {volume, filename} = dataInfo.data;
        const url = `data/Storage/${volume}/${filename}`;
        const opts = {method: 'DELETE'};
        return await this.fetch(url, opts);
    };

    SciServerFiles.prototype.getMetadata = async function (dataInfo) {
        const metadata = {size: dataInfo.data.size};
        return metadata;
    };

    SciServerFiles.prototype.getCachePath = async function (dataInfo) {
        const {volume, filename} = dataInfo.data;
        return `${this.id}/${volume}/${filename}`;
    };

    SciServerFiles.prototype.fetch = async function (url, opts = {}) {
        const token = await login(this.username, this.password);
        opts.headers = opts.headers || {};
        opts.headers['X-Auth-Token'] = token;
        return StorageClient.prototype.fetch.call(this, url, opts);
    };

    SciServerFiles.prototype.getURL = function (url) {
        if (url.startsWith('http')) {
            return url;
        }
        return BASE_URL + url;
    };

    return SciServerFiles;
});
