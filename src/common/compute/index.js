/*globals define, requirejs */
const COMPUTE_BACKENDS = ['gme', 'local'];
define([
    'q',
    'module'
].concat(COMPUTE_BACKENDS.map(name => `deepforge/compute/backends/${name}/index`)),
function(
    Q,
    module
) {
    const Compute = {};

    Compute.getBackend = function(name) {
        name = name.toLowerCase();
        if (!COMPUTE_BACKENDS.includes(name)) {
            throw new Error(`Compute backend not found: ${name}`);
        }

        const relativePath = `backends/${name}/index`;
        const Backend = requirejs(`deepforge/compute/${relativePath}`);
        return new Backend();
    };

    Compute.getAvailableBackends = function() {
        const settings = {backends: ['local', 'gme']};
        if (require.isBrowser) {
            const ComponentSettings = requirejs('js/Utils/ComponentSettings');
            ComponentSettings.resolveWithWebGMEGlobal(
                settings,
                this.getComponentId()
            );
        } else {  // Running in NodeJS
            const path = require('path');
            const dirname = path.dirname(module.uri);
            const deploymentSettings = JSON.parse(requirejs('text!' + dirname + '/../../../config/components.json'));
            Object.assign(settings, deploymentSettings[this.getComponentId()]);
        }

        return settings.backends;
    };

    Compute.getComponentId = function() {
        return 'Compute';
    };

    return Compute;
});
