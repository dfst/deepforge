/*jshint node:true, mocha:true*/

'use strict';
var testFixture = require('../../globals');

describe('ValidateArchitecture', function () {
    var gmeConfig = testFixture.getGmeConfig(),
        expect = testFixture.expect,
        logger = testFixture.logger.fork('ValidateArchitecture'),
        PluginCliManager = testFixture.WebGME.PluginCliManager,
        manager = new PluginCliManager(null, logger, gmeConfig),
        projectName = 'testProject',
        pluginName = 'ValidateArchitecture',
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

    var plugin,
        preparePlugin = function(done) {
            var context = {
                project: project,
                commitHash: commitHash,
                namespace: 'nn',
                branchName: 'test',
                activeNode: '/4/n'  // "simple broken" architecture
            };

            return manager.initializePlugin(pluginName)
                .then(plugin_ => {
                    plugin = plugin_;
                    return manager.configurePlugin(plugin, {}, context);
                })
                .nodeify(done);
        };
    // check that each layer is validated
    describe('simple broken test case', function() {
        beforeEach(preparePlugin);

        it('should validate each layer', function(done) {
            var validated = {};

            plugin.validateLayer = id => {
                validated[id] = true;
            };
            plugin.main(err => {
                expect(err).to.equal(null);
                expect(Object.keys(validated).length).to.equal(5);
                done();
            });
        });

        // check that errors are returned in the message
        it('should return two error messages', function(done) {
            plugin.validateLayer = (id, code) => {
                if (code.indexOf('Linear()') === -1) {
                    return null;
                } else {  // error!
                    return {
                        id: id,
                        msg: 'invalid args'
                    };
                }
            };
            plugin.main((err, result) => {
                var invalidLayers = result.messages[0].message.errors.map(msg => msg.id);
                expect(invalidLayers.length).to.equal(2);
                done();
            });
        });

        describe('w/o torch support', function() {
            before(function(done) {
                preparePlugin(() => {
                    plugin.setTorchInstalled(false);
                    done();
                });
            });

            after(() => plugin.setTorchInstalled(true));

            it('should return "null" for messages', function(done) {
                plugin.main((err, result) => {
                    var errors = result.messages[0].message.errors;
                    expect(errors).to.equal(null);
                    done();
                });
            });
        });
    });
});
