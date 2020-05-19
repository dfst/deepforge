/*eslint-env node, mocha*/

describe('TwoPhaseCore', function() {
    const testFixture = require('../../../globals');
    const assert = require('assert');
    const gmeConfig = testFixture.getGmeConfig();
    const logger = testFixture.logger.fork('TwoPhaseCommit');
    const PluginCliManager = testFixture.WebGME.PluginCliManager;
    const manager = new PluginCliManager(null, logger, gmeConfig);
    const projectName = 'testProject';
    const pluginName = 'TwoPhaseCommit';
    const {promisify} = require('util');
    manager.runPluginMain = promisify(manager.runPluginMain);

    let project,
        gmeAuth,
        storage,
        commitHash;

    before(async function() {
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
        project = importResult.project;
        commitHash = importResult.commitHash;
        await project.createBranch('test', commitHash);
    });

    after(async function() {
        await storage.closeDatabase();
        await gmeAuth.unload();
    });

    let plugin = null;
    let context = null;
    let count = 1;
    beforeEach(async function() {
        const config = {};
        context = {
            project: project,
            commitHash: commitHash,
            branchName: `test_${count++}`,
            activeNode: '/1',
        };
        await project.createBranch(context.branchName, commitHash);
        plugin = await manager.initializePlugin(pluginName);
        await manager.configurePlugin(plugin, config, context);
    });

    describe('functions', function() {
        describe('loadByPath', function() {
            it('should load newly created nodes', async function() {
                const {META, rootNode, core} = plugin;
                const base = META.FCO;
                const parent = rootNode;
                const newNode = core.createNode({base, parent});

                const nodeId = core.getPath(newNode);
                const fetchedNode = await core.loadByPath(rootNode, nodeId);
                assert.equal(fetchedNode, newNode);
            });

            it('should load existing nodes', async function() {
                const {META, rootNode, core} = plugin;
                const fco = META.FCO;
                const nodeId = core.getPath(fco);
                const fetchedNode = await core.loadByPath(rootNode, nodeId);
                assert.equal(fetchedNode, fco);
            });
        });

        describe('getMetaType', function() {
            it('should get meta of newly created nodes', async function() {
                const {META, rootNode, core} = plugin;
                const base = META.FCO;
                const parent = rootNode;
                const newNode = core.createNode({base, parent});

                const fetchedNode = core.getMetaType(newNode);
                assert.equal(fetchedNode, base);
            });

            it('should get meta of existing nodes', async function() {
                const {META, rootNode, core} = plugin;
                const base = META.FCO;
                const parent = rootNode;
                const newNode = core.unwrap().createNode({base, parent});

                const fetchedNode = await core.getMetaType(newNode);
                assert.equal(fetchedNode, base);
            });
        });

        describe('getPointerPath', function() {
            it('should get pointer path for newly created node', async function() {
                const {META, rootNode, core} = plugin;
                const base = META.FCO;
                const parent = rootNode;
                const newNode = core.createNode({base, parent});
                core.setPointer(newNode, 'test', base);

                const baseId = core.getPointerPath(newNode, 'test');
                assert.equal(baseId, core.getPath(base));
            });

            it('should get "base" pointer for newly created node', async function() {
                const {META, rootNode, core} = plugin;
                const base = META.FCO;
                const parent = rootNode;
                const newNode = core.createNode({base, parent});

                const baseId = core.getPointerPath(newNode, 'base');
                assert.equal(baseId, core.getPath(base));
            });

            it('should get pointer path for existing node', async function() {
                const {META, rootNode, core} = plugin;
                const base = META.FCO;
                const parent = rootNode;
                const newNode = core.unwrap().createNode({base, parent});

                const baseId = core.getPointerPath(newNode, 'base');
                assert.equal(baseId, core.getPath(base));
            });
        });
    });

    describe('argument validation', function() {
        const methods = [
            'getPath',
            'getBase',
            'setAttribute',
            'isTypeOf',
            'setPointer',
            'deleteNode',
            'delAttribute',
        ];

        methods.forEach(method => {
            it(`should check node types on ${method}`, function() {
                const invalidNode = {relid: 'h'};
                assert.throws(() => plugin.core[method](invalidNode));
            });
        });

        it('should check node types on loadChildren', async function() {
            const invalidNode = {relid: 'h'};
            try {
                await plugin.core.loadChildren(invalidNode);
                throw new Error('Did not throw exception.');
            } catch (err) {
            }
        });
    });
});
