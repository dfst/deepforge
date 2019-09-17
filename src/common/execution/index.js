/*globals define, requirejs */
define([
    'underscore',
    'module',
], function(
    _,
    module
) {
    const Execution = {};
    const BACKENDS = ['gme', 'local'];

    Execution.getBackend = function(name) {
        name = name.toLowerCase();
        if (!BACKENDS.includes(name)) {
            throw new Error(`Execution backend not found: ${name}`);
        }

        const relativePath = `backends/${name}/index`;
        const Backend = requirejs(`deepforge/execution/${relativePath}`);
        return new Backend();
    };

    Execution.getAvailableBackends = function() {
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
            _.extend(settings, deploymentSettings[this.getComponentId()]);
        }

        return settings.backends;
    };

    Execution.getComponentId = function() {
        return 'Compute';
    };

    return Execution;
});
