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
                this.createNode('FCO', this.rootNode);
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
                const newNode = this.createNode('FCO', this.rootNode);
                this.createNode('FCO', newNode);
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
        it('should be able to edit existing nodes', async function() {
            plugin.main = async function(callback) {
                this.setAttribute(this.rootNode, 'name', 'hello');
                await this.save('Test save...');
                this.result.setSuccess(true);
                return callback(null, this.result);
            };
            await manager.runPluginMain(plugin);

            const root = await loadRootNode(context);
            assert.equal(plugin.core.getAttribute(root, 'name'), 'hello');
        });

        it('should be able to edit newly created nodes', async function() {
            plugin.main = async function(callback) {
                const newNode = this.createNode('FCO', this.rootNode);
                this.setAttribute(newNode, 'name', 'hello');
                await this.save('Test save...');
                this.result.setSuccess(true);
                return callback(null, this.result);
            };
            await manager.runPluginMain(plugin);

            const root = await loadRootNode(context);
            const children = await plugin.core.loadChildren(root);
            const helloNode = children
                .find(node => plugin.core.getAttribute(node, 'name') === 'hello');

            assert(helloNode, 'Could not find node with name "hello"');
        });

        it('should throw error if setAttribute to undefined value', async function() {
            plugin.main = async function(callback) {
                try {
                    this.setAttribute(this.rootNode, 'name', undefined);
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
                this.setAttribute(this.activeNode, 'name', 'hello');
                await this.save('Test save...');

                this.setPointer(this.activeNode, 'test', oldNode);
                await this.save('Test save...');
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
                this.createNode('FCO', this.rootNode);
                await this.save('Test save...');
                const newNode = (await this.core.loadChildren(this.rootNode))
                    .find(node => this.core.getPath(node) !== '/1');

                // Test deletion
                this.deleteNode(newNode);

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
                const newNode = this.createNode('FCO', this.rootNode);
                this.deleteNode(newNode);
                await this.save('Test save...');
                this.result.setSuccess(true);
                return callback(null, this.result);
            };
            await manager.runPluginMain(plugin);

            const root = await loadRootNode(context);
            const children = await plugin.core.loadChildren(root);
            assert.equal(children.length, 1);
        });

        it.skip('should be able to delete nodes', async function() {
            plugin.main = async function(callback) {
                // FIXME: This is a problem!
                const newNode = this.createNode('FCO', this.rootNode);
                await this.save('Test save...');
                this.deleteNode(newNode);  // newNode is currently incorrect...
                await this.save('Test save...');
                this.result.setSuccess(true);
                return callback(null, this.result);
            };
            await manager.runPluginMain(plugin);

            const root = await loadRootNode(context);
            const children = await plugin.core.loadChildren(root);
            assert.equal(children.length, 0);
        });
    });

    describe('reading capabilities', function() {
        it('should include unsaved changes', async function() {
            plugin.main = async function(callback) {
                this.setAttribute(this.rootNode, 'name', 'hello');
                const name = this.getAttribute(this.rootNode, 'name');
                assert.equal(name, 'hello');
                this.result.setSuccess(true);
                return callback(null, this.result);
            };
            await manager.runPluginMain(plugin);

            const root = await loadRootNode(context);
            assert.notEqual(plugin.core.getAttribute(root, 'name'), 'hello');
        });

        it('should include staged changes', async function() {
            plugin.main = async function(callback) {
                this.setAttribute(this.rootNode, 'name', 'hello');
                const save = this.save('Saving...');
                const name = this.getAttribute(this.rootNode, 'name');
                assert.equal(name, 'hello');
                this.result.setSuccess(true);
                await save;
                return callback(null, this.result);
            };
            await manager.runPluginMain(plugin);
        });

        it('should include unsaved changes to new nodes', async function() {
            plugin.main = async function(callback) {
                const newNode = this.createNode('FCO', this.rootNode);
                this.setAttribute(newNode, 'name', 'hello');
                const name = this.getAttribute(newNode, 'name');
                assert.equal(name, 'hello');
                this.result.setSuccess(true);
                return callback(null, this.result);
            };
            await manager.runPluginMain(plugin);

            const root = await loadRootNode(context);
            const childNames = (await plugin.core.loadChildren(root))
                .map(child => plugin.core.getAttribute(child, 'name'));

            assert(!childNames.includes('hello'));
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
                this.setAttribute(this.rootNode, 'name', 'hello');
                await this.save('Test save...');

                assert.notEqual(oldRoot, this.rootNode, 'this.rootNode not updated');
                assert.equal(this.customCache['hi'], this.rootNode, 'Custom cache values not updated.');
                this.result.setSuccess(true);
                return callback(null, this.result);
            };
            await manager.runPluginMain(plugin);

            const root = await loadRootNode(context);
            assert.equal(plugin.core.getAttribute(root, 'name'), 'hello');
        });
    });

    describe('while saving', function() {
        it('should be able to edit nodes', async function() {
            plugin.main = async function(callback) {
                this.createNode('FCO', this.rootNode);
                this.save('Test save...');
                this.setAttribute(this.rootNode, 'name', 'hello');
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
                this.createNode('FCO', this.rootNode);
                const save = this.save('Test save...');
                this.setAttribute(this.rootNode, 'name', 'hello');
                this.result.setSuccess(true);
                await save;
                return callback(null, this.result);
            };
            await manager.runPluginMain(plugin);

            const root = await loadRootNode(context);
            assert.notEqual(plugin.core.getAttribute(root, 'name'), 'hello');
        });

        it('should not include unsaved edits to new nodes', async function() {
            plugin.main = async function(callback) {
                const newNode = this.createNode('FCO', this.rootNode);
                this.setAttribute(newNode, 'name', 'hello');

                const save = this.save('Test save...');

                const notSaved = this.createNode('FCO', this.rootNode);
                this.setAttribute(notSaved, 'name', 'goodbye');

                this.result.setSuccess(true);
                await save;
                return callback(null, this.result);
            };
            await manager.runPluginMain(plugin);

            const root = await loadRootNode(context);
            const childNames = (await plugin.core.loadChildren(root))
                .map(child => plugin.core.getAttribute(child, 'name'));

            assert(childNames.includes('hello'), 'Missing created node.');
            assert(!childNames.includes('goodbye'), 'Included node created after save.');
        });
    });
});
