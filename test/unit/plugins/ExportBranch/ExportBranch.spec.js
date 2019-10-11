/*eslint-env node, mocha*/

describe('ExportBranch', function () {
    const assert = require('assert');
    const testFixture = require('../../../globals');
    const gmeConfig = testFixture.getGmeConfig();
    const {Q, expect} = testFixture;
    const logger = testFixture.logger.fork('ExportBranch');
    const PluginCliManager = testFixture.WebGME.PluginCliManager;
    const manager = new PluginCliManager(null, logger, gmeConfig);
    const projectName = 'testProject';
    const pluginName = 'ExportBranch';
    const context = {
        project: null,
        commitHash: null,
        branchName: 'test',
        activeNode: '/1',
    };
    let gmeAuth,
        storage;

    before(async function () {
        gmeAuth = await testFixture.clearDBAndGetGMEAuth(gmeConfig, projectName);
        storage = testFixture.getMemoryStorage(logger, gmeConfig, gmeAuth);
        await storage.openDatabase();
        const importParam = {
            projectSeed: testFixture.path.join(testFixture.SEED_DIR, 'EmptyProject.webgmex'),
            projectName: projectName,
            branchName: 'master',
            logger: logger,
            gmeConfig: gmeConfig
        };

        const importResult = await testFixture.importProject(storage, importParam);
        const {project, commitHash} = importResult;
        context.project = project;
        context.commitHash = commitHash;
        await project.createBranch('test', commitHash);
    });

    after(async function () {
        await storage.closeDatabase();
        await gmeAuth.unload();
    });

    describe('basic tests', function() {
        let pluginResult;

        before(async () => {
            const pluginConfig = {};
            pluginResult = await Q.ninvoke(manager, 'executePlugin', pluginName, pluginConfig, context);
        });

        it('should exit successfully', async function () {
            expect(typeof pluginResult).to.equal('object');
            expect(pluginResult.success).to.equal(true);
        });

        it('should generate one artifact (webgmex file)', async function () {
            expect(pluginResult.artifacts.length).to.equal(1);
        });

        it('should not update the branch', async function () {
            const {project, commitHash} = context;
            const branchHash = await project.getBranchHash('test');
            expect(branchHash).to.equal(commitHash);
        });
    });

    describe('hash detection', function() {
        let hashes;
        const gmeDataInfo = {backend: 'gme', data: '123'};
        const otherDataInfo = {backend: 'none', data: 'abc'};

        before(async () => {
            const plugin = await manager.initializePlugin(pluginName);
            await manager.configurePlugin(plugin, {}, context);
            const {core} = plugin;
            const [node] = await core.loadChildren(plugin.rootNode);

            core.setAttributeMeta(node, 'data', {type: 'userAsset'});
            core.setAttributeMeta(node, 'bad_data', {type: 'userAsset'});
            core.setAttribute(node, 'data', JSON.stringify(gmeDataInfo));
            core.setAttribute(node, 'bad_data', JSON.stringify(otherDataInfo));

            hashes = await plugin.getUserAssetHashes();
        });

        it('should detect (gme) userAssets in the project', function () {
            assert(hashes.includes(gmeDataInfo.data), 'Did not export gme userAssets.');
        });

        it('should ignore non-gme userAssets in the project', function () {
            assert(!hashes.includes(otherDataInfo.data), 'Exported non-gme userAssets.');
        });
    });
});
