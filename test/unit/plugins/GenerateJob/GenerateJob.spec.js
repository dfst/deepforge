/*jshint node:true, mocha:true*/

describe('GenerateJob', function () {
    const testFixture = require('../../../globals');
    const GenerateJob = testFixture.requirejs('plugin/GenerateJob/GenerateJob/GenerateJob');
    var gmeConfig = testFixture.getGmeConfig(),
        expect = testFixture.expect,
        logger = testFixture.logger.fork('GenerateJob'),
        PluginCliManager = testFixture.WebGME.PluginCliManager,
        manager = new PluginCliManager(null, logger, gmeConfig),
        projectName = 'testProject',
        pluginName = 'GenerateJob',
        project,
        gmeAuth,
        storage,
        commitHash;

    before(function (done) {
        testFixture.clearDBAndGetGMEAuth(gmeConfig, projectName)
            .then(function (gmeAuth_) {
                gmeAuth = gmeAuth_;
                // This uses in memory storage. Use testFixture.getMongoStorage to persist test to database.
                storage = testFixture.getMemoryStorage(logger, gmeConfig, gmeAuth);
                return storage.openDatabase();
            })
            .then(function () {
                var importParam = {
                    projectSeed: testFixture.path.join(testFixture.DF_SEED_DIR, 'devProject', 'devProject.webgmex'),
                    projectName: projectName,
                    branchName: 'master',
                    logger: logger,
                    gmeConfig: gmeConfig
                };

                return testFixture.importProject(storage, importParam);
            })
            .then(function (importResult) {
                project = importResult.project;
                commitHash = importResult.commitHash;
                return project.createBranch('test', commitHash);
            })
            .nodeify(done);
    });

    after(function (done) {
        storage.closeDatabase()
            .then(function () {
                return gmeAuth.unload();
            })
            .nodeify(done);
    });

    // TODO
    describe.skip('basic checks', function() {
        var pluginResult,
            error;

        // TODO: update tests for python
        before(function(done) {
            var pluginConfig = {
                },
                context = {
                    project: project,
                    commitHash: commitHash,
                    branchName: 'test',
                    activeNode: '/1',
                };

            manager.executePlugin(pluginName, pluginConfig, context, (err, result) => {
                error = err;
                pluginResult = result;

                done();
            });
        });

        it('should run without error', function () {
            expect(error).to.equal(null);
            expect(typeof pluginResult).to.equal('object');
            expect(pluginResult.success).to.equal(true);
        });

        it('should generate artifacts', function () {
            expect(pluginResult.artifacts[0]).to.not.equal(undefined);
        });

        it('should NOT update the branch', function (done) {
            project.getBranchHash('test')
                .then(function (branchHash) {
                    expect(branchHash).to.equal(commitHash);
                })
                .nodeify(done);
        });
    });

    // GenerateJob
    describe('utilities', function() {
        describe('toSnakeCase', function() {
            it('should convert from upper camelcase to snake case', function() {
                const snake = GenerateJob.toSnakeCase('HelloWorld');
                expect(snake).to.equal('hello_world');
            });

            it('should remove extra spaces during conversion to snake case', function() {
                const snake = GenerateJob.toSnakeCase('hello world');
                expect(snake).to.equal('hello_world');
            });

            it('should not contain duplicate _\'s', function() {
                const snake = GenerateJob.toSnakeCase('Hello World');
                expect(snake).to.equal('hello_world');
            });
        });

        describe('toUpperCamelCase', function() {
            [
                ['hello_world', 'HelloWorld'],
                ['hello world', 'HelloWorld'],
                ['hello _world', 'HelloWorld'],
                [' hello _world', 'HelloWorld'],
                ['helloWorld', 'HelloWorld'],
                ['hello-_*World', 'HelloWorld'],
            ].forEach(testCase => {
                const [input, expected] = testCase;
                it(`should convert ${input} to ${expected}`, function() {
                    const output = GenerateJob.toUpperCamelCase(input);
                    expect(output).to.equal(expected);
                });
            });

        });
    });

    // TODO: What else should I test?
    // run a hello world example (use golem?)
 
});
