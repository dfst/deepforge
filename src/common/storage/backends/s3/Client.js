/* globals define */
define([
    '../StorageClient',
], function (
    StorageClient
) {
    const S3Storage = function (id, name, logger, config = {}) {
        StorageClient.apply(this, arguments);
        let [url, isHttps] = this.getServerURL();
        this.relativeUrl = (isHttps ? `https://${url}`: `http://${url}`) + '/storage/s3';
        this.bucketName = config.bucketName;
        this.config = config;
    };


    S3Storage.prototype = Object.create(StorageClient.prototype);
    S3Storage.prototype.constructor = S3Storage;


    S3Storage.prototype._createBucketIfNeeded = async function () {
        if (!this.config.bucketName) {
            throw new Error('Please Provide a bucket name to use with S3 Bucket Service');
        }
        const res = await this.fetch('/createBucket',
            {
                headers: {
                    'Content-Type': 'application/json'
                },
                method: 'POST',
                body: JSON.stringify({
                    config: this.config,
                    bucketName: this.config.bucketName,
                })
            });
        const {alreadyExists} = await res.json();
        this.logger.debug(`Bucket ${this.config.bucketName}, ${alreadyExists ? 'Already Exists.' : 'created.'}`);
    };

    S3Storage.prototype._getPreAssignedURL = async function (bucketName, httpMethod, path, isdir = false) {
        const res = await this.fetch('/presignedUrl', {
            headers: {
                'Content-Type': 'application/json',
            },
            method: 'POST',
            body: JSON.stringify({
                config: this.config,
                bucketName: bucketName,
                httpMethod: httpMethod,
                path: path,
                isdir: isdir
            })
        });

        return await res.json();
    };

    S3Storage.prototype._stat = async function (path) {
        const res = await this.fetch('/statObject', {
            method: 'post',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                config: this.config,
                bucketName: this.bucketName,
                path: path
            })
        });
        return await res.json();
    };

    S3Storage.prototype.putFile = async function (path, content) {
        await this._createBucketIfNeeded();
        const httpInfo = await (this._getPreAssignedURL(this.bucketName, 'put', path));
        let res = await this.fetch(httpInfo.queryURL, {
            method: httpInfo.httpMethod.toUpperCase(),
            body: content
        });
        this.logger.debug(`Successfully uploaded the file to ${httpInfo.queryURL}, server response ${res.body}`);
        const metadata = await this._stat(path);
        metadata.bucketName = this.bucketName;
        metadata.path = path;
        res = await this._getPreAssignedURL(this.bucketName, 'get', path);
        metadata.url = res.queryURL;
        res = await this._getPreAssignedURL(this.bucketName, 'delete', path);
        metadata.deleteURL = res.queryURL;
        return this.createDataInfo(metadata);
    };

    S3Storage.prototype.getFile = async function (dataInfo) {
        const downloadURL = await this.getDownloadURL(dataInfo);
        const resObj = await this.fetch(downloadURL);
        this.logger.debug('Successfully downloaded artifact from S3 Storage');
        return require.isBrowser ? await resObj.arrayBuffer() : Buffer.from(await resObj.arrayBuffer());
    };

    S3Storage.prototype.deleteFile = async function (dataInfo) {
        const {data} = dataInfo;
        return await this.fetch(data.deleteURL, {method: 'DELETE'});
    };


    S3Storage.prototype.getDownloadURL = async function (dataInfo) {
        const {data} = dataInfo;
        return data.url;
    };

    S3Storage.prototype.getMetadata = async function (dataInfo) {
        const metaData = {size: dataInfo.data.size};
        return metaData;
    };

    S3Storage.prototype.getCachePath = async function (dataInfo) {
        const {bucketName, path} = dataInfo.data;
        return `${this.id}/${bucketName}/${path}`;
    };

    S3Storage.prototype.deleteDir = async function (dirName) {
        if (!this.bucketName) {
            throw new Error('Cannot delete a directory without a bucket name');
        }
        let res = await this.fetch('/listObjects', {
            method: 'post',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                config: this.config,
                bucketName: this.bucketName,
                prefix: dirName,
                recursive: true
            })
        });
        const resObj = await res.json();
        for (const obj of resObj.objects) {
            await this.deleteFile({
                data: { deleteURL: obj.deleteURL }
            });
            this.logger.debug(`Successfully deleted ${obj.name}`);
        }
        this.logger.debug('Deleted all the files in the bucket path');
    };

    S3Storage.prototype.getURL = function (endPointOrFullURL) {
        if (endPointOrFullURL.startsWith('http')) {
            return endPointOrFullURL;
        }
        return this.relativeUrl + endPointOrFullURL;
    };

    return S3Storage;
});