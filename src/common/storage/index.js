/*globals define, requirejs */
(function() {
    const STORAGE_BACKENDS = ['gme', 'memory'];

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
            const metadata = this.getMetadata(id);
            return new StorageBackend(id, metadata);
        };

        Storage.getMetadata = function(id) {
            id = id.toLowerCase();
            if (!STORAGE_BACKENDS.includes(id)) {
                throw new Error(`Storage backend not found: ${id}`);
            }

            const relativePath = `backends/${id}/metadata.json`;
            const metadata = JSON.parse(requirejs(`text!deepforge/storage/${relativePath}`));
            metadata.id = id;
            return metadata;
        };

        Storage.transfer = async function(dataInfo, id) {
            // TODO: Should dataInfo include the filename?
            const {filename} = dataInfo;
            //if (dataInfo.backend === id) return;  // TODO: Should we be able to transfer between different locations in the same backend?

            const srcStorage = this.getBackend(dataInfo.backend).getClient();
            const dstStorage = this.getBackend(id).getClient();
            const content = await srcStorage.getFile(dataInfo);
            // TODO: What should the filename be?
            // TODO: It might be nice to stream in the future...
            return await dstStorage.putFile(filename, content);
        };

        return Storage;
    });
})();
