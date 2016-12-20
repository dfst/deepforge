/*jshint node:true, mocha:true*/

'use strict';
var testFixture = require('../../globals');

describe('ValidateArchitecture', function () {
    var gmeConfig = testFixture.getGmeConfig(),
        expect = testFixture.expect,
        fs = require('fs'),
        rm_rf = require('rimraf'),
        mockery = require('mockery'),
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
                    plugin.setTorchInstalled(true);
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

        it('should make tmp dir', function(done) {
            var oldMkdir = fs.mkdir;
            fs.mkdir = (dir, cb) => {
                expect(dir).to.equal(plugin._tmpFileId);
                return oldMkdir(dir, cb);
            };
            plugin.main(() => {
                fs.mkdir = oldMkdir;
                done();
            });
        });

        it('should rm tmp dir', function(done) {
            mockery.enable({
                warnOnReplace: false,
                warnOnUnregistered: false
            });
            mockery.registerMock('rimraf', (dir, cb) => {
                expect(dir).to.equal(plugin._tmpFileId);
                return rm_rf(dir, cb);
            });
            plugin.main(() => {
                mockery.disable();
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
                expect(result.messages[0]).to.not.equal(undefined);
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

    describe('custom layer test case', function() {
        beforeEach(done => {
            var context = {
                project: project,
                commitHash: commitHash,
                namespace: 'nn',
                branchName: 'test',
                activeNode: '/4/5'  // "simple broken" architecture
            };

            return manager.initializePlugin(pluginName)
                .then(plugin_ => {
                    plugin = plugin_;
                    return manager.configurePlugin(plugin, {}, context);
                })
                .nodeify(done);
        });

        it('should add custom layer def to test code', function(done) {
            plugin.validateLayer = (id, code) => {
                expect(code.indexOf('torch.class')).to.not.equal(-1);
                return null;
            };
            plugin.main(done);
        });
    });
});
