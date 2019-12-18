const {getSciServerToken, getSciServerUsername} = require('./sciserver');

async function getSciServerJobsConfig() {
    return {
        token: await getSciServerToken(),
        volume: `${getSciServerUsername()}/deepforge_test`,
        computeDomain: 'Small Jobs Domain',
    };
}

module.exports = async function() {
    const configs = {};
    configs['gme'] = {};
    configs['sciserver-compute'] = await getSciServerJobsConfig();

    return configs;
};
