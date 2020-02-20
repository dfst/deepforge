/* globals define */
define([
    '../StorageClient'
], function (
    StorageClient,
) {
    const S3Storage = function (id, name, logger, config = {}) {
        StorageClient.apply(this, arguments);
        this.bucketName = config.bucketName || 'deepforge';
        this.endpoint = config.endpoint || 'http://localhost:80';
        this.config = this.createS3Config(config);
        this.s3Client = null;
        this.ready = this.initialize();
    };

    S3Storage.prototype = Object.create(StorageClient.prototype);


    S3Storage.prototype.initialize = async function () {
        if (require.isBrowser) {
            return new Promise((resolve, reject) => {
                require(['aws-sdk-min'], () => {
                    try {
                        /* eslint-disable no-undef*/
                        this.initializeS3Client(AWS);
                        /* eslint-enable no-undef*/
                        resolve();
                    } catch (err) {
                        reject(err);
                    }
                });
            });
        } else {
            const AWS = require.nodeRequire('aws-sdk');
            this.initializeS3Client(AWS);
        }
    };

    S3Storage.prototype.initializeS3Client = function (AWS) {
        this.s3Client = new AWS.S3(this.config);
        if (this.s3Client) {
            promisifyMethod(this.s3Client, 'createBucket');
            promisifyMethod(this.s3Client, 'getObject');
            promisifyMethod(this.s3Client, 'putObject');
            promisifyMethod(this.s3Client, 'deleteObject');
            promisifyMethod(this.s3Client, 'headObject');
            promisifyMethod(this.s3Client, 'listObjectsV2');
        }
    };

    S3Storage.prototype.getS3Client = async function () {
        await this.ready;
        return this.s3Client;
    };

    S3Storage.prototype.createS3Config = function (config) {
        return {
            endpoint: config.endpoint || 'http://localhost:80',
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
            sslEnabled: config.endpoint ? config.endpoint.startsWith('https') : false,
            s3ForcePathStyle: true, // needed with minio, from the documentation
            signatureVersion: 'v4'
        };
    };

    S3Storage.prototype.createBucketIfNeeded = async function () {
        const s3Client = await this.getS3Client();
        try {
            await s3Client.createBucket({
                Bucket: this.bucketName
            });
        } catch (err) {
            if (err['statusCode'] !== 409) {
                this.logger.error(`Failed to create bucket ${this.bucketName} in S3 server.`);
                throw err;
            }

        }
    };

    S3Storage.prototype.getFile = async function (dataInfo) {
        await this.stageConfigAndCreateNewS3Client(dataInfo);
        const {bucketName, filename} = dataInfo.data;
        const s3Client = await this.getS3Client();
        const data = await s3Client.getObject({
            Bucket: bucketName,
            Key: filename
        });
        await this.restoreS3Client();
        return data.Body;
    };

    S3Storage.prototype.putFile = async function (filename, content) {
        await this.createBucketIfNeeded();
        this.logger.debug(`Created bucket ${this.bucketName}`);
        const params = {
            Body: require.isBrowser ? new Blob([content]) : content,
            Bucket: this.bucketName,
            Key: filename,
        };
        const s3Client = await this.getS3Client();
        await s3Client.putObject(params);
        const metadata = await this._stat(filename, this.bucketName);
        metadata.filename = filename;
        metadata.size = metadata.ContentLength;
        metadata.bucketName = this.bucketName;
        metadata.endpoint = this.config.endpoint;
        this.logger.debug(`Successfully uploaded file ${filename} to the S3 server.`);
        return this.createDataInfo(metadata);
    };

    S3Storage.prototype._stat = async function (path, bucketName) {
        const params = {
            Bucket: bucketName,
            Key: path
        };
        return (await this.getS3Client()).headObject(params);
    };

    S3Storage.prototype.deleteDir = async function (dirname) {
        let dataInfo;
        const s3Client = await this.getS3Client();
        const {Contents} = await s3Client.listObjectsV2({
            Bucket: this.bucketName,
            MaxKeys: 1000,
            Prefix: dirname
        });

        for (const file of Contents) {
            dataInfo = {
                data: {
                    bucketName: this.bucketName,
                    filename: file.Key,
                    endpoint: this.endpoint
                }
            };
            await this.deleteFile(dataInfo);
        }
        this.logger.debug(`Successfully deleted directory ${dirname} from the S3 server`);
    };

    S3Storage.prototype.deleteFile = async function (dataInfo) {
        await this.stageConfigAndCreateNewS3Client(dataInfo);
        const {bucketName, filename} = dataInfo.data;
        const params = {
            Bucket: bucketName,
            Key: filename
        };
        await this.s3Client.deleteObject(params);
        await this.restoreS3Client();
    };

    S3Storage.prototype.stageConfigAndCreateNewS3Client = async function(dataInfo) {
        this.stagedConfig = JSON.parse(JSON.stringify(this.config));
        const {endpoint} = dataInfo.data;
        const {accessKeyId, secretAccessKey} = this.config;
        this.config = this.createS3Config({endpoint, accessKeyId, secretAccessKey});
        this.ready = await this.initialize();
    };

    S3Storage.prototype.restoreS3Client = async function () {
        if (this.stagedConfig) {
            this.config = this.stagedConfig;
            this.ready = await this.initialize();
            this.stagedConfig = null;
        }
    };


    S3Storage.prototype.getMetadata = async function (dataInfo) {
        const metadata = {size: dataInfo.data.size};
        return metadata;
    };

    S3Storage.prototype.getCachePath = async function (dataInfo) {
        const {bucketName, filename} = dataInfo.data;
        return `${this.id}/${bucketName}/${filename}`;
    };

    function promisifyMethod(object, method) {
        const fn = object[method];
        object[method] = function () {
            return new Promise((resolve, reject) => {
                const args = Array.prototype.slice.call(arguments);
                const callback = function (err, result) {
                    if (err) {
                        return reject(err);
                    }
                    resolve(result);
                };
                args.push(callback);
                fn.apply(object, args);
            });
        };
    }

    return S3Storage;
});
