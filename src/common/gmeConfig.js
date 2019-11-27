/* globals define, WebGMEGlobal */
define([
    'module',
], function(
    module,
) {

    if (require.isBrowser) {
        return WebGMEGlobal.gmeConfig;
    } else {
        const path = require.nodeRequire('path');
        const PROJECT_ROOT = path.join(path.dirname(module.uri), '..', '..');
        const configPath = path.join(PROJECT_ROOT, 'config');
        return require.nodeRequire(configPath);
    }
});
