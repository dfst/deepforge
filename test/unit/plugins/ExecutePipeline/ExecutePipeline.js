/* globals */
/*jshint node:true, mocha:true*/

describe('ExecutePipeline', function () {
    this.timeout(5000);
    const {promisify} = require('util');
    const testFixture = require('../../../globals');
    const {path, expect} = testFixture;
    const gmeConfig = testFixture.getGmeConfig();
    const PULSE = require('../../../../src/common/Constants').PULSE;
    const logger = testFixture.logger.fork('ExecutePipeline');
    const PluginNodeManager = require('webgme-engine/src/plugin/nodemanager');
    const manager = new PluginNodeManager(null, null, logger, gmeConfig);
    const assert = require('assert');

    const projectName = 'testProject';
    const pluginName = 'ExecutePipeline';
    let project,
        gmeAuth,
        storage,
        plugin,
        node,
        commitHash,
        nopPromise = () => Promise.resolve();

    manager.executePlugin = promisify(manager.executePlugin);
    manager.runPluginMain = promisify(manager.runPluginMain);

    const Pipeline = {};
    Pipeline.HelloWorld = '/f/h';
    Pipeline.SimpleIO = '/f/x';
    Pipeline.ComplexPipeline = '/f/3';
    Pipeline.ExportPlugin = '/f/s';

    let server;

    before(async function () {
        server = new testFixture.WebGME.standaloneServer(gmeConfig);
        server.start = promisify(server.start);
        server.stop = promisify(server.stop);
        gmeAuth = await testFixture.clearDBAndGetGMEAuth(gmeConfig, projectName);
        // This uses in memory storage. Use testFixture.getMongoStorage to persist test to database.
        storage = testFixture.getMemoryStorage(logger, gmeConfig, gmeAuth);
        await storage.openDatabase();
        const importParam = {
            projectSeed: path.join(testFixture.DF_SEED_DIR, 'devProject', 'devProject.webgmex'),
            projectName: projectName,
            branchName: 'master',
            logger: logger,
            gmeConfig: gmeConfig
        };

        const result = await testFixture.importProject(storage, importParam);
        project = result.project;
        commitHash = result.commitHash;

        await project.createBranch('test', commitHash);
        await server.start();
    });

    after(async function () {
        await storage.closeDatabase();
        await gmeAuth.unload();
        await server.stop();
    });

    it.skip('should execute single job', async function () {
        const config = {compute: {id: 'gme', config: {}}};
        const context = {
            project: project,
            commitHash: commitHash,
            namespace: 'pipeline',
            branchName: 'test',
            activeNode: '/f/5'
        };

        const pluginResult = await manager.executePlugin(pluginName, config, context);
        expect(typeof pluginResult).to.equal('object');
        expect(pluginResult.success).to.equal(true);

        const branchHash = await project.getBranchHash('test');
        expect(branchHash).to.not.equal(commitHash);
    });

    it.skip('should run plugin w/ references', async function () {
        var pluginConfig = {},
            context = {
                project: project,
                commitHash: commitHash,
                namespace: 'pipeline',
                branchName: 'test',
                activeNode: '/f/G'
            };

        const pluginResult = await manager.executePlugin(pluginName, pluginConfig, context);
        expect(typeof pluginResult).to.equal('object');
        expect(pluginResult.success).to.equal(true);

        const branchHash = await project.getBranchHash('test');
        expect(branchHash).to.not.equal(commitHash);
    });

    describe('resuming tests', function() {
        let plugin;
        const config = {compute: {id: 'gme', config: {}}};
        let context = null;

        beforeEach(async () => {
            context = {
                project: project,
                commitHash: commitHash,
                namespace: 'pipeline',
                branchName: 'test',
                activeNode: '/K/2'  // hello world job's execution
            };
            plugin = await preparePlugin(config, context);
        });

        it('should record origin on start', function (done) {
            // Verify that the origin is recorded...
            plugin.originManager.record = () => done();
            plugin.startPipeline();
        });

        it('should update recorded origin on fork', function (done) {
            const forkName = 'hello';
            plugin.currentRunId = 'asdfa';
            plugin.originManager.fork = (hash, name) => {
                assert.equal(hash, plugin.currentRunId);
                assert.equal(name, forkName);
                done();
            };
            plugin.onSaveForked(forkName);
        });

        // Check that it resumes when
        //  - ui is behind
        //  - no plugin is running
        //  - on origin branch
        var resumeScenario = function(runId, gmeStatus, pulse, originBranch, shouldResume, done) {
            plugin.core.setAttribute(node, 'runId', runId);
            plugin.core.setAttribute(node, 'status', gmeStatus);
            // Mocks:
            //  - prepare should basically nop
            //  - Should call 'resumeJob' or 'executeJob'
            //  - should return origin branch
            plugin.prepare = nopPromise;
            plugin.pulseClient.check = () => Promise.resolve(pulse);
            plugin.originManager.getOrigin = () =>
                Promise.resolve(originBranch && {branch: originBranch});

            plugin.pulseClient.update = nopPromise;
            plugin.resumePipeline = () => done(shouldResume ? null : 'Should not resume pipeline!');
            plugin.executePipeline = () => done(shouldResume ? 'Should resume pipeline!' : null);
                
            plugin.main();
        };

        var names = ['runId', 'gme', 'pulse', 'origin branch', 'expected to resume'],
            title;
        [
            ['someId', 'running', PULSE.DEAD, 'test', true],

            // Should not restart if the pulse is not found
            ['someId', 'running', PULSE.DOESNT_EXIST, 'test', false],

            // Should not restart if the plugin is alive
            ['someId', 'running', PULSE.ALIVE, 'test', false],

            // Should not restart if the ui is not 'running'
            ['someId', 'failed', PULSE.DEAD, 'test', false],

            // Should not restart if missing runId
            [null, 'running', PULSE.DEAD, 'test', false],

            // Should not restart if missing origin
            [null, 'running', PULSE.DEAD, null, false],

            // Should not restart if on incorrect branch (wrt origin branch)
            ['someId', 'running', PULSE.DEAD, 'master', false]
        ].forEach(row => {
            title = names.map((n, i) => `${n}: ${row[i]}`).join(' | ');
            it(title, function(done) {
                row.push(done);
                resumeScenario.apply(null, row);
            });
        });
    });

    async function preparePlugin(config, context) {
        plugin = await manager.initializePlugin(pluginName);
        await manager.configurePlugin(plugin, config, context);

        plugin.logManager = new LogManager();
        plugin.originManager.record =
        plugin.checkExecutionEnv = nopPromise;
        plugin.updateExecHeartBeat = () => {};
        plugin.executionId = Promise.resolve('some_execution_id');

        node = plugin.activeNode;
        return plugin;
    }

    function LogManager() {
    }

    LogManager.prototype.getMetadata =
    LogManager.prototype.deleteLog =
    LogManager.prototype.appendTo =
    LogManager.prototype.getLog =
    LogManager.prototype.fork = () => {};
});
