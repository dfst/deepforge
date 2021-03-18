const {getSciServerPassword, getSciServerUsername, login} = require('./sciserver');
const TokenStorage = require('../../../src/routers/SciServerAuth/Tokens');

async function getSciServerJobsConfig() {
    const username = getSciServerUsername();
    const password = getSciServerPassword();
    const token = await login(username, password);
    await TokenStorage.register(undefined, username, token);
    return {
        username: username,
        volume: `${username}/deepforge_test`,
        computeDomain: 'Small Jobs Domain',
    };
}

module.exports = async function() {
    const configs = {};
    configs['gme'] = {};
    configs['sciserver-compute'] = await getSciServerJobsConfig();

    return configs;
};
