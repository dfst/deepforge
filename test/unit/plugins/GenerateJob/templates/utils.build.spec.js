describe('utils.build', function () {
    const testFixture = require('../../../../globals');
    const {PROJECT_ROOT} = testFixture;
    const Storage = testFixture.requirejs('deepforge/storage/index');
    const Utils = testFixture.requirejs('plugin/GenerateJob/GenerateJob/templates/utils.build');
    const assert = require('assert');
    const {promisify} = require('util');
    const exec = promisify(require('child_process').exec);

    it('should include Storage', function() {
        assert.equal(Utils.Storage, Storage);
    });

    it('should expose Storage w/ support for available backends', async function() {
        const backends = Storage.getAvailableBackends();
        for (let i = backends.length; i--;) {
            const name = backends[i];
            assert(await hasBackend(name), `Storage missing backend: ${name}`);
        }
    });

    it('should include BlobClient', function() {
        assert(Utils.BlobClient);
    });

    it('should include Constants', function() {
        assert(Utils.Constants);
    });

    // This next method is necessary since `Utils` is loaded with
    // the currently configured requirejs. That is, Storage === Utils.Storage.
    // This is a problem as we would like to compare the version of Storage
    // bundled in utils.build with the version in src/common/storage.
    function hasBackend(name) {
        const utilsPath = 'src/plugins/GenerateJob/templates/utils.build.js';
        const Storage = `require("requirejs")("${PROJECT_ROOT}/${utilsPath}").Storage`;
        const cmd = `${Storage}.getStorageMetadata("${name}")`;
        return new Promise(
            resolve => exec(`node -e '${cmd}'`, err => resolve(!err))
        );
    }
});
