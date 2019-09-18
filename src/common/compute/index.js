/*globals define, requirejs */
const COMPUTE_BACKENDS = ['gme', 'local'];
define([
    'q',
    'module',
    'deepforge/compute/backends/ComputeBackend',
].concat(COMPUTE_BACKENDS.map(name => `text!deepforge/compute/backends/${name}/metadata.json`)),
function(
    Q,
    module,
    ComputeBackend,
) {
    const Compute = {};

    Compute.getBackend = function(id) {
        id = id.toLowerCase();
        if (!COMPUTE_BACKENDS.includes(id)) {
            throw new Error(`Compute backend not found: ${id}`);
        }

        const relativePath = `backends/${id}/metadata.json`;
        const metadata = JSON.parse(requirejs(`text!deepforge/compute/${relativePath}`));
        return new ComputeBackend(id, metadata);
    };

    Compute.getAvailableBackends = function() {
        const settings = {backends: COMPUTE_BACKENDS};  // all by default
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
