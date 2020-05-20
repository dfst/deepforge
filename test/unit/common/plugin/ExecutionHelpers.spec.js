describe('ExecutionHelpers', function() {
    const testFixture = require('../../../globals');
    const ExecutionHelpers = testFixture.requirejs('deepforge/plugin/ExecutionHelpers');
    const gmeConfig = testFixture.getGmeConfig();
    const logger = testFixture.logger.fork('ExecutionHelpers');
    let project,
        gmeAuth,
        storage,
        commitHash;

    before(async function () {
        const projectName = 'testProject';
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

    const createPlugin = async function(nodeId = '/f/h') {
        var context = {
            project: project,
            commitHash: commitHash,
            namespace: 'pipeline',
            branchName: 'test',
            activeNode: nodeId
        };

        const pluginName = 'CreateExecution';
        const PluginCliManager = testFixture.WebGME.PluginCliManager;
        const manager = new PluginCliManager(null, logger, gmeConfig);
        const plugin = await manager.initializePlugin(pluginName);
        await manager.configurePlugin(plugin, {}, context);
        return plugin;
    };

    describe('snapshotOperation', function() {
        let helpers, activeNode, META;
        before(async () => {
            const plugin = await createPlugin();
            const {core, rootNode} = plugin;
            activeNode = plugin.activeNode;
            META = plugin.META;
            helpers = new ExecutionHelpers(core, rootNode);
        });

        it('should be able to snapshot node w/ unset ptr', async () => {
            const {core, rootNode} = helpers;
            const helloWorldNode = await core.loadByPath(rootNode, '/f/h/d');
            core.setPointerMetaLimits(helloWorldNode, 'testPtr', 1, 1);
            core.setPointerMetaTarget(helloWorldNode, 'testPtr', META.Job, 1, 1);

            await helpers.snapshotOperation(helloWorldNode, activeNode);
        });
    });

});
