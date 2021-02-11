/*globals define*/

define([
    'text!./metadata.json',
    'plugin/PluginBase',
    'fs',
    '../../visualizers/panels/ForgeActionButton/Libraries.json',
], function (
    pluginMetadata,
    PluginBase,
    fs,
    Libraries,
) {
    'use strict';

    const fsp = fs.promises;
    pluginMetadata = JSON.parse(pluginMetadata);

    class UploadLibraryModelToBlob extends PluginBase {
        constructor(libraries=Libraries) {
            super();
            this.pluginMetadata = pluginMetadata;
            this.libraries = libraries;
        }

        async main(/*callback*/) {
            const config = this.getCurrentConfig();
            const {libraryName, modelName} = config;
            const hash = await this.uploadLibraryModel(libraryName, modelName);
            this.createMessage(this.rootNode, hash);
            this.result.setSuccess(true);
            //callback(null, this.result);
        }

        async uploadLibraryModel(libraryName, modelName) {
            const data = await fsp.readFile(this.getLibraryModelPath(libraryName, modelName));
            const hash = await this.blobClient.putFile(`${modelName}.webgmexm`, data);
            return hash;
        }

        getLibraryModelPath(libraryName, modelName) {
            const modelInfo = this.getLibraryModelInfo(libraryName, modelName);
            return modelInfo.path;
        }

        getLibraryModelInfo(libraryName, modelName) {
            const libraryInfo = this.libraries.find(libraryInfo => libraryInfo.name === libraryName);
            if (!libraryInfo) {
                throw new Error(`Library not found: ${libraryName}`);
            }
            const modelInfo = libraryInfo.models.find(modelInfo => modelInfo.name === modelName);
            if (!modelInfo) {
                throw new Error(`Model not found in ${libraryName}: ${modelName}`);
            }
            return modelInfo;
        }
    }

    UploadLibraryModelToBlob.metadata = pluginMetadata;

    return UploadLibraryModelToBlob;
});
