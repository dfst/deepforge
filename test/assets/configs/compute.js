const {getSciServerPassword, getSciServerUsername} = require('./sciserver');

function getSciServerJobsConfig() {
    const username = getSciServerUsername();
    return {
        username: username,
        password: getSciServerPassword(),
        volume: `${username}/deepforge_test`,
        computeDomain: 'Small Jobs Domain',
    };
}

module.exports = async function() {
    const configs = {};
    configs['gme'] = {};
    configs['sciserver-compute'] = getSciServerJobsConfig();

    return configs;
};
