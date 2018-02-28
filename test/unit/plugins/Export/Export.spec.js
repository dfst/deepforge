/*jshint node:true, mocha:true*/

'use strict';
describe('Export', function () {
    var testFixture = require('../../../globals'),
        path = testFixture.path,
        assert = require('assert'),
        SEED_DIR = path.join(testFixture.DF_SEED_DIR, 'devProject'),
        gmeConfig = testFixture.getGmeConfig(),
        expect = testFixture.expect,
        logger = testFixture.logger.fork('Export'),
        PluginCliManager = testFixture.WebGME.PluginCliManager,
        manager = new PluginCliManager(null, logger, gmeConfig),
        BlobClient = require('webgme-engine/src/server/middleware/blob/BlobClientWithFSBackend'),
        projectName = 'testProject',
        pluginName = 'Export',
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
                    projectSeed: path.join(SEED_DIR, 'devProject.webgmex'),
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

    it('should run plugin and NOT update the branch', function (done) {
        var pluginConfig = {},
            context = {
                namespace: 'pipeline',
                project: project,
                commitHash: commitHash,
                branchName: 'test',
                activeNode: '/f/s'
            };

        manager.executePlugin(pluginName, pluginConfig, context, function (err, pluginResult) {
            try {
                expect(err).to.equal(null);
                expect(typeof pluginResult).to.equal('object');
                expect(pluginResult.success).to.equal(true);

                project.getBranchHash('test')
                    .then(function (branchHash) {
                        expect(branchHash).to.equal(commitHash);
                    })
                    .nodeify(done);
            } catch (err) {
                done(err);
            }
        });
    });

    // TODO: Add test cases
});
