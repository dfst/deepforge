/* globals define */
define([
    '../StorageClient'
], function (
    StorageClient,
) {
    const S3Storage = function (id, name, logger, config = {}) {
        StorageClient.apply(this, arguments);
        this.bucketName = config.bucketName || 'deepforge';
        this.endpoint = config.endpoint || 'https://s3.amazonaws.com';
        this.config = this.createS3Config(config);
        this.defaultClient = null;
        this.ready = this.initialize();
    };

    S3Storage.prototype = Object.create(StorageClient.prototype);

    S3Storage.prototype.initialize = async function () {
        if (require.isBrowser) {
            await new Promise((resolve, reject) => {
                require(['aws-sdk-min'], () => {
                    this.AWS = window.AWS;
                    resolve();
                }, reject);
            });
        } else {
            this.AWS = require.nodeRequire('aws-sdk');
        }
    };

    S3Storage.prototype.getS3Client = async function (config) {
        await this.ready;
        if(!config){
            if(!this.defaultClient){
                this.defaultClient = new this.AWS.S3(this.config);
            }
            return this.defaultClient;
        } else {
            config = this.createS3Config(config);
            return new this.AWS.S3(config);
        }
    };

    S3Storage.prototype.createS3Config = function (config) {
        return {
            endpoint: config.endpoint || 'https://s3.amazonaws.com',
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
            sslEnabled: config.endpoint ? config.endpoint.startsWith('https') : false,
            s3ForcePathStyle: true, // needed with minio, from the documentation
            signatureVersion: 'v4'
        };
    };

    S3Storage.prototype.createBucketIfNeeded = async function (s3Client) {
        const BUCKET_EXISTS_CODE = 409;
        try {
            await s3Client.createBucket({
                Bucket: this.bucketName
            }).promise();
        } catch (err) {
            if (err['statusCode'] !== BUCKET_EXISTS_CODE) {
                this.logger.error(`Failed to create bucket ${this.bucketName} in S3 server.`);
                throw err;
            }

        }
    };

    S3Storage.prototype.getFile = async function (dataInfo) {
        const {endpoint, bucketName, filename} = dataInfo.data;
        const {accessKeyId, secretAccessKey} = this.config;
        const s3Client = await this.getS3Client({endpoint, accessKeyId, secretAccessKey});
        const data = await s3Client.getObject({
            Bucket: bucketName,
            Key: filename
        }).promise();
        return data.Body;
    };

    S3Storage.prototype.putFile = async function (filename, content) {
        const s3Client = await this.getS3Client();
        await this.createBucketIfNeeded(s3Client);
        this.logger.debug(`Created bucket ${this.bucketName}`);
        const params = {
            Body: require.isBrowser ? new Blob([content]) : content,
            Bucket: this.bucketName,
            Key: filename,
        };
        try {
            await s3Client.putObject(params).promise();
        } catch (err) {
            throw new Error(`Unable to upload ${filename}: ${err.message}`);
        }
        const dataInfo = await this.stat(filename);

        this.logger.debug(`Successfully uploaded file ${filename} to the S3 server.`);
        return dataInfo;
    };

    S3Storage.prototype.deleteDir = async function (dirname) {
        const s3Client = await this.getS3Client();
        const {Contents} = await s3Client.listObjectsV2({
            Bucket: this.bucketName,
            MaxKeys: 1000,
            Prefix: dirname
        }).promise();

        for (const file of Contents) {
            const params = {
                Bucket: this.bucketName,
                Key: file.Key
            };
            await s3Client.deleteObject(params).promise();
        }
        this.logger.debug(`Successfully deleted directory ${dirname} from the S3 server`);
    };

    S3Storage.prototype.deleteFile = async function (dataInfo) {
        const {endpoint, bucketName, filename} = dataInfo.data;
        const {accessKeyId, secretAccessKey} = this.config;
        const s3Client = await this.getS3Client({endpoint, accessKeyId, secretAccessKey});
        const params = {
            Bucket: bucketName,
            Key: filename
        };
        await s3Client.deleteObject(params).promise();
    };

    S3Storage.prototype.getMetadata = async function (dataInfo) {
        const metadata = {size: dataInfo.data.size};
        return metadata;
    };

    S3Storage.prototype.getCachePath = async function (dataInfo) {
        const {bucketName, filename} = dataInfo.data;
        return `${this.id}/${bucketName}/${filename}`;
    };

    S3Storage.prototype.stat = async function (path) {
        const params = {
            Bucket: this.bucketName,
            Key: path
        };
        const metadata = await ((await this.getS3Client())
            .headObject(params).promise());
        metadata.filename = path;
        metadata.size = metadata.ContentLength;
        metadata.bucketName = this.bucketName;
        metadata.endpoint = this.config.endpoint;
        return this.createDataInfo(metadata);
    };

    return S3Storage;
});
