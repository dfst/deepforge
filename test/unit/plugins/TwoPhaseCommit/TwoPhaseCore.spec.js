/*eslint-env node, mocha*/

describe('TwoPhaseCore', function() {
    const path = require('path');
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

        const projectSeed = path.join(testFixture.DF_SEED_DIR, 'devProject', 'devProject.webgmex');
        const importParam = {
            projectSeed,
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
            it('should get pointer path for newly created node w/ staged changes', async function() {
                const {META, rootNode, core} = plugin;
                core.getStagedChanges();
                const base = META.FCO;
                const parent = rootNode;
                const newNode = core.createNode({base, parent});
                core.setPointer(newNode, 'test', base);

                const baseId = core.getPointerPath(newNode, 'test');
                assert.equal(baseId, core.getPath(base));
            });

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

        describe('getValidAttributeNames', function() {
            it('should get names for existing node', async function() {
                const {META, rootNode, core} = plugin;
                const base = META['pipeline.Operation'];
                const parent = rootNode;
                const newNode = core.unwrap().createNode({base, parent});

                const names = core.getValidAttributeNames(newNode);
                assert(names.includes('code'));
            });

            it('should get names for new node', async function() {
                const {META, rootNode, core} = plugin;
                const base = META['pipeline.Operation'];
                const parent = rootNode;
                const newNode = core.createNode({base, parent});

                const names = core.getValidAttributeNames(newNode);
                assert(names.includes('code'));
            });
        });

        describe('getValidPointerNames', function() {
            it('should get names for existing node', async function() {
                const {META, rootNode, core} = plugin;
                const base = META['pipeline.Transporter'];
                const parent = rootNode;
                const newNode = core.unwrap().createNode({base, parent});

                const names = core.getValidPointerNames(newNode);
                assert(names.includes('src'));
            });

            it('should get names for new node', async function() {
                const {META, rootNode, core} = plugin;
                const base = META['pipeline.Transporter'];
                const parent = rootNode;
                const newNode = core.createNode({base, parent});

                const names = core.getValidPointerNames(newNode);
                assert(names.includes('src'));
            });
        });

        describe('getParent', function() {
            it('should getParent of existing node', function() {
                const {META, rootNode, core} = plugin;
                const base = META.FCO;
                const parent = core.getParent(base);

                assert.equal(parent, rootNode);
            });

            it('should getParent of new node', function() {
                const {META, rootNode, core} = plugin;
                const {FCO} = META;
                const parent = rootNode;
                const newNode = core.createNode({base: FCO, parent});

                assert.equal(core.getParent(newNode), parent);
            });
        });

        describe('getAllMetaNodes', function() {
            it('should getAllMetaNodes from existing node', function() {
                const {META, core} = plugin;
                const base = META.FCO;
                const metaDict = core.getAllMetaNodes(base);

                assert(metaDict);
            });

            it('should getAllMetaNodes from new node', function() {
                const {META, rootNode, core} = plugin;
                const {FCO} = META;
                const parent = rootNode;
                const newNode = core.createNode({base: FCO, parent});

                assert(core.getAllMetaNodes(newNode));
            });
        });

        describe('copyNode', function() {
            it('should copy existing node', function() {
                const {META, core, rootNode} = plugin;
                const node = META['pipeline.Operation'];
                const newNode = core.copyNode(node, rootNode);

                assert(newNode);
            });

            it('should copy new node', function() {
                const {META, rootNode, core} = plugin;
                const {FCO} = META;
                const parent = rootNode;
                const newNode = core.createNode({base: FCO, parent});
                const copy = core.copyNode(newNode, rootNode);

                assert(copy);
            });

            it('should get attribute from copy of new node', function() {
                const {META, rootNode, core} = plugin;
                const {FCO} = META;
                const parent = rootNode;
                const newNode = core.createNode({base: FCO, parent});
                core.setAttribute(newNode, 'name', 'newName!');
                const copy = core.copyNode(newNode, rootNode);

                assert.equal(
                    core.getAttribute(copy, 'name'),
                    'newName!'
                );
            });

            it('should include added attributes in copy', function() {
                const {META, rootNode, core} = plugin;
                const {FCO} = META;
                const parent = rootNode;
                const newNode = core.unwrap().createNode({base: FCO, parent});
                core.setAttribute(newNode, 'name', 'newName!');
                const copy = core.copyNode(newNode, rootNode);

                assert.equal(
                    core.getAttribute(copy, 'name'),
                    'newName!'
                );
            });

            it('should get updated attribute in copy', function() {
                const {META, rootNode, core} = plugin;
                const {FCO} = META;
                const parent = rootNode;
                const newNode = core.unwrap().createNode({base: FCO, parent});
                const copy = core.copyNode(newNode, rootNode);
                core.setAttribute(copy, 'name', 'newName!');

                assert.equal(
                    core.getAttribute(copy, 'name'),
                    'newName!'
                );
            });

            it('should not include later attributes in copy', function() {
                const {META, rootNode, core} = plugin;
                const {FCO} = META;
                const parent = rootNode;
                const newNode = core.unwrap().createNode({base: FCO, parent});
                const copy = core.copyNode(newNode, rootNode);
                core.setAttribute(newNode, 'name', 'newName!');

                assert.notEqual(
                    core.getAttribute(copy, 'name'),
                    'newName!'
                );
            });

            it('should set correct base in copied node', function() {
                const {META, rootNode, core} = plugin;
                const {FCO} = META;
                const parent = rootNode;
                const newNode = core.unwrap().createNode({base: FCO, parent});
                const copy = core.copyNode(newNode, rootNode);

                assert.equal(
                    core.getPath(core.getBase(copy)),
                    core.getPath(FCO)
                );
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
            await assert.rejects(() => plugin.core.loadChildren(invalidNode));
        });

        it('should check base node type on isTypeOf', async function() {
            const {rootNode} = plugin;
            const invalidNode = {relid: 'h'};
            assert.throws(() => plugin.core.isTypeOf(rootNode, invalidNode));
        });

        it('should have meaningful error on null node', async function() {
            assert.throws(
                () => plugin.core.getAttribute(null, 'name'),
                /Expected node but found/
            );
        });
    });
});
