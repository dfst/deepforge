/*jshint node:true, mocha:true*/
/**
 * Generated by PluginGenerator 1.7.0 from webgme on Tue Jun 07 2016 11:25:09 GMT-0500 (CDT).
 */

'use strict';
var testFixture = require('../../globals');

describe.skip('ImportArtifact', function () {
    var gmeConfig = testFixture.getGmeConfig(),
        expect = testFixture.expect,
        logger = testFixture.logger.fork('ImportArtifact'),
        PluginCliManager = testFixture.WebGME.PluginCliManager,
        projectName = 'testProject',
        pluginName = 'ImportArtifact',
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
                    projectSeed: testFixture.path.join(testFixture.SEED_DIR, 'EmptyProject.webgmex'),
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

    it('should run plugin and update the branch', function (done) {
        var manager = new PluginCliManager(null, logger, gmeConfig),
            pluginConfig = {
            },
            context = {
                project: project,
                commitHash: commitHash,
                branchName: 'test',
                activeNode: '/960660211',
            };

        manager.executePlugin(pluginName, pluginConfig, context, function (err, pluginResult) {
            expect(err).to.equal(null);
            expect(typeof pluginResult).to.equal('object');
            expect(pluginResult.success).to.equal(true);

            project.getBranchHash('test')
                .then(function (branchHash) {
                    expect(branchHash).to.not.equal(commitHash);
                })
                .nodeify(done);
        });
    });
});