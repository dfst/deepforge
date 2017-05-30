/*jshint node:true, mocha:true*/

'use strict';
describe('Export', function () {
    var testFixture = require('../../globals'),
        lua = require('../../../src/common/lua'),
        path = testFixture.path,
        assert = require('assert'),
        SEED_DIR = path.join(testFixture.DF_SEED_DIR, 'devProject'),
        gmeConfig = testFixture.getGmeConfig(),
        expect = testFixture.expect,
        logger = testFixture.logger.fork('Export'),
        PluginCliManager = testFixture.WebGME.PluginCliManager,
        manager = new PluginCliManager(null, logger, gmeConfig),
        BlobClient = require('webgme/src/server/middleware/blob/BlobClientWithFSBackend'),
        projectName = 'testProject',
        pluginName = 'Export',
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
                    projectSeed: path.join(SEED_DIR, 'devProject.webgmex'),
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

    it('should run plugin and NOT update the branch', function (done) {
        var pluginConfig = {},
            context = {
                namespace: 'pipeline',
                project: project,
                commitHash: commitHash,
                branchName: 'test',
                activeNode: '/f/e'
            };

        manager.executePlugin(pluginName, pluginConfig, context, function (err, pluginResult) {
            expect(err).to.equal(null);
            expect(typeof pluginResult).to.equal('object');
            expect(pluginResult.success).to.equal(true);

            project.getBranchHash('test')
                .then(function (branchHash) {
                    expect(branchHash).to.equal(commitHash);
                })
                .nodeify(done);
        });
    });

    [  // name, id, args, expected result
        ['concat', '/f/e', 'hello world', 'helloworld', 'hello-world'],
        ['math example', '/f/J', '2 2 2', 96, 'result'],
        ['cifar10 prep-train-test', '/f/C']
    ].forEach(testCase => {
        var caseName = testCase[0],
            nodeId = testCase[1],
            cliArgs,
            saveData,
            saveName,
            exportTestCode;

        describe(caseName, function() {
            before(function(done) {
                // Run the example
                var pluginConfig = {},
                    context = {
                        namespace: 'pipeline',
                        project: project,
                        commitHash: commitHash,
                        branchName: 'test',
                        activeNode: nodeId
                    };

                manager.executePlugin(pluginName, pluginConfig, context, function (err, pluginResult) {
                    var blobClient = new BlobClient(gmeConfig, logger),
                        codeHash = pluginResult.artifacts[0];

                    return blobClient.getObjectAsString(codeHash)
                        .then(code => {
                            exportTestCode = code;
                            done();
                        });
                });
            });

            it('should generate valid lua', function () {
                lua.compile(exportTestCode);
            });

            if (testCase.length > 2) {
                cliArgs = testCase[2].split(' ');
                saveData = testCase[3];
                saveName = testCase[4];

                it(`should save ${saveData} to ${saveName}`, function (done) {
                    var context = lua.newContext(),
                        args = lua.newContext()._G,
                        torch = lua.newContext()._G,
                        bin;

                    context.loadStdLib();
                    // Add the test input args
                    cliArgs.forEach((cliArg, index) => args.set(index+1, cliArg));
                    context._G.set('arg', args);

                    // Add the torch.save, torch.class mocks
                    torch.set('save', (path, data) => {
                        expect(path).to.equal(saveName);
                        expect(data).to.equal(saveData);
                        done();
                    });
                    torch.set('class', name => {
                        try {
                            var cntr = context._G,
                                classes,
                                newClass = lua.newContext()._G;

                            if (name.includes('.')) {
                                classes = name.split('.');
                                name = classes.pop();
                                for (var i = 0; i < classes.length; i++) {
                                    cntr = cntr.get(classes[i]) || cntr;
                                }
                            }
                            cntr.set(name, newClass);
                        } catch(e) {
                            assert(!e, `Failed defining class ${name}: ${e}`);
                        }
                        return newClass;
                    });
                    context._G.set('torch', torch);
                    
                    // change require searchers to allow silent failing
                    context._G.get('package').set('searchers', [function() {
                        return () => {};
                    }]);

                    // suppress print messages
                    context._G.set('print', () => {});

                    // Cross compile to js and run
                    bin = context.loadString(exportTestCode);
                    bin();
                });
            }
        });
    });
});
