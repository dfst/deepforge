/* globals define */
const deps = ['../StorageClient', 'aws-sdk-min'];
define(deps, function (
    StorageClient,
) {
    const S3Storage = function (id, name, logger, config = {}) {
        StorageClient.apply(this, arguments);
        this.bucketName = config.bucketName;
        this.endpoint = config.endpoint;
        this.config = this.createS3Config(config);
        const AWS = require.isBrowser ? window.AWS : require.nodeRequire('aws-sdk');
        this.s3Client = new AWS.S3(this.config);
    };

    S3Storage.prototype = Object.create(StorageClient.prototype);

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
        const {bucketName, filename} = dataInfo.data;
        const params = {
            Bucket: bucketName,
            Key: filename
        };
        return new Promise((resolve, reject) => {
            this.s3Client.getObject(params, (err, data) => {
                if (err) {
                    this.logger.error(`Failed to get object from s3 server with error ${err}`);
                    reject(err);
                } else {
                    resolve(data.Body);
                }
            });
        });
    };

    S3Storage.prototype.putFile = async function (filename, content) {
        try {
            await this.createBucketIfNeeded();
            this.logger.debug(`Created bucket ${this.bucketName}`);
        } catch (err) {
            if (err.statusCode !== 409) {
                this.logger.error(`Failed to create bucket ${this.bucketName} with error ${JSON.stringify(err)}`);
                throw err;
            }
        }
        const params = {
            Body: require.isBrowser ? new Blob([content]) : content,
            Bucket: this.bucketName,
            Key: filename,
        };
        return new Promise((resolve, reject) => {
            this.s3Client.putObject(params, async (err, data) => {
                if (err) {
                    this.logger.error(`File upload to s3 Storage unsuccessful with error ${JSON.stringify(err)}`);
                    reject(err);
                } else {
                    const metadata = await this._stat(filename, this.bucketName);
                    metadata.filename = filename;
                    metadata.size = metadata.ContentLength;
                    metadata.bucketName = this.bucketName;
                    metadata.endpoint = this.config.endpoint;
                    resolve(this.createDataInfo(metadata));
                }
            });
        });
    };

    S3Storage.prototype._stat = async function (path, bucketName) {
        const params = {
            Bucket: bucketName,
            Key: path
        };
        return new Promise((resolve, reject) => this.s3Client.headObject(params, (err, data) => {
            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
        }));
    };

    S3Storage.prototype.deleteDir = async function (dirname) {
        let dataInfo;
        return new Promise((resolve, reject) => {
            this.s3Client.listObjectsV2({
                Bucket: this.bucketName,
                MaxKeys: 1000,
                Prefix: dirname
            }, async (err, data) => {
                if (err) {
                    reject(err);
                } else {
                    try {
                        for (const file of data.Contents) {
                            dataInfo = {
                                bucketName: this.bucketName,
                                Key: file.Key
                            };
                            await this.deleteFile(dataInfo);
                        }
                    } catch (err) {
                        reject(err);
                    }
                    resolve(`Successfully deleted directory/path ${dirname} in the S3 server`);
                }
            });
        });
    };

    S3Storage.prototype.deleteFile = async function (dataInfo) {
        const {bucketName, filename} = dataInfo.data;
        const params = {
            Bucket: bucketName,
            Key: filename
        };
        return new Promise((resolve, reject) => {
            this.s3Client.deleteObject(params, (err, data) => {
                if (err) {
                    this.logger.error(`Failed to delete object from s3 server with error ${err}`);
                    reject(err);
                } else {
                    resolve(data);
                }
            });
        });

    };

    S3Storage.prototype.getMetadata = async function (dataInfo) {
        const metadata = {size: dataInfo.data.size};
        return metadata;
    };

    S3Storage.prototype.getCachePath = async function (dataInfo) {
        const {bucketName, filename} = dataInfo.data;
        return `${this.id}/${bucketName}/${filename}`;
    };


    return S3Storage;
});
