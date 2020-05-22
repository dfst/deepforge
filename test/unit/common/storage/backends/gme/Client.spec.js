describe('GME Storage Adapter', function() {
    const testFixture = require('../../../../../globals');
    const assert = require('assert');
    const Storage = testFixture.requirejs('deepforge/storage/index');
    const ID = 'gme';

    it('should correctly generate blob client params (https)', async function() {
        const client = await Storage.getClient(ID);
        const {DEEPFORGE_HOST} = process.env;
        process.env.DEEPFORGE_HOST = 'https://editor.deepforge.org';
        const params = client.getBlobClientParams();
        process.env.DEEPFORGE_HOST = DEEPFORGE_HOST;
        assert.equal(params.serverPort, 443);
    });

    it('should correctly generate blob client params', async function() {
        const client = await Storage.getClient(ID);
        const {DEEPFORGE_HOST} = process.env;
        process.env.DEEPFORGE_HOST = 'http://editor.deepforge.org';
        const params = client.getBlobClientParams();
        process.env.DEEPFORGE_HOST = DEEPFORGE_HOST;
        assert.equal(params.serverPort, 80);
    });
});
