describe('CondaUtils', function () {
    const condaUtils = require('../../../utils/conda-utils'),
        expect = require('chai').expect,
        path = require('path'),
        ENV_FILE = path.join(__dirname, '..', '..', '..', 'environment.yml');

    it('should find executable conda', () => {
        expect(condaUtils.checkConda).to.not.throw();
    });

    it('should throw an error when creating from a missing environment file', () => {
        const badCreateFunc = () => {
            condaUtils.createOrUpdateEnvironment('dummyfile');
        };
        expect(badCreateFunc).to.throw();
    });

    it('should not throw an error from a proper environment file', () => {
        const createFunc = () => {
            condaUtils.createOrUpdateEnvironment(ENV_FILE);
        };
        expect(createFunc).to.not.throw();
    });
});