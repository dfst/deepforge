/* globals define */
define([
    '../StorageClient',
], function (
    StorageClient
) {
    const S3Storage = function (id, name, logger, config = {}) {
        StorageClient.apply(this, arguments);
        this.relativeUrl = '/storage/s3';
        this.bucketName = config.bucketName;
        this.config = config;
    };

    S3Storage.prototype = Object.create(StorageClient.prototype);
    S3Storage.prototype.constructor = S3Storage;

    S3Storage.prototype._createBucketIfNeeded = async function (config) {
        if (!config.bucketName) {
            throw new Error('Please Provide a bucket name to use with S3 Bucket Service');
        }
        const res = await this.fetch('/createBucket',
            {
                headers: {
                    'Content-Type': 'application/json'
                },
                method: 'POST',
                body: JSON.stringify({
                    config: config,
                    bucketName: config.bucketName,
                })
            });
        const {alreadyExists} = await res.json();
        this.logger.debug(`Bucket ${config.bucketName}, ${alreadyExists ? 'Already Exists.' : 'created.'}`);
    };

    S3Storage.prototype._getPreAssignedURL = async function (config, bucketName, httpMethod, path) {
        const res = await this.fetch('/presignedUrl', {
            headers: {
                'Content-Type': 'application/json',
            },
            method: 'POST',
            body: JSON.stringify({
                config: config,
                bucketName: bucketName,
                httpMethod: httpMethod,
                path: path
            })
        });

        return await res.json();
    };

    S3Storage.prototype._stat = async function (config, path) {
        let {endPoint, port, secretKey, accessKey, useSSL} = config;
        const res = await this.fetch('/statObject', {
            method: 'post',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                config: {endPoint, port, secretKey, accessKey, useSSL},
                bucketName: this.bucketName,
                path: path
            })
        });
        return await res.json();
    };

    S3Storage.prototype.putFile = async function (path, content) {
        await this._createBucketIfNeeded(this.config);
        const httpInfo = await (this._getPreAssignedURL(this.config, this.bucketName, 'put', path));
        let res = await this.fetch(httpInfo.queryURL, {
            method: httpInfo.httpMethod.toUpperCase(),
            body: content
        });
        this.logger.debug(`Successfully uploaded the file to ${httpInfo.queryURL}, server response ${res.body}`);
        const metadata = await this._stat(this.config, path);
        metadata.bucketName = this.bucketName;
        metadata.path = path;
        res = await this._getPreAssignedURL(this.config, this.bucketName, 'get', path);
        metadata.url = res.queryURL;
        res = await this._getPreAssignedURL(this.config, this.bucketName, 'delete', path);
        metadata.deleteURL = res.queryURL;
        return this.createDataInfo(metadata);
    };

    S3Storage.prototype.getFile = async function (dataInfo) {
        const downloadURL = await this.getDownloadURL(dataInfo);
        const resObj = await this.fetch(downloadURL);
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
            throw new Error(`Cannot delete a directory without a bucket name`);
        }
        let res = await this._getPreAssignedURL(this.config, this.bucketName, 'delete', dirName);
        return await this.deleteFile({data: res.queryURL});
    };

    S3Storage.prototype.getURL = function (endPointOrFullURL) {
        if (endPointOrFullURL.startsWith('http')) {
            return endPointOrFullURL;
        }
        return this.relativeUrl + endPointOrFullURL;
    };

    return S3Storage;
});