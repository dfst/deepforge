/*globals define, requirejs */
(function() {
    const COMPUTE_BACKENDS = ['gme', 'local', 'sciserver-compute'];
    const metadataPath = name => `deepforge/compute/backends/${name}/metadata`;
    define([
        'module',
        'deepforge/compute/backends/ComputeBackend',
    ].concat(COMPUTE_BACKENDS.map(metadataPath)),
    function(
        module,
        ComputeBackend,
    ) {
        const Compute = {};

        Compute.getComponentId = function() {
            return 'Compute';
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

        Compute.getBackend = function(id) {
            const metadata = this.getMetadata(id);
            return new ComputeBackend(id, metadata);
        };

        Compute.prepareConfig = async function(id, config) {
            const backend = this.getBackend(id);
            return backend.prepareConfig(config);
        };

        Compute.getMetadata = function(id) {
            id = id.toLowerCase();
            if (!COMPUTE_BACKENDS.includes(id)) {
                throw new Error(`Compute backend not found: ${id}`);
            }

            const metadata = requirejs(metadataPath(id));
            metadata.id = id;
            return metadata;
        };

        return Compute;
    });
})();
