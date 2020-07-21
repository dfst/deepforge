/*jshint node:true, mocha:true*/

describe('CreateExecution', function () {
    const testFixture = require('../../../globals');
    const assert = require('assert');
    var gmeConfig = testFixture.getGmeConfig(),
        logger = testFixture.logger.fork('CreateExecution'),
        PluginCliManager = testFixture.WebGME.PluginCliManager,
        manager = new PluginCliManager(null, logger, gmeConfig),
        projectName = 'testProject',
        pluginName = 'CreateExecution',
        project,
        gmeAuth,
        storage,
        commitHash;

    before(async function () {
        gmeAuth = await testFixture.clearDBAndGetGMEAuth(gmeConfig, projectName);
        storage = testFixture.getMemoryStorage(logger, gmeConfig, gmeAuth);
        await storage.openDatabase();
        const importParam = {
            projectSeed: testFixture.path.join(testFixture.DF_SEED_DIR, 'devProject', 'devProject.webgmex'),
            projectName: projectName,
            branchName: 'master',
            logger: logger,
            gmeConfig: gmeConfig
        };

        const importResult = await testFixture.importProject(storage, importParam);
        project = importResult.project;
        commitHash = importResult.commitHash;
        await project.createBranch('test', commitHash);
    });

    after(async function () {
        await storage.closeDatabase();
        await gmeAuth.unload();
    });

    const preparePlugin = async function(nodeId = '/f/h') {
        var context = {
            project: project,
            commitHash: commitHash,
            namespace: 'pipeline',
            branchName: 'test',
            activeNode: nodeId
        };

        const plugin = await manager.initializePlugin(pluginName);
        await manager.configurePlugin(plugin, {}, context);
        return plugin;
    };

    describe('getUniqueExecName', function() {
        let plugin;

        before(async () => plugin = await preparePlugin());

        it('should trim whitespace', async function() {
            const originalName = '   abc   ';
            const name = await plugin.getUniqueExecName(originalName);
            assert.equal(name, originalName.trim());
        });

        it('should replace whitespace with _', async function() {
            const originalName = 'a b c';

            const name = await plugin.getUniqueExecName(originalName);
            assert.equal(name, 'a_b_c');
        });

    });
});
