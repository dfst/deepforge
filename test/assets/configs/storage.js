const {getSciServerPassword, getSciServerUsername, login} = require('./sciserver');

async function getSciServerFilesConfig() {
    const username = getSciServerUsername();
    const password = getSciServerPassword();
    const token = await login(username, password);
    const volume = `${username}/deepforge_test`;
    const volumePool = 'Temporary';

    return {username, token, volume, volumePool};
}

function getS3Config() {
    return {
        endpoint: 'http://localhost:9000',
        accessKeyId: process.env.MINIO_ACCESS_KEY,
        secretAccessKey: process.env.MINIO_SECRET_KEY,
        bucketName: 'deepforge'
    };
}

module.exports = async function() {
    const configs = {};
    configs['gme'] = {};

    configs['sciserver-files'] = await getSciServerFilesConfig();
    configs['s3'] = getS3Config();

    return configs;
};
