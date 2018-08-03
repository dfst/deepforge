'use strict';
const testFixture = require('../../../globals');

describe('ApplyUpdates', function () {
    const Updates = testFixture.requirejs('deepforge/updates/Updates');
    var gmeConfig = testFixture.getGmeConfig(),
        expect = testFixture.expect,
        Q = testFixture.Q,
        logger = testFixture.logger.fork('ApplyUpdates'),
        PluginCliManager = testFixture.WebGME.PluginCliManager,
        projectName = 'testProject',
        pluginName = 'ApplyUpdates',
        project,
        gmeAuth,
        storage,
        commitHash;

    const manager = new PluginCliManager(null, logger, gmeConfig);

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

    it('should run plugin and not update the branch if no updates', function (done) {
        const pluginConfig = {};
        const context = {
            project: project,
            commitHash: commitHash,
            branchName: 'test',
            activeNode: '/',
        };

        manager.executePlugin(pluginName, pluginConfig, context, function (err, pluginResult) {
            try {
                expect(err).to.equal(null);
                expect(typeof pluginResult).to.equal('object');
                expect(pluginResult.success).to.equal(true);
            } catch (e) {
                done(e);
                return;
            }

            project.getBranchHash('test')
                .then(function (branchHash) {
                    expect(branchHash).to.equal(commitHash);
                })
                .nodeify(done);
        });
    });

    describe('CustomUtilities', function() {
        let plugin = null;
        let context = null;

        before(async () => {
            context = {
                project: project,
                commitHash: commitHash,
                branchName: 'test',
                activeNode: '/',
            };

            plugin = await manager.initializePlugin(pluginName);
            await manager.configurePlugin(plugin, {}, context);
        });

        it('should add MyUtilities on update', async function() {
            const pluginConfig = {
                updates: ['CustomUtilities']
            };

            const result = await Q.ninvoke(manager, 'executePlugin', pluginName, pluginConfig, context);
            // Check that it now has MyUtilities
            const update = await Updates.getUpdate('CustomUtilities');
            const {core, rootNode} = plugin;
            const isNeeded = await update.isNeeded(core, rootNode);
        });
    });
});
