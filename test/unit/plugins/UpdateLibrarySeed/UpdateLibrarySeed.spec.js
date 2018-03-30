/*jshint node:true, mocha:true*/

describe('UpdateLibrarySeed', function () {
    const testFixture = require('../../../globals');
    var gmeConfig = testFixture.getGmeConfig(),
        expect = testFixture.expect,
        Q = testFixture.Q,
        logger = testFixture.logger.fork('UpdateLibrarySeed'),
        PluginCliManager = testFixture.WebGME.PluginCliManager,
        projectName = 'project',  // just use the default project seed for testing
        pluginName = 'UpdateLibrarySeed',
        manager = new PluginCliManager(null, logger, gmeConfig),
        project,
        gmeAuth,
        storage,
        commitHash;

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
                    projectSeed: testFixture.path.join(testFixture.DF_SEED_DIR, 'project', 'project.webgmex'),
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

    var plugin,
        preparePlugin = function(done) {
            var context = {
                project: project,
                commitHash: commitHash,
                branchName: 'test',
                activeNode: '/1'
            };

            return manager.initializePlugin(pluginName)
                .then(plugin_ => {
                    plugin = plugin_;
                    return manager.configurePlugin(plugin, {}, context);
                })
                .nodeify(done);
        };

    beforeEach(preparePlugin);

    it('should run plugin and update the branch', function (done) {
        plugin.recordVersion = () => Q();
        plugin.updateSeed = () => Q();
        plugin.main(function (err, pluginResult) {
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

    describe('version bump', function() {

        [
            ['0.0.0', '0.0.1', 'patch'],
            ['0.0.0', '0.1.0', 'minor'],
            ['0.0.0', '1.0.0', 'major'],
            ['0.0.4', '0.1.0', 'minor'],
            ['0.3.5', '1.0.0', 'major'],
            ['2.3.5', '3.0.0', 'major']
        ].forEach(testcase => {
            var start = testcase[0],
                end = testcase[1],
                release = testcase[2];

            it(`should bump ${start} -> ${end} (${release})`, function () {
                var newVersion = plugin.bumpVersion(start, release);
                expect(newVersion).to.equal(end);
            });
        });

    });
});
