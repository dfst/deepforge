/* globals define */
(function() {
    const FILES = {};

    define([
        '../StorageClient',
    ], function(
        StorageClient,
    ) {

        const MemoryStorage = function(/*name, logger*/) {
            StorageClient.apply(this, arguments);
        };

        MemoryStorage.prototype = Object.create(StorageClient.prototype);

        MemoryStorage.prototype.getFile = async function(dataInfo) {
            const {data} = dataInfo;
            return FILES[data];
        };

        MemoryStorage.prototype.putFile = async function(filename, content) {
            FILES[filename] = content;
            console.log('storing', filename, content);
            return this.createDataInfo(filename);
        };

        MemoryStorage.prototype.getMetadata = async function(dataInfo) {
            //const {data} = dataInfo;
            return {
                size: 1000  // arbitrary as this is only for testing
            };
        };

        MemoryStorage.prototype.getDownloadURL = async function(dataInfo) {
            const {data} = dataInfo;
            return data;  // dummy url
        };

        return MemoryStorage;
    });
})();
