/*globals define, requirejs */
define([
    'module',
    './backends/StorageBackend',
    'text!deepforge/storage/backends/sciserver-files/metadata.json',
    'text!deepforge/storage/backends/gme/metadata.json',
    'text!deepforge/storage/backends/s3/metadata.json'
],function(
    module,
    StorageBackend,
    sciserverFiles,
    gme,
    s3,
) {
    const Storage = {};
    const StorageMetadata = {};
    StorageMetadata['sciserver-files'] = JSON.parse(sciserverFiles);
    StorageMetadata['gme'] = JSON.parse(gme);
    StorageMetadata['s3'] = JSON.parse(s3);
    const STORAGE_BACKENDS = Object.keys(StorageMetadata);

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

        const metadata = StorageMetadata[id];
        metadata.id = id;
        return deepCopy(metadata);
    };

    Storage.getMetadata = async function(dataInfo, logger, configs) {
        const client = await this.getClientForDataInfo(dataInfo, logger, configs);
        return client.getMetadata(dataInfo);
    };

    Storage.getDownloadURL = async function(dataInfo, logger, configs) {
        const client = await this.getClientForDataInfo(dataInfo, logger, configs);
        return client.getDownloadURL(dataInfo);
    };

    Storage.getFile = async function(dataInfo, logger, configs) {
        const client = await this.getClientForDataInfo(dataInfo, logger, configs);
        return client.getFile(dataInfo);
    };

    Storage.deleteFile = async function(dataInfo, logger, configs) {
        const client = await this.getClientForDataInfo(dataInfo, logger, configs);
        return client.deleteFile(dataInfo);
    };

    Storage.getCachePath = async function(dataInfo, logger, configs) {
        const client = await this.getClientForDataInfo(dataInfo, logger, configs);
        return await client.getCachePath(dataInfo);
    };

    Storage.getClientForDataInfo = async function(dataInfo, logger, configs={}) {
        const config = configs[dataInfo.backend];
        const backend = this.getBackend(dataInfo.backend);
        return await backend.getClient(logger, config);
    };

    Storage.getClient = async function(id, logger, config={}) {
        const backend = this.getBackend(id);
        return await backend.getClient(logger, config);
    };

    function deepCopy(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    return Storage;
});
