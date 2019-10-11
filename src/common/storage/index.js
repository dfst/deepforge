/*globals define, requirejs */
(function() {
    const STORAGE_BACKENDS = ['gme'];

    define([
        'module',
        'deepforge/storage/backends/StorageBackend',
    ].concat(STORAGE_BACKENDS.map(name => `text!deepforge/storage/backends/${name}/metadata.json`)),
    function(
        module,
        StorageBackend,
    ) {
        const Storage = {};

        Storage.getComponentId = function() {
            return 'Storage';
        };

        Storage.getAvailableBackends = function() {
            const settings = {backends: STORAGE_BACKENDS};  // all by default
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

        Storage.getBackend = function(id) {
            const metadata = this.getStorageMetadata(id);
            return new StorageBackend(id, metadata);
        };

        Storage.getStorageMetadata = function(id) {
            id = id.toLowerCase();
            if (!STORAGE_BACKENDS.includes(id)) {
                throw new Error(`Storage backend not found: ${id}`);
            }

            const relativePath = `backends/${id}/metadata.json`;
            const metadata = JSON.parse(requirejs(`text!deepforge/storage/${relativePath}`));
            metadata.id = id;
            return metadata;
        };

        Storage.getMetadata = async function(dataInfo, logger) {
            const backend = this.getBackend(dataInfo.backend);
            const client = await backend.getClient(logger);
            return client.getMetadata(dataInfo);
        };

        Storage.getDownloadURL = async function(dataInfo, logger) {
            const backend = this.getBackend(dataInfo.backend);
            const client = await backend.getClient(logger);
            return client.getDownloadURL(dataInfo);
        };

        Storage.getFile = async function(dataInfo, logger) {
            const backend = this.getBackend(dataInfo.backend);
            const client = await backend.getClient(logger);
            return client.getFile(dataInfo);
        };

        Storage.getCachePath = async function(dataInfo, logger) {
            const backend = this.getBackend(dataInfo.backend);
            const client = await backend.getClient(logger);
            return await client.getCachePath(dataInfo);
        };

        return Storage;
    });
})();
