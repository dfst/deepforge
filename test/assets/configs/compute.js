const {getSciServerPassword, getSciServerUsername, login} = require('./sciserver');

async function getSciServerJobsConfig() {
    const username = getSciServerUsername();
    const password = getSciServerPassword();
    const token = await login(username, password);
    return {
        username: username,
        token: token,
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
