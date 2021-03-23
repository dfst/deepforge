/* globals define */
define([
    '../StorageClient',
    'deepforge/sciserver-auth',
], function (
    StorageClient,
    getToken,
) {
    const BASE_URL = 'https://apps.sciserver.org/fileservice/api/';
    class SciServerFiles extends StorageClient {
        constructor (id, name, logger, config = {}) {
            super(id, name, logger, config);
            this.username = config.username;
            this.token = config.token;
            this.volumePool = config.volumePool || 'Storage';
            this.volume = (config.volume || '').replace(/^Storage\//, '');
        }

        async getFile (dataInfo) {
            const response = await this.getDownloadResponse(dataInfo);
            if (require.isBrowser) {
                return await response.arrayBuffer();
            } else {
                return Buffer.from(await response.arrayBuffer());
            }
        }

        async getFileStream (dataInfo) {
            const response = await this.getDownloadResponse(dataInfo);
            return response.body;
        }

        async putFile (filename, content) {
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
                size: content.byteLength || content.size,
                volumePool: this.volumePool
            };
            return this.createDataInfo(metadata);
        }

        async putFileStream (filename, stream) {
            this.ensureStreamSupport();
            this.ensureReadableStream(stream);
            await this.putFile(filename, stream);
            // stat necessary because of byteLength
            return await this.stat(filename);
        }

        async deleteDir (dirname) {
            const url = `data/${this.volumePool}/${this.volume}/${dirname}`;
            const opts = {method: 'DELETE'};
            return await this.fetch('delete directory', url, opts);
        }

        async deleteFile (dataInfo) {
            const {volume, filename, volumePool} = dataInfo.data;
            const url = `data/${volumePool}/${volume}/${filename}`;
            const opts = {method: 'DELETE'};
            return await this.fetch('delete', url, opts);
        }

        async getMetadata (dataInfo) {
            const metadata = {size: dataInfo.data.size};
            return metadata;
        }

        async getCachePath (dataInfo) {
            const {volume, filename} = dataInfo.data;
            return `${this.id}/${volume}/${filename}`;
        }

        async fetch (action, url, opts = {}) {
            const token = this.token || await getToken(this.username);
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
        }

        async getErrorMsg (response) {
            try {
                const contents = await response.json();
                return JSON.stringify(contents);
            } catch (err) {
                return await response.text();
            }
        }

        getURL (url) {
            if (url.startsWith('http')) {
                return url;
            }
            return BASE_URL + url;
        }

        async stat (path) {
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
        }

        async getDownloadResponse (dataInfo) {
            let {volume, filename, volumePool='Storage'} = dataInfo.data;
            const url = `file/${volumePool}/${volume}/${filename}`;
            return await this.fetch('download', url);
        }
    }

    return SciServerFiles;
});
