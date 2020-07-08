/*globals define*/
define([
    'deepforge/viz/ConfigDialog',
    'deepforge/storage/index',
], function(
    ConfigDialog,
    Storage,
) {
    const StorageHelpers = {};

    StorageHelpers.getAuthenticationConfig = async function (dataInfo) {
        const {backend} = dataInfo;
        const metadata = Storage.getStorageMetadata(backend);
        metadata.configStructure = metadata.configStructure
            .filter(option => option.isAuth);
        if (metadata.configStructure.length) {
            const configDialog = new ConfigDialog();
            const title = `Authenticate with ${metadata.name}`;
            const iconClass = `glyphicon glyphicon-download-alt`;
            const config = await configDialog.show(metadata, {title, iconClass});

            return config[backend];
        }
    };

    return StorageHelpers;
});
