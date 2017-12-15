/*jshint node:true, mocha:true*/

describe('GenerateJob', function () {
    const testFixture = require('../../../globals');
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

    ////////// Helper Functions //////////
    var plugin,
        node,
        preparePlugin = function(done) {
            var context = {
                project: project,
                commitHash: commitHash,
                namespace: 'pipeline',
                branchName: 'test',
                activeNode: '/K/R/p/m'  // hello world operation
            };

            return manager.initializePlugin(pluginName)
                .then(plugin_ => {
                    plugin = plugin_;
                    return manager.configurePlugin(plugin, {}, context);
                })
                .then(() => node = plugin.activeNode)
                .nodeify(done);
        };

    describe('exec files', function() {
        describe('attribute file', function() {
            var boolString = /['"](True|False)['"]/g;

            beforeEach(preparePlugin);

            it('should not quote true (s) boolean values', function() {
                var files = {},
                    content,
                    matches;

                plugin.setAttribute(node, 'debug', 'true');
                plugin.createAttributeFile(node, files);
                content = files['attributes.py'];
                matches = content.match(boolString);
                expect(matches).to.equal(null);
            });

            describe('boolean to python boolean', function() {

                it('should convert true to True', function() {
                    var files = {},
                        content,
                        matches;

                    plugin.setAttribute(node, 'debug', 'true');
                    plugin.createAttributeFile(node, files);
                    content = files['attributes.py'];
                    matches = content.includes('True');
                    expect(matches).to.equal(true);
                });

                it('should convert false to False', function() {
                    var files = {},
                        content,
                        matches;

                    plugin.setAttribute(node, 'debug', 'False');
                    plugin.createAttributeFile(node, files);
                    content = files['attributes.py'];
                    matches = content.includes('False');
                    expect(matches).to.equal(true);
                });
            });

            it('should not quote true boolean values', function() {
                var files = {},
                    content,
                    matches;

                plugin.setAttribute(node, 'debug', true);
                plugin.createAttributeFile(node, files);
                content = files['attributes.py'];
                matches = content.match(boolString);
                expect(matches).to.equal(null);
            });

            it('should not quote false (s) boolean values', function() {
                var files = {},
                    content,
                    matches;

                plugin.setAttribute(node, 'debug', 'false');
                plugin.createAttributeFile(node, files);
                content = files['attributes.py'];
                matches = content.match(boolString);
                expect(matches).to.equal(null);
            });

            it('should not quote false boolean values', function() {
                var files = {},
                    content,
                    matches;

                plugin.setAttribute(node, 'debug', false);
                plugin.createAttributeFile(node, files);
                content = files['attributes.py'];
                matches = content.match(boolString);
                expect(matches).to.equal(null);
            });
        });
    });

    // TODO: What else should I test?
    // run a hello world example (use golem?)
 
});
