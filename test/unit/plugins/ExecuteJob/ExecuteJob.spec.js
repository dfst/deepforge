/*jshint node:true, mocha:true*/

'use strict';

describe('ExecuteJob', function () {
    const testFixture = require('../../../globals');
    var gmeConfig = testFixture.getGmeConfig(),
        expect = testFixture.expect,
        Q = testFixture.Q,
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

    before(function (done) {
        this.timeout(10000);
        testFixture.clearDBAndGetGMEAuth(gmeConfig, projectName)
            .then(function (gmeAuth_) {
                gmeAuth = gmeAuth_;
                // This uses in memory storage. Use testFixture.getMongoStorage to persist test to database.
                storage = testFixture.getMemoryStorage(logger, gmeConfig, gmeAuth);
                return storage.openDatabase();
            })
            .then(function () {
                var importParam = {
                    projectSeed: testFixture.path.join(testFixture.DF_SEED_DIR, 'devProject', 'devProject.webgmex'),
                    projectName: projectName,
                    branchName: 'master',
                    logger: logger,
                    gmeConfig: gmeConfig
                };

                return testFixture.importProject(storage, importParam);
            })
            .then(function (importResult) {
                project = importResult.project;
                commitHash = importResult.commitHash;
                return project.createBranch('test', commitHash);
            })
            .nodeify(done);
    });

    after(function (done) {
        storage.closeDatabase()
            .then(function () {
                return gmeAuth.unload();
            })
            .nodeify(done);
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
            expect(err).to.equal('Cannot execute FCO (expected Job)');
            expect(typeof pluginResult).to.equal('object');
            expect(pluginResult.success).to.equal(false);
            done();
        });
    });

    ////////// Helper Functions //////////
    var plugin,
        node,
        preparePlugin = function(done) {
            var context = {
                project: project,
                commitHash: commitHash,
                namespace: 'pipeline',
                branchName: 'test',
                activeNode: '/K/2/U'  // hello world job
            };

            return manager.initializePlugin(pluginName)
                .then(plugin_ => {
                    plugin = plugin_;
                    plugin.checkExecutionEnv = () => Q();
                    return manager.configurePlugin(plugin, {}, context);
                })
                .then(() => node = plugin.activeNode)
                .nodeify(done);
        };

    ////////// END Helper Functions //////////

    // Race condition checks w/ saving...
    describe('get/set', function() {
        beforeEach(preparePlugin);

        it('should get correct attribute after set', function() {
            plugin.setAttribute(node, 'status', 'queued');
            var attrValue = plugin.getAttribute(node, 'status');
            expect(attrValue).to.equal('queued');
        });

        it('should get correct attribute before updating nodes', function(done) {
            // Run setAttribute on some node
            plugin.setAttribute(node, 'status', 'queued');

            // Check that the value is correct before applying node changes
            var updateNodes = plugin.updateNodes;
            plugin.updateNodes = function() {
                var attrValue = plugin.getAttribute(node, 'status');
                expect(attrValue).to.equal('queued');
                return updateNodes.apply(this, arguments);
            };
            plugin.save().nodeify(done);
        });

        it('should get correct attribute (from new node) before updating nodes', function(done) {
            // Run setAttribute on some node
            var graphTmp = plugin.createNode('Graph', node),
                newVal = 'testGraph',
                id = 'testId';

            // Get the 
            plugin.setAttribute(graphTmp, 'name', newVal);
            plugin._metadata[id] = graphTmp;
            plugin.createIdToMetadataId[graphTmp] = id;

            // Check that the value is correct before applying node changes
            var updateNodes = plugin.updateNodes;
            plugin.updateNodes = function() {
                var graph = plugin._metadata[id],
                    attrValue = plugin.getAttribute(graph, 'name');

                expect(attrValue).to.equal(newVal);
                return updateNodes.apply(this, arguments);
            };
            plugin.save().nodeify(done);
        });

        it('should get correct attribute after save', function(done) {
            // Run setAttribute on some node
            plugin.setAttribute(node, 'status', 'queued');

            // Check that the value is correct before applying node changes
            plugin.save()
                .then(() => {
                    var attrValue = plugin.getAttribute(node, 'status');
                    expect(attrValue).to.equal('queued');
                })
                .nodeify(done);
        });

        it('should get correct attribute while applying node changes', function(done) {
            // Run setAttribute on some node
            plugin.setAttribute(node, 'status', 'queued');

            // Check that the value is correct before applying node changes
            var oldApplyChanges = plugin._applyNodeChanges;
            plugin._applyNodeChanges = function() {
                var attrValue = plugin.getAttribute(node, 'status');
                expect(attrValue).to.equal('queued');
                return oldApplyChanges.apply(this, arguments);
            };
            plugin.save().nodeify(done);
        });
    });

    describe('createNode', function() {
        beforeEach(preparePlugin);

        it('should update _metadata after applying changes', function(done) {
            // Run setAttribute on some node
            var graphTmp = plugin.createNode('Graph', node),
                id = 'testId';

            plugin._metadata[id] = graphTmp;
            plugin.createIdToMetadataId[graphTmp] = id;

            // Check that the value is correct before applying node changes
            var applyModelChanges = plugin.applyModelChanges;
            plugin.applyModelChanges = function() {
                return applyModelChanges.apply(this, arguments)
                    .then(() => {
                        var graph = plugin._metadata[id];
                        expect(graph).to.not.equal(graphTmp);
                    });
            };
            plugin.save().nodeify(done);
        });

        it('should update _metadata in updateNodes', function(done) {
            var id = 'testId';

            plugin._metadata[id] = node;
            node.old = true;
            plugin.updateNodes()
                .then(() => {
                    var graph = plugin._metadata[id];
                    expect(graph.old).to.not.equal(true);
                })
                .nodeify(done);
        });

        // Check that it gets the correct value from a newly created node after
        // it has been saved/created
        it('should get changed attribute', function(done) {
            // Run setAttribute on some node
            var graphTmp = plugin.createNode('Graph', node),
                id = 'testId';

            plugin._metadata[id] = node;
            plugin.createIdToMetadataId[graphTmp] = id;

            plugin.setAttribute(graphTmp, 'name', 'firstName');

            // Check that the value is correct before applying node changes
            plugin.save()
                .then(() => {
                    var graph = plugin._metadata[id],
                        val = plugin.getAttribute(graph, 'name');
                    expect(val).to.equal('firstName');
                })
                .nodeify(done);
        });

        it('should get inherited attribute', function(done) {
            // Run setAttribute on some node
            var graphTmp = plugin.createNode('Graph', node),
                id = 'testId',
                val;

            // Check that the value is correct before applying node changes
            plugin._metadata[id] = node;
            plugin.createIdToMetadataId[graphTmp] = id;

            val = plugin.getAttribute(graphTmp, 'name');
            expect(val).to.equal('Graph');

            plugin.save()
                .then(() => {
                    var graph = plugin._metadata[id];

                    val = plugin.getAttribute(graph, 'name');

                    expect(val).to.equal('Graph');
                })
                .nodeify(done);
        });
    });

    // Canceling
    describe('cancel', function() {
        beforeEach(preparePlugin);

        it('should stop the job if the execution is canceled', function(done) {
            var job = node,
                hash = 'abc123';

            plugin.setAttribute(node, 'secret', 'abc');
            plugin.isExecutionCanceled = () => true;
            plugin.onOperationCanceled = () => done();
            plugin.executor = {
                cancelJob: jobHash => expect(jobHash).equal(hash)
            };
            plugin.watchOperation(hash, job, job);
        });

        it('should stop the job if a job is canceled', function(done) {
            var job = node,
                hash = 'abc123';

            plugin.setAttribute(job, 'secret', 'abc');
            plugin.canceled = true;
            plugin.onOperationCanceled = () => done();
            plugin.executor = {
                cancelJob: jobHash => expect(jobHash).equal(hash)
            };
            plugin.watchOperation(hash, job, job);
        });

        it('should set exec to running', function(done) {
            var job = node,
                execNode = plugin.core.getParent(job);

            // Set the execution to canceled
            plugin.setAttribute(execNode, 'status', 'canceled');
            plugin.prepare = () => {
                var status = plugin.getAttribute(execNode, 'status');
                expect(status).to.not.equal('canceled');
                return {then: () => done()};
            };
            plugin.main();
        });
    });

    describe('resume detection', function() {
        var mockPluginForJobStatus = function(gmeStatus, pulse, originBranch, shouldResume, done) {
            plugin.setAttribute(node, 'status', gmeStatus);
            plugin.setAttribute(node, 'jobId', 'asdfaa');
            // Mocks:
            //  - prepare should basically nop
            //  - Should call 'resumeJob' or 'executeJob'
            //  - should return origin branch
            plugin.prepare = nopPromise;
            plugin.pulseClient.check = () => Q().then(() => pulse);
            plugin.originManager.getOrigin = () => Q().then(() => {
                return {branch: originBranch};
            });

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
        it('should delete child metadata nodes', function(done) {
            // Create a metadata node w/ a child
            var graphId = plugin.createNode('Graph', plugin.activeNode);
            plugin.createNode('Line', graphId);

            plugin.save()
                .then(() => plugin.prepare(true))
                .then(() => {
                    expect(plugin.deletions.length).to.equal(1);
                })
                .nodeify(done);
        });

        // should not mark any nodes for deletion during `prepare` if resuming
        it('should mark nodes for deletion', function(done) {
            var jobId = plugin.core.getPath(plugin.activeNode),
                deleteIds;

            // Create a metadata node
            plugin.createNode('Graph', plugin.activeNode);

            plugin.save()
                .then(() => plugin.prepare(true))
                .then(() => {
                    deleteIds = Object.keys(plugin._markForDeletion[jobId]);
                    expect(deleteIds.length).to.equal(1);
                })
                .nodeify(done);
        });
    });

    describe('resume errors', function() {
        beforeEach(preparePlugin);

        it('should handle error if missing jobId', function(done) {
            // Remove jobId
            plugin.delAttribute(plugin.activeNode, 'runId');
            plugin.startExecHeartBeat = () => {};
            plugin.isResuming = () => Q(true);
            plugin.main(function(err) {
                expect(err).to.not.equal(null);
                done();
            });
        });
    });
});
