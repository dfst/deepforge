/*globals define*/
define([
    'deepforge/viz/ConfigDialog',
    'deepforge/storage/index',
    'panel/FloatingActionButton/styles/Materialize',
], function(
    ConfigDialog,
    Storage,
    Materialize,
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

    StorageHelpers.download = async function (dataInfo, dataName='data') {
        const config = await StorageHelpers.getAuthenticationConfig(dataInfo);
        const storageAdapter = await Storage.getClient(dataInfo.backend, null, config);
        const storageName = Storage.getStorageMetadata(dataInfo.backend).name;

        Materialize.toast(`Fetching ${dataName} from ${storageName}...`, 2000);
        let reminders = setInterval(
            () => Materialize.toast(`Still fetching ${dataName} from ${storageName}...`, 5000),
            10000
        );
        const url = await storageAdapter.getDownloadURL(dataInfo);
        clearInterval(reminders);

        const save = document.createElement('a');

        save.href = url;
        save.target = '_self';
        const hasExtension = dataName.includes('.');
        const filename = hasExtension ? dataName :
            dataName + '.dat';
        save.download = filename;
        save.click();
        (window.URL || window.webkitURL).revokeObjectURL(save.href);
    };

    return StorageHelpers;
});
