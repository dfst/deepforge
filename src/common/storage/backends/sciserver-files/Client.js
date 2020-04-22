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
        this.volumePool = config.volumePool || 'Storage';
        this.volume = (config.volume || '').replace(/^Storage\//, '');
    };

    SciServerFiles.prototype = Object.create(StorageClient.prototype);

    SciServerFiles.prototype.getFile = async function (dataInfo) {
        let {volume, filename, volumePool='Storage'} = dataInfo.data;
        const url = `file/${volumePool}/${volume}/${filename}`;
        const response = await this.fetch('download', url);
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

        const url = `file/${this.volumePool}/${this.volume}/${filename}`;
        await this.fetch('upload', url, opts, 'upload');
        const metadata = {
            filename: filename,
            volume: this.volume,
            size: content.byteLength,
            volumePool: this.volumePool
        };
        return this.createDataInfo(metadata);
    };

    SciServerFiles.prototype.deleteDir = async function (dirname) {
        const url = `data/${this.volumePool}/${this.volume}/${dirname}`;
        const opts = {method: 'DELETE'};
        return await this.fetch('delete directory', url, opts);
    };

    SciServerFiles.prototype.deleteFile = async function (dataInfo) {
        const {volume, filename, volumePool} = dataInfo.data;
        const url = `data/${volumePool}/${volume}/${filename}`;
        const opts = {method: 'DELETE'};
        return await this.fetch('delete', url, opts);
    };

    SciServerFiles.prototype.getMetadata = async function (dataInfo) {
        const metadata = {size: dataInfo.data.size};
        return metadata;
    };

    SciServerFiles.prototype.getCachePath = async function (dataInfo) {
        const {volume, filename} = dataInfo.data;
        return `${this.id}/${volume}/${filename}`;
    };

    SciServerFiles.prototype.fetch = async function (action, url, opts = {}) {
        const token = await login(this.username, this.password);
        opts.headers = opts.headers || {};
        opts.headers['X-Auth-Token'] = token;
        try {
            const response = await StorageClient.prototype.fetch.call(this, url, opts);
            return response;
        } catch (errRes) {
            const err = errRes instanceof Error ? errRes :
                await this.getErrorMsg(errRes);
            throw new Error(`SciServerFiles ${action} failed: ${err}`);
        }
    };

    SciServerFiles.prototype.getErrorMsg = async function (response) {
        try {
            const contents = await response.json();
            return JSON.stringify(contents);
        } catch (err) {
            return await response.text();
        }
    };

    SciServerFiles.prototype.getURL = function (url) {
        if (url.startsWith('http')) {
            return url;
        }
        return BASE_URL + url;
    };

    SciServerFiles.prototype.stat = async function(path) {
        const splitPath = path.split('/');
        const filename = splitPath.pop();
        const parentDir = splitPath.join('/');
        const url = `jsontree/${this.volumePool}/${this.volume}/${parentDir}?level=2`;
        const response = await this.fetch('stat', url);
        const files = (await response.json()).root.files || [];
        const metadata = files.find(file => file.name === filename);
        if(metadata) {
            metadata.volume = this.volume;
            metadata.volumePool = this.volumePool;
            metadata.filename = path;
        } else {
            throw new Error(`The file at ${path} doesn't exist in ${this.volume}`);
        }
        return this.createDataInfo(metadata);
    };

    return SciServerFiles;
});
