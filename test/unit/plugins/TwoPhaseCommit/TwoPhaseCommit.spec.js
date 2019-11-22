/*eslint-env node, mocha*/

describe('TwoPhaseCommit', function() {
    const testFixture = require('../../../globals');
    const assert = require('assert');
    const gmeConfig = testFixture.getGmeConfig();
    const {Q, expect} = testFixture;
    const logger = testFixture.logger.fork('TwoPhaseCommit');
    const PluginCliManager = testFixture.WebGME.PluginCliManager;
    const manager = new PluginCliManager(null, logger, gmeConfig);
    const projectName = 'testProject';
    const pluginName = 'TwoPhaseCommit';
    const TwoPhaseCommit = testFixture.requirejs(`plugin/${pluginName}/${pluginName}/${pluginName}`);
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

    it('should not be able to invoke the plugin directly', async function() {
        try {
            await manager.runPluginMain(plugin);
            throw new Error('Plugin did not throw error...');
        } catch (err) {
            expect(err.message).to.equal(TwoPhaseCommit.INVOKE_ERR);
        }
    });

    async function loadRootNode(context) {
        const branchHash = await project.getBranchHash(context.branchName);
        const commit = await Q.ninvoke(project, 'loadObject', branchHash);
        return await Q.ninvoke(plugin.core, 'loadRoot', commit.root);
    }

    describe('create nodes', function() {
        it('should be able to create nodes', async function() {
            plugin.main = async function(callback) {
                this.core.createNode({base: this.META.FCO, parent: this.rootNode});
                await this.save('Test save...');
                this.result.setSuccess(true);
                return callback(null, this.result);
            };
            await manager.runPluginMain(plugin);

            const root = await loadRootNode(context);
            const children = await plugin.core.loadChildren(root);
            assert.equal(children.length, 2);
        });

        it('should be able to create nodes in created nodes', async function() {
            plugin.main = async function(callback) {
                const base = this.META.FCO;
                const parent = this.rootNode;
                const newNode = this.core.createNode({base, parent});
                this.core.createNode({base, parent: newNode});
                await this.save('Test save...');
                this.result.setSuccess(true);
                return callback(null, this.result);
            };
            await manager.runPluginMain(plugin);

            const root = await loadRootNode(context);
            const children = await plugin.core.loadChildren(root);
            assert.equal(children.length, 2, 'First node not created');
            const newNode = children.find(child => plugin.core.getPath(child) !== '/1');
            assert(!!newNode, 'Could not find first node.');

            const containedNodes = await plugin.core.loadChildren(newNode);
            assert.equal(containedNodes.length, 1, 'Contained node not found.');
        });
    });

    describe('editing nodes', function() {
        it('should be able to setPointer btwn existing nodes', async function() {
            plugin.main = async function(callback) {
                this.core.setPointer(this.activeNode, 'root', this.rootNode);
                await this.save('Test save...');
                this.result.setSuccess(true);
                return callback(null, this.result);
            };
            await manager.runPluginMain(plugin);

            const root = await loadRootNode(context);
            const fco = await plugin.core.loadByPath(root, '/1');
            const ptrPath = plugin.core.getPointerPath(fco, 'root');
            assert.equal(plugin.core.getPath(root), ptrPath, 'Pointer not set to root node.');
        });

        it('should be able to setPointer on new node', async function() {
            let newNodePath = null;
            plugin.main = async function(callback) {
                const base = this.META.FCO;
                const parent = this.rootNode;
                const newNode = this.core.createNode({base, parent});
                this.core.setPointer(newNode, 'root', this.rootNode);
                await this.save('Test save...');
                newNodePath = this.core.getPath(await newNode.toGMENode(this.rootNode, this.core));
                this.result.setSuccess(true);
                return callback(null, this.result);
            };
            await manager.runPluginMain(plugin);

            const root = await loadRootNode(context);
            const newNode = await plugin.core.loadByPath(root, newNodePath);
            const ptrPath = plugin.core.getPointerPath(newNode, 'root');
            assert.equal(plugin.core.getPath(root), ptrPath, 'Pointer not set to root node.');
        });

        it('should be able to setPointer to new node', async function() {
            let newNodePath = null;
            plugin.main = async function(callback) {
                const base = this.META.FCO;
                const parent = this.rootNode;
                const newNode = this.core.createNode({base, parent});
                this.core.setPointer(this.activeNode, 'newNode', newNode);
                await this.save('Test save...');
                newNodePath = this.core.getPath(await newNode.toGMENode(this.rootNode, this.core));
                this.result.setSuccess(true);
                return callback(null, this.result);
            };
            await manager.runPluginMain(plugin);

            const root = await loadRootNode(context);
            const fco = await plugin.core.loadByPath(root, '/1');
            const ptrPath = plugin.core.getPointerPath(fco, 'newNode');
            assert.equal(newNodePath, ptrPath, 'Pointer not set to new node.');
        });

        it('should be able to setPointer btwn new nodes', async function() {
            let newNodePath = null;
            let targetPath = null;
            plugin.main = async function(callback) {
                const base = this.META.FCO;
                const parent = this.rootNode;
                const newNode = this.core.createNode({base, parent});
                const target = this.core.createNode({base, parent});
                this.core.setPointer(newNode, 'somePointer', target);
                await this.save('Test save...');
                newNodePath = this.core.getPath(await newNode.toGMENode(this.rootNode, this.core));
                targetPath = this.core.getPath(await target.toGMENode(this.rootNode, this.core));
                this.result.setSuccess(true);
                return callback(null, this.result);
            };
            await manager.runPluginMain(plugin);

            const root = await loadRootNode(context);
            const newNode = await plugin.core.loadByPath(root, newNodePath);
            const ptrPath = plugin.core.getPointerPath(newNode, 'somePointer');
            assert.equal(targetPath, ptrPath, `Pointer not set to new node: ${ptrPath}`);
        });

        it('should be able to setAttribute on existing nodes', async function() {
            plugin.main = async function(callback) {
                this.core.setAttribute(this.rootNode, 'name', 'hello');
                await this.save('Test save...');
                this.result.setSuccess(true);
                return callback(null, this.result);
            };
            await manager.runPluginMain(plugin);

            const root = await loadRootNode(context);
            assert.equal(plugin.core.unwrap().getAttribute(root, 'name'), 'hello');
        });

        it('should be able to setAttribute on newly created nodes', async function() {
            plugin.main = async function(callback) {
                const base = this.META.FCO;
                const parent = this.rootNode;
                const newNode = this.core.createNode({base, parent});
                this.core.setAttribute(newNode, 'name', 'hello');
                await this.save('Test save...');
                this.result.setSuccess(true);
                return callback(null, this.result);
            };
            await manager.runPluginMain(plugin);

            const root = await loadRootNode(context);
            const children = await plugin.core.loadChildren(root);
            const helloNode = children
                .find(node => plugin.core.unwrap().getAttribute(node, 'name') === 'hello');

            assert(helloNode, 'Could not find node with name "hello"');
        });

        it('should throw error if setAttribute to undefined value', async function() {
            plugin.main = async function(callback) {
                try {
                    this.core.setAttribute(this.rootNode, 'name', undefined);
                    await this.save('Test save...');
                    this.result.setSuccess(true);
                    return callback(null, this.result);
                } catch (err) {
                    return callback(err, this.result);
                }
            };
            try {
                await manager.runPluginMain(plugin);
                throw new Error('Expected plugin to throw exception');
            } catch (err) {
                assert(err.message.includes('Cannot set attribute to undefined value'));
            }
        });

        it('should setPointer to version of node in current commit', async function() {
            plugin.main = async function(callback) {
                const oldNode = this.activeNode;
                this.core.setAttribute(this.activeNode, 'name', 'hello');
                await this.save('Test save...');

                this.core.setPointer(this.activeNode, 'test', oldNode);
                await this.save('Test save...');
                this.result.setSuccess(true);
                return callback(null, this.result);
            };
            await manager.runPluginMain(plugin);
        });

        it('should get attribute inherited from existing', async function() {
            plugin.main = async function(callback) {
                const node = this.core.createNode({base: this.META.FCO, parent: this.rootNode});
                assert.equal(this.core.getAttribute(node, 'name'), 'FCO');
                this.result.setSuccess(true);
                return callback(null, this.result);
            };

            await manager.runPluginMain(plugin);
        });

        it.skip('should get attribute inherited from staged', async function() {
            plugin.main = async function(callback) {
                const base = this.core.createNode({base: this.META.FCO, parent: this.rootNode});
                this.core.setAttribute(base, 'name', 'hello');
                const node = this.core.createNode({base, parent: this.rootNode});
                assert.equal(this.core.getAttribute(node, 'name'), 'hello');
                this.result.setSuccess(true);
                return callback(null, this.result);
            };

            await manager.runPluginMain(plugin);
        });
    });

    describe('deletion', function() {
        it('should be able to delete nodes', async function() {
            plugin.main = async function(callback) {
                // Create a new node to delete...
                const base = this.META.FCO;
                const parent = this.rootNode;
                this.core.createNode({base, parent});
                await this.save('Test save...');
                const newNode = (await this.core.loadChildren(this.rootNode))
                    .find(node => this.core.getPath(node) !== '/1');

                // Test deletion
                this.core.deleteNode(newNode);

                await this.save('Test save...');
                this.result.setSuccess(true);
                return callback(null, this.result);
            };
            await manager.runPluginMain(plugin);

            const root = await loadRootNode(context);
            const children = await plugin.core.loadChildren(root);
            assert.equal(children.length, 1);
        });

        it('should be able to delete newly created nodes', async function() {
            plugin.main = async function(callback) {
                const base = this.META.FCO;
                const parent = this.rootNode;
                const newNode = this.core.createNode({base, parent});
                this.core.deleteNode(newNode);
                await this.save('Test save...');
                this.result.setSuccess(true);
                return callback(null, this.result);
            };
            await manager.runPluginMain(plugin);

            const root = await loadRootNode(context);
            const children = await plugin.core.loadChildren(root);
            assert.equal(children.length, 1);
        });

        it('should be able to delete using created node', async function() {
            plugin.main = async function(callback) {
                const base = this.META.FCO;
                const parent = this.rootNode;
                const newNode = this.core.createNode({base, parent});
                await this.save('Test save...');
                this.core.deleteNode(newNode);  // newNode is currently incorrect...
                await this.save('Test save...');
                this.result.setSuccess(true);
                return callback(null, this.result);
            };
            await manager.runPluginMain(plugin);

            const root = await loadRootNode(context);
            const children = await plugin.core.loadChildren(root);
            assert.equal(children.length, 1);
        });
    });

    describe('reading capabilities', function() {
        it('should include unsaved changes', async function() {
            plugin.main = async function(callback) {
                this.core.setAttribute(this.rootNode, 'name', 'hello');
                const name = this.core.getAttribute(this.rootNode, 'name');
                assert.equal(name, 'hello');
                this.result.setSuccess(true);
                return callback(null, this.result);
            };
            await manager.runPluginMain(plugin);

            const root = await loadRootNode(context);
            assert.notEqual(plugin.core.unwrap().getAttribute(root, 'name'), 'hello');
        });

        it('should include staged changes', async function() {
            plugin.main = async function(callback) {
                this.core.setAttribute(this.rootNode, 'name', 'hello');
                const save = this.save('Saving...');
                const name = this.core.getAttribute(this.rootNode, 'name');
                assert.equal(name, 'hello');
                this.result.setSuccess(true);
                await save;
                return callback(null, this.result);
            };
            await manager.runPluginMain(plugin);
        });

        it('should include unsaved changes to new nodes', async function() {
            plugin.main = async function(callback) {
                const base = this.META.FCO;
                const parent = this.rootNode;
                const newNode = this.core.createNode({base, parent});
                this.core.setAttribute(newNode, 'name', 'hello');
                const name = this.core.getAttribute(newNode, 'name');
                assert.equal(name, 'hello');
                this.result.setSuccess(true);
                return callback(null, this.result);
            };
            await manager.runPluginMain(plugin);

            const root = await loadRootNode(context);
            const core = plugin.core.unwrap();
            const childNames = (await core.loadChildren(root))
                .map(child => core.getAttribute(child, 'name'));

            assert(!childNames.includes('hello'));
        });

        it('should include new nodes in loadChildren', async function() {
            plugin.main = async function(callback) {
                const base = this.META.FCO;
                const parent = this.rootNode;
                const newNode = this.core.createNode({base, parent});
                this.core.setAttribute(newNode, 'name', 'NEW NODE');
                const children = await this.core.loadChildren(this.rootNode);
                assert.equal(children.length, 2, 'Did not include new node in loadChildren');
                this.result.setSuccess(true);
                return callback(null, this.result);
            };
            await manager.runPluginMain(plugin);

            const root = await loadRootNode(context);
            const core = plugin.core.unwrap();
            const children = (await core.loadChildren(root));

            assert.equal(children.length, 1);
        });

        it('should include loadChildren from newNodes', async function() {
            plugin.main = async function(callback) {
                const base = this.META.FCO;
                const parent = this.rootNode;
                const newNode = this.core.createNode({base, parent});
                /*const anotherNode = */this.core.createNode({base, parent: newNode});
                const children = await this.core.loadChildren(newNode);
                assert.equal(children.length, 1, 'Did not include new node in loadChildren');
                this.result.setSuccess(true);
                return callback(null, this.result);
            };
            await manager.runPluginMain(plugin);

            const root = await loadRootNode(context);
            const children = (await plugin.core.unwrap().loadChildren(root));

            assert.equal(children.length, 1);
        });
    });

    describe('cached nodes', function() {
        it('should update registered cached nodes', async function() {
            plugin.getNodeCaches = function() {
                const caches = TwoPhaseCommit.prototype.getNodeCaches.call(this);
                return caches.concat([this.customCache]);
            };

            plugin.main = async function(callback) {
                this.customCache = {};
                this.customCache['hi'] = this.rootNode;

                const oldRoot = this.rootNode;
                this.core.setAttribute(this.rootNode, 'name', 'hello');
                await this.save('Test save...');

                assert.notEqual(oldRoot, this.rootNode, 'this.rootNode not updated');
                assert.equal(this.customCache['hi'], this.rootNode, 'Custom cache values not updated.');
                this.result.setSuccess(true);
                return callback(null, this.result);
            };
            await manager.runPluginMain(plugin);

            const root = await loadRootNode(context);
            assert.equal(plugin.core.unwrap().getAttribute(root, 'name'), 'hello');
        });

        it('should update create nodes', async function() {
            plugin.getNodeCaches = function() {
                const caches = TwoPhaseCommit.prototype.getNodeCaches.call(this);
                return caches.concat([this.customCache]);
            };

            plugin.main = async function(callback) {
                this.customCache = {};
                const base = this.META.FCO;
                const parent = this.rootNode;
                const oldNode = this.core.createNode({base, parent});
                this.customCache['hi'] = oldNode;

                await this.save('Test save...');

                assert.notEqual(this.customCache['hi'], oldNode, 'Custom cache value not updated.');
                this.result.setSuccess(true);
                return callback(null, this.result);
            };
            await manager.runPluginMain(plugin);

            const root = await loadRootNode(context);
            const children = await plugin.core.unwrap().loadChildren(root);
            assert.equal(children.length, 2);
        });
    });

    describe('while saving', function() {
        it('should be able to edit nodes', async function() {
            plugin.main = async function(callback) {
                const base = this.META.FCO;
                const parent = this.rootNode;
                this.core.createNode({base, parent});
                this.save('Test save...');
                this.core.setAttribute(this.rootNode, 'name', 'hello');
                await this.save('Test save...');
                this.result.setSuccess(true);
                return callback(null, this.result);
            };
            await manager.runPluginMain(plugin);

            const root = await loadRootNode(context);
            assert.equal(plugin.core.getAttribute(root, 'name'), 'hello');
        });

        it('should only save existing edits before save', async function() {
            plugin.main = async function(callback) {
                const base = this.META.FCO;
                const parent = this.rootNode;
                this.core.createNode({base, parent});
                const save = this.save('Test save...');
                this.core.setAttribute(this.rootNode, 'name', 'hello');
                this.result.setSuccess(true);
                await save;
                return callback(null, this.result);
            };
            await manager.runPluginMain(plugin);

            const root = await loadRootNode(context);
            const core = plugin.core.unwrap();
            assert.notEqual(core.getAttribute(root, 'name'), 'hello');
        });

        it('should not include unsaved edits to new nodes', async function() {
            plugin.main = async function(callback) {
                const base = this.META.FCO;
                const parent = this.rootNode;
                const newNode = this.core.createNode({base, parent});
                this.core.setAttribute(newNode, 'name', 'hello');

                const save = this.save('Test save...');

                const notSaved = this.core.createNode({base, parent});
                this.core.setAttribute(notSaved, 'name', 'goodbye');

                this.result.setSuccess(true);
                await save;
                return callback(null, this.result);
            };
            await manager.runPluginMain(plugin);

            const root = await loadRootNode(context);
            const core = plugin.core.unwrap();
            const childNames = (await core.loadChildren(root))
                .map(child => core.getAttribute(child, 'name'));

            assert(childNames.includes('hello'), 'Missing created node.');
            assert(!childNames.includes('goodbye'), 'Included node created after save.');
        });
    });
});
