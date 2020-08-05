/*global define*/
define([
    'deepforge/gmeConfig',
], function(
    config,
) {
    const metadata = {
        name: 'WebGME Blob Storage',
        configStructure: []
    };


    if (config.authentication.enable) {
        metadata.configStructure.push({
            name: 'apiToken',
            displayName: 'Access Token',
            value: '',
            valueType: 'string',
            readOnly: false,
            isAuth: true,
            isRequiredForBrowser: false,
        });
    }
    return metadata;
});
