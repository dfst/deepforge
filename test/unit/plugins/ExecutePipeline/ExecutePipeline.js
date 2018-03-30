/* globals describe, before, after */
/*jshint node:true, mocha:true*/

describe('ExecutePipeline', function () {
    this.timeout(5000);
    var testFixture = require('../../../globals'),
        path = testFixture.path,
        gmeConfig = testFixture.getGmeConfig(),
        expect = testFixture.expect,
        Q = testFixture.Q,
        PULSE = require('../../../../src/common/Constants').PULSE,
        logger = testFixture.logger.fork('ExecutePipeline'),
        PluginCliManager = testFixture.WebGME.PluginCliManager,
        manager = new PluginCliManager(null, logger, gmeConfig),
        projectName = 'testProject',
        pluginName = 'ExecutePipeline',
        project,
        gmeAuth,
        storage,
        plugin,
        node,
        //server,
        commitHash,
        nopPromise = () => {
            return Q();
        };

    before(function (done) {
        testFixture.clearDBAndGetGMEAuth(gmeConfig, projectName)
            .then(function (gmeAuth_) {
                gmeAuth = gmeAuth_;
                // This uses in memory storage. Use testFixture.getMongoStorage to persist test to database.
                storage = testFixture.getMemoryStorage(logger, gmeConfig, gmeAuth);
                return storage.openDatabase();
            })
            .then(function () {
                var importParam = {
                    projectSeed: path.join(testFixture.DF_SEED_DIR, 'devProject', 'devProject.webgmex'),
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
        //server.kill('SIGINT');  // not killing process...
        storage.closeDatabase()
            .then(function () {
                return gmeAuth.unload();
            })
            .nodeify(done);
    });

    it.skip('should execute single job', function (done) {
        var context = {
            project: project,
            commitHash: commitHash,
            namespace: 'pipeline',
            branchName: 'test',
            activeNode: '/f/5'
        };

        manager.executePlugin(pluginName, {}, context, function (err, pluginResult) {
            expect(err).to.equal(null);
            expect(typeof pluginResult).to.equal('object');
            expect(pluginResult.success).to.equal(true);

            project.getBranchHash('test')
                .then(function (branchHash) {
                    expect(branchHash).to.not.equal(commitHash);
                })
                .nodeify(done);
        });
    });

    it.skip('should run plugin w/ references', function (done) {
        var pluginConfig = {},
            context = {
                project: project,
                commitHash: commitHash,
                namespace: 'pipeline',
                branchName: 'test',
                activeNode: '/f/G'
            };

        manager.executePlugin(pluginName, pluginConfig, context, function (err, pluginResult) {
            expect(err).to.equal(null);
            expect(typeof pluginResult).to.equal('object');
            expect(pluginResult.success).to.equal(true);

            project.getBranchHash('test')
                .then(function (branchHash) {
                    expect(branchHash).to.not.equal(commitHash);
                })
                .nodeify(done);
        });
    });

    var preparePlugin = function(done) {
        var context = {
            project: project,
            commitHash: commitHash,
            namespace: 'pipeline',
            branchName: 'test',
            activeNode: '/K/2'  // hello world job's execution
        };

        return manager.initializePlugin(pluginName)
            .then(plugin_ => {
                plugin = plugin_;
                plugin.checkExecutionEnv = () => Q();
                plugin.startExecHeartBeat = () => {};
                return manager.configurePlugin(plugin, {}, context);
            })
            .then(() => node = plugin.activeNode)
            .nodeify(done);
    };

    describe('resuming tests', function() {
        beforeEach(preparePlugin);

        it('should record origin on start', function (done) {
            // Verify that the origin is recorded...
            plugin.originManager.record = () => done();
            plugin.startPipeline();
        });

        it('should update recorded origin on fork', function (done) {
            var forkName = 'hello';
            plugin.currentRunId = 'asdfa';
            plugin.originManager.fork = (hash, name) => {
                expect(hash).to.equal(plugin.currentRunId);
                expect(name).to.equal(forkName);
                done();
            };
            plugin.onSaveForked(forkName);
        });

        // Check that it resumes when
        //  - ui is behind
        //  - no plugin is running
        //  - on origin branch
        var resumeScenario = function(runId, gmeStatus, pulse, originBranch, shouldResume, done) {
            plugin.setAttribute(node, 'runId', runId);
            plugin.setAttribute(node, 'status', gmeStatus);
            // Mocks:
            //  - prepare should basically nop
            //  - Should call 'resumeJob' or 'executeJob'
            //  - should return origin branch
            plugin.prepare = nopPromise;
            plugin.pulseClient.check = () => Q().then(() => pulse);
            plugin.originManager.getOrigin = () => Q().then(() => {
                return originBranch && {branch: originBranch};
            });

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
});
