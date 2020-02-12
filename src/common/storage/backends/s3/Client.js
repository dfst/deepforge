/* globals define */
define([
    '../StorageClient',
    './lib/aws-sdk-2.615.0.min'
], function (
    StorageClient,
) {
    const S3Storage = function (id, name, logger, config = {}) {
        StorageClient.apply(this, arguments);
        this.bucketName = config.bucketName;
        this.endpoint = config.endpoint;
        this.config = this.createS3Config(config);
        if(require.isBrowser){
            this.s3Client = new AWS.S3(this.config);
        } else {
            let AWS = require.nodeRequire('aws-sdk');
            this.s3Client = new AWS.S3(this.config);
        }
    };

    S3Storage.prototype = Object.create(StorageClient.prototype);

    S3Storage.prototype.createS3Config = function (config) {
        return {
            endpoint: config.endpoint || 'http://localhost:80',
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
            sslEnabled: config.endpoint.startsWith('https'),
            s3ForcePathStyle: true, // needed with minio?
            signatureVersion: 'v4'
        };
    };

    S3Storage.prototype.createBucketIfNeeded = async function () {
        return new Promise((resolve, reject) => {
            this.s3Client.createBucket({
                Bucket: this.bucketName
            }, function (err, data) {
                if (err) {
                    reject(err);
                } else {
                    resolve(data);
                }
            });
        });
    };

    S3Storage.prototype.getFile = async function (dataInfo) {
       throw new Error('This hasn\'t been implemented yet');
    };

    S3Storage.prototype.putFile = async function (filename, content) {
        try {
            await this.createBucketIfNeeded();
            this.logger.debug(`Created bucket ${this.bucketName}`)
        } catch (err) {
            if (err.statusCode !== 409) {
                this.logger.error(`Failed to created bucket ${this.bucketName} with error ${JSON.stringify(err)}`);
                throw err;
            }
            this.logger.debug(`Bucket ${this.bucketName} already exists, not creating a new bucket`);
        }
        const params = {
            Body: require.isBrowser? new Blob([content]): content,
            Bucket: this.bucketName,
            Key: filename,
        };
        console.log(typeof content);
        return new Promise((resolve, reject) => {
            this.s3Client.putObject(params, (err, data) => {
                if (err) {
                    reject(err);
                } else {
                    const metadata = {
                        filename: filename,
                        bucketName: this.bucketName,
                        size: content.byteLength,
                    };
                    resolve(this.createDataInfo(metadata));
                }
            });
        });

    };

    S3Storage.prototype.deleteDir = async function (dirname) {
        throw new Error(`This hasn't been implemented yet`);
    };

    S3Storage.prototype.deleteFile = async function (dataInfo) {
        throw new Error(`This hasn't been implemented yet`);
    };

    S3Storage.prototype.getMetadata = async function (dataInfo) {
        const metadata = {size: dataInfo.data.size};
        return metadata;
    };

    S3Storage.prototype.getCachePath = async function (dataInfo) {
        throw new Error(`This hasn't been implemented yet`);
    };

    S3Storage.prototype.fetch = async function (url, opts = {}) {
        throw new Error(`This hasn't been implemented yet`);
    };

    return S3Storage;
});
