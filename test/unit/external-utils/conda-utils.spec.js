describe('CondaUtils', function () {
    const conda = require('../../../utils/conda-utils'),
        expect = require('chai').expect,
        path = require('path'),
        ENV_FILE = path.join(__dirname, '..', '..', '..', 'environment.server.yml');

    it('should find executable conda', () => {
        expect(conda.check).to.not.throw();
    });

    it('should throw an error when creating from a missing environment file', async () => {
        const badCreateFunc = () => conda.createOrUpdateEnvironment('dummyfile');
        await shouldThrow(badCreateFunc);
    });

    it('should not throw an error from a proper environment file', async function() {
        this.timeout(5000);
        await conda.createOrUpdateEnvironment(ENV_FILE);
    });

    async function shouldThrow(fn) {
        try {
            await fn();
        } catch (err) {
            return err;
        }
        throw new Error('Function did not throw an exception.');
    }
});
