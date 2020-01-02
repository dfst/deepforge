const {getSciServerToken, getSciServerUsername} = require('./sciserver');
async function getSciServerFilesConfig() {
    const username = getSciServerUsername();
    const token = await getSciServerToken();
    const volume = `${username}/deepforge_test`;

    return {token, volume};
}

function getMinioConfig() {
    const testFixture = require('../../globals');
    const gmeConfig = testFixture.getGmeConfig();
    const endPoint = 'localhost';
    const port = 9000;
    const accessKey = process.env.MINIO_ACCESS_KEY;
    const secretKey = process.env.MINIO_SECRET_KEY;
    const bucketName = process.env.MINIO_BUCKET_NAME || 'deepforge';
    const useSSL = false;
    const serverParams = {
        httpSecure: false,
        port: gmeConfig.server.port
    };
    return {endPoint, port, accessKey, secretKey, bucketName, useSSL, serverParams};
}

module.exports = async function () {
    const configs = {};
    configs['gme'] = {};

    configs['sciserver-files'] = await getSciServerFilesConfig();
    configs['s3'] = getMinioConfig();
    return configs;
};
