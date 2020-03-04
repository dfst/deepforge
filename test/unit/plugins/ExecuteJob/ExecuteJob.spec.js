/*jshint node:true, mocha:true*/

'use strict';

describe('ExecuteJob', function () {
    const testFixture = require('../../../globals');
    const {Q, expect, waitUntil, requirejs} = testFixture;
    const {promisify} = require('util');
    const assert = require('assert');
    const ComputeClient = requirejs('deepforge/compute/backends/ComputeClient');
    var gmeConfig = testFixture.getGmeConfig(),
        logger = testFixture.logger.fork('ExecuteJob'),
        PluginCliManager = testFixture.WebGME.PluginCliManager,
        projectName = 'testProject',
        pluginName = 'ExecuteJob',
        manager = new PluginCliManager(null, logger, gmeConfig),
        PULSE = require('../../../../src/common/Constants').PULSE,
        project,
        gmeAuth,
        storage,
        commitHash,
        nopPromise = () => {
            return Q();
        };

    before(async function () {
        this.timeout(10000);
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

    it('should verify activeNode is "Job"', function (done) {
        var pluginConfig = {},
            context = {
                project: project,
                commitHash: commitHash,
                branchName: 'test',
                activeNode: '/1'
            };

        manager.executePlugin(pluginName, pluginConfig, context, function (err, pluginResult) {
            expect(err.message).to.equal('Cannot execute FCO (expected Job)');
            expect(typeof pluginResult).to.equal('object');
            expect(pluginResult.success).to.equal(false);
            done();
        });
    });

    ////////// Helper Functions //////////
    var plugin,
        node,
        preparePlugin = async function() {
            const config = {compute: {id: 'gme', config: {}}};
            const context = {
                project: project,
                commitHash: commitHash,
                namespace: 'pipeline',
                branchName: 'test',
                activeNode: '/K/2/U'  // hello world job
            };

            plugin = await manager.initializePlugin(pluginName);
            plugin.main = promisify(plugin.main);
            plugin.executionId = Promise.resolve('some_execution_id');
            await manager.configurePlugin(plugin, config, context);
            node = plugin.activeNode;
        };

    ////////// END Helper Functions //////////

    // Race condition checks w/ saving...
    describe('get/set', function() {
        beforeEach(preparePlugin);

        it('should get correct attribute after set', function() {
            plugin.core.setAttribute(node, 'status', 'queued');
            var attrValue = plugin.core.getAttribute(node, 'status');
            expect(attrValue).to.equal('queued');
        });

        it('should get correct attribute before updating nodes', async function() {
            // Run setAttribute on some node
            plugin.core.setAttribute(node, 'status', 'queued');

            // Check that the value is correct before applying node changes
            var updateNodes = plugin.updateNodes;
            plugin.updateNodes = function() {
                var attrValue = plugin.core.getAttribute(node, 'status');
                expect(attrValue).to.equal('queued');
                return updateNodes.apply(this, arguments);
            };
            await plugin.save();
        });

        it('should get correct attribute after save', async function() {
            // Run setAttribute on some node
            plugin.core.setAttribute(node, 'status', 'queued');

            // Check that the value is correct before applying node changes
            await plugin.save();
            const attrValue = plugin.core.getAttribute(node, 'status');
            expect(attrValue).to.equal('queued');
        });
    });

    // Canceling
    describe('cancel', function() {
        beforeEach(preparePlugin);

        // TODO: Update this so that they can be canceled synchronously
        it('should cancel running jobs on plugin abort', function(done) {
            const jobInfo = {hash: 'abc123', secret: 'abc'};
            const mockCompute = {};
            mockCompute.cancelJob = job => {
                if (job.hash !== jobInfo.hash) {
                    done(new Error('Invalid jobInfo'));
                }
                done();
            };
            mockCompute.createJob = async () => jobInfo;
            plugin.compute = mockCompute;

            return Q(plugin.createJob(node, jobInfo.hash))
                .finally(() => plugin.onAbort());
        });

        it('should set exec to running', function(done) {
            var job = node,
                execNode = plugin.core.getParent(job);

            // Set the execution to canceled
            plugin.core.setAttribute(execNode, 'status', 'canceled');
            plugin.prepare = () => {
                var status = plugin.core.getAttribute(execNode, 'status');
                expect(status).to.not.equal('canceled');
                return Promise.resolve().then(done);
            };
            plugin.main();
        });
    });

    describe('resume detection', function() {
        var mockPluginForJobStatus = function(gmeStatus, pulse, originBranch, shouldResume, done) {
            plugin.core.setAttribute(node, 'status', gmeStatus);
            plugin.core.setAttribute(node, 'jobInfo', JSON.stringify({hash:'abc'}));
            // Mocks:
            //  - prepare should basically nop
            //  - Should call 'resumeJob' or 'executeJob'
            //  - should return origin branch
            plugin.prepare = nopPromise;
            plugin.pulseClient.check = () => Q(pulse);
            plugin.originManager.getOrigin = () => Q({branch: originBranch});

            plugin.pulseClient.update = nopPromise;
            plugin.resumeJob = () => done(shouldResume ? null : 'Should not resume job!');
            plugin.executeJob = () => done(shouldResume ? 'Should resume job!' : null);
                
            plugin.main();
        };

        beforeEach(preparePlugin);

        // test using a table of gme status|pulse status|job status|should resume?
        var names = ['gme', 'pulse', 'origin branch', 'expected to resume'],
            title;

        // gme status, pulse status, job status, should resume
        [
            // Should restart if running and the pulse is not found
            ['running', PULSE.DEAD, 'test', true],

            // Should restart if the pulse is not found
            ['running', PULSE.DOESNT_EXIST, 'test', true],

            // Should not restart if the plugin is alive
            ['running', PULSE.ALIVE, 'test', false],

            // Should not restart if the ui is not 'running'
            ['failed', PULSE.DOESNT_EXIST, 'test', false],

            // Should not restart if on incorrect branch (wrt origin branch)
            ['running', PULSE.DOESNT_EXIST, 'master', false]

        ].forEach(row => {
            title = names.map((v, i) => `${v}: ${row[i]}`).join(' | ');
            it(title, function(done) {
                row.push(done);
                mockPluginForJobStatus.apply(null, row);
            });
        });
    });

    describe('preparing', function() {
        beforeEach(preparePlugin);

        // should not delete child nodes during 'prepare' if resuming
        it('should delete child metadata nodes', async function() {
            // Create a metadata node w/ a child
            const graph = plugin.core.createNode({
                base: plugin.META.Graph,
                parent: plugin.activeNode
            });
            plugin.core.createNode({
                base: plugin.META.Line,
                parent: graph
            });

            await plugin.save();
            await plugin.prepare(true);
            const children = await plugin.core.loadChildren(graph);
            expect(children.length).to.equal(0);
        });
    });

    describe('resume errors', function() {
        beforeEach(preparePlugin);

        it('should handle error if missing jobId', async function() {
            // Remove jobId
            plugin.core.delAttribute(plugin.activeNode, 'jobInfo');
            plugin.startExecHeartBeat = () => {};
            plugin.isResuming = () => Q(true);
            try {
                await plugin.main();
                throw new Error('No error thrown');
            } catch (err) {
                assert.notEqual(err.message, 'No error thrown');
            }
        });
    });

    describe('job deletion', function() {
        beforeEach(async () => {
            await preparePlugin();
            plugin.startExecHeartBeat = () => {};
        });

        it('should be able to abort plugin and delete node w/o error', async () => {
            plugin.createComputeClient = function() {
                return new MockCompute(plugin.logger, plugin.blobClient);
            };

            plugin.main();
            await waitUntil(() => plugin.runningJobHashes.length);

            plugin.onAbort();
            plugin.core.deleteNode(plugin.activeNode);
            await plugin.save();
            await plugin.compute.emit('end', plugin.compute.jobId);
        });
    });

    class MockCompute extends ComputeClient {
        createJob(hash) {
            this.jobId = hash;
            return {hash};
        }

        cancelJob(/*jobInfo*/) {
        }
    }
});
