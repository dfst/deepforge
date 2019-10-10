/*globals define*/
define([
    'common/util/assert',
], function(
    assert
) {

    const GeneratedFiles = function(blobClient) {
        this.blobClient = blobClient;
        this._files = {};
        this._data = {};
    };

    GeneratedFiles.prototype.addUserAsset = function (path, dataInfo) {
        assert(!!dataInfo, `Adding undefined user asset: ${path}`);
        dataInfo = typeof dataInfo === 'object' ? dataInfo : JSON.parse(dataInfo);
        this._data[path] = dataInfo;
    };

    GeneratedFiles.prototype.getUserAssetPaths = function () {
        return Object.keys(this._data);
    };

    GeneratedFiles.prototype.getUserAsset = function (path) {
        return this._data[path];
    };

    GeneratedFiles.prototype.getUserAssets = function () {
        return Object.entries(this._data);
    };

    GeneratedFiles.prototype.addFile = function (path, contents) {
        this._files[path] = contents;
    };

    GeneratedFiles.prototype.appendToFile = function (path, contents) {
        this._files[path] = (this._files[path] || '') + contents;
    };

    GeneratedFiles.prototype.getFile = function (path) {
        return this._files[path];
    };

    GeneratedFiles.prototype.getFilePaths = function () {
        return Object.keys(this._files);
    };

    GeneratedFiles.prototype.remove = function (path) {
        delete this._files[path];
        delete this._data[path];
    };

    GeneratedFiles.prototype.save = async function (artifactName) {
        const artifact = this.blobClient.createArtifact(artifactName);

        // TODO: Transfer the data files to the blob and fetch them
        //await artifact.addObjectHashes(this._data);  // TODO: Update this
        await artifact.addFiles(this._files);
        return await artifact.save();
    };

    return GeneratedFiles;
});
