const merge = require('lodash.merge');

module.exports = config => {
    config = merge({}, config);
    config.extensions = {};
    config.extensions.InteractiveComputeHost = process.env.DEEPFORGE_INTERACTIVE_COMPUTE_HOST;
    return config;
};
