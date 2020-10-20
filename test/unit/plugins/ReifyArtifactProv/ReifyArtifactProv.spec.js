/*eslint-env node, mocha*/

describe('ReifyArtifactProv', function () {
    const testFixture = require('../../../globals');
    const {promisify} = require('util');
    const gmeConfig = testFixture.getGmeConfig();
    const assert = require('assert');
    const logger = testFixture.logger.fork('ReifyArtifactProv');
    const PluginCliManager = testFixture.WebGME.PluginCliManager;
    const manager = new PluginCliManager(null, logger, gmeConfig);
    const projectName = 'testProject';
    const pluginName = 'ReifyArtifactProv';
    const PIPELINES = '/f';
    manager.executePlugin = promisify(manager.executePlugin);
    manager.runPluginMain = promisify(manager.runPluginMain);

    let gmeAuth,
        storage,
        context,
        pluginConfig;

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
        const {project, commitHash} = importResult;
        await project.createBranch('test', commitHash);
        pluginConfig = {
            artifactId: '/G/Z'
        };
        context = {
            project: project,
            commitHash: commitHash,
            branchName: 'test',
            activeNode: PIPELINES,
            namespace: 'pipeline',
        };

    });

    after(async function () {
        await storage.closeDatabase();
        await gmeAuth.unload();
    });

    describe('project edits', function() {
        it('should create new pipeline', async function () {
            const plugin = await manager.initializePlugin(pluginName);
            await manager.configurePlugin(plugin, pluginConfig, context);
            const {core, rootNode} = plugin;
            const pipelineDir = await core.loadByPath(rootNode, PIPELINES);
            const initialPipelineCount = core.getChildrenPaths(pipelineDir).length;

            const result = await manager.runPluginMain(plugin);
            const pipelineCount = core.getChildrenPaths(pipelineDir).length;
            assert(result.success);
            assert.equal(pipelineCount, initialPipelineCount + 1);
        });

        it('should preserve operation attributes', async function () {
            const plugin = await manager.initializePlugin(pluginName);
            await manager.configurePlugin(plugin, pluginConfig, context);
            const {core, rootNode} = plugin;
            const result = await manager.runPluginMain(plugin);

            const [{activeNode: newNode}] = result.messages;
            const pipeline = await core.loadByPath(rootNode, newNode.id);
            const numberOp = (await core.loadChildren(pipeline))
                .find(node => core.getAttribute(node, 'name') === 'Number');
            assert(
                core.getAttributeNames(numberOp).includes('number'),
                'Operation is missing "number" attribute'
            );
        });
    });

    describe('messages', function() {
        it('should create message for new node', async function () {
            const result = await manager.executePlugin(pluginName, pluginConfig, context);
            assert(result.success);
            assert(result.messages.length, 'No messages created');
            const [{activeNode: pipeline}] = result.messages;
            assert(
                pipeline.id.startsWith(PIPELINES),
                'Pipeline is not in pipelines directory'
            );
        });
    });
});
