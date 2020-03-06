const condaUtils = require('../../../utils/conda-utils'),
    expect = require('chai').expect,
    path = require('path'),
    ENV_FILE = path.join(__dirname, '..', '..', '..', 'base-environment.yml');
describe('Conda utils', function () {
    let dependencies;
    before(() => {
        dependencies = {
            packages: {
                conda: ['sympy', 'unyt'],
                pip: ['click']
            }
        };
    });

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

    it('should update dependencies from a JSON object', () => {
        const updateFunc = () => {
            condaUtils.updateDependencies(ENV_FILE, dependencies, false, false);
        };
        expect(updateFunc).to.not.throw();
    });
});