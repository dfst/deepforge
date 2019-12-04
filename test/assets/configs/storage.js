const {getSciServerToken, getSciServerUsername} = require('./sciserver');

async function getSciServerFilesConfig() {
    const username = getSciServerUsername();
    const token = await getSciServerToken();
    const volume = `${username}/deepforge_test`;

    return {token, volume};
}

module.exports = async function() {
    const configs = {};
    configs['gme'] = {};

    configs['sciserver-files'] = await getSciServerFilesConfig();

    return configs;
};
