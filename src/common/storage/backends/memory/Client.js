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
            return this.createDataInfo(filename, filename);
        };

        return MemoryStorage;
    });
})();
