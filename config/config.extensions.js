
module.exports = config => {
    config.extensions = {};
    config.extensions.InteractiveComputeHost = process.env.DEEPFORGE_INTERACTIVE_COMPUTE_HOST;
    return config;
};
