/*jshint node:true, mocha:true*/

'use strict';
describe('misc utils', function () {
    var testFixture = require('../../globals'),
        path = testFixture.path,
        assert = require('assert'),
        SEED_DIR = testFixture.DF_SEED_DIR,
        fs = require('fs');

    var gmeConfig = testFixture.getGmeConfig(),
        GraphChecker = testFixture.requirejs('deepforge/GraphChecker'),
        MODELS_DIR = path.join(__dirname, '..', 'test-cases', 'models'),
        logger = testFixture.logger.fork('utils'),
        projectName = 'testProject',
        Q = testFixture.Q,
        core,
        rootNode,
        project,
        gmeAuth,
        storage,
        commitHash,
        checker;

    before(async function () {
        gmeAuth = await testFixture.clearDBAndGetGMEAuth(gmeConfig, projectName);
        storage = testFixture.getMemoryStorage(logger, gmeConfig, gmeAuth);
        await storage.openDatabase();
        const importParam = {
            projectSeed: path.join(SEED_DIR, 'devUtilTests', 'devUtilTests.webgmex'),
            projectName: projectName,
            branchName: 'master',
            logger: logger,
            gmeConfig: gmeConfig
        };

        const importResult = await testFixture.importProject(storage, importParam);
        project = importResult.project;
        core = importResult.core;
        checker = new GraphChecker({
            core: core,
            ignore: {
                attributes: ['calculateDimensionality', 'dimensionalityTransform']
            }
        });
        commitHash = importResult.commitHash;
        await project.createBranch('test', commitHash);
        const branchHash = await project.getBranchHash('test');
        const commitObject = await Q.ninvoke(project, 'loadObject', branchHash);
        rootNode = await Q.ninvoke(core, 'loadRoot', commitObject.root);
    });

    after(async function () {
        await storage.closeDatabase();
        await gmeAuth.unload();
    });

    var run = function(nodePath, filename, result, done) {
        var txt = fs.readFileSync(path.join(MODELS_DIR, filename + '.yml'), 'utf8');

        core.loadByPath(rootNode, nodePath)
            .then(node => {
                return core.loadChildren(node);
            })
            .then(children => {
                var mappings = checker.yaml(txt).map.to.gme(children),
                    nodes = children.filter(child => {
                        var ptrs = core.getPointerNames(child);
                        return (ptrs.indexOf('dst') + ptrs.indexOf('src')) === -2;
                    });

                assert.equal(!!mappings, result, 'mappings are ' + JSON.stringify(mappings));

                if (result) {
                    assert.equal(nodes.length, Object.keys(mappings).length,
                        `Missing mappings. Expected ${nodes.length} keys. Found ` +
                        ` ${JSON.stringify(mappings)}`);
                }
            })
            .nodeify(done);
    };

    describe('matching architectures', function() {
        var cases = [
            ['/l', 'concat-parallel-utils'],
            ['/Z', 'concat-y-utils'],
            ['/y', 'concat-y-bad-conn']  // disconnected graph
        ];

        cases.forEach(pair => it('should validate ' + pair[1],
            run.bind(this, pair[0], pair[1], true)));
    });

    describe('mismatching architectures', function() {
        var cases = [
            ['/l', 'concat-y-utils'],
            ['/y', 'concat-parallel-utils'],
            ['/s', 'concat-y-utils']
        ];

        cases.forEach(pair => it('should NOT validate ' + pair[1],
            run.bind(this, pair[0], pair[1], false)));
    });

    describe('ignore option', function() {
        it('should ignore attributes as specified', function(done) {
            core.loadByPath(rootNode, '/Z')
                .then(node => {
                    return core.loadChildren(node);
                })
                .then(children => {
                    var nodes = checker.gme(children).nodes(),
                        violations = nodes.filter(node => node.attributes && node.attributes.calculateDimensionality);

                    assert.equal(violations.length, 0, JSON.stringify(violations[0], null, 2));
                })
                .nodeify(done);
        });
    });
});
