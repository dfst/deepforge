describe('FigureExtractor', function() {
    const testFixture = require('../../../globals');
    const assert = require('assert');
    const fs = require('fs');
    const path = require('path');
    const FigureExtractor = testFixture.requirejs('deepforge/viz/FigureExtractor').CoreFigureExtractor;
    const gmeConfig = testFixture.getGmeConfig();
    const logger = testFixture.logger.fork('FigureExtractor');
    const GRAPH_NODE_PATH = '/K/n/d/2';
    const REFERENCE_JSON = path.resolve(__dirname, 'FigureReference.json');
    let project,
        gmeAuth,
        storage,
        commitHash,
        rootNode,
        core,
        graphNode,
        figureExtractor;

    before(async function () {
        const projectName = 'testProject';
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
        core = importResult.core;
        rootNode = importResult.rootNode;
        await project.createBranch('test', commitHash);
        graphNode = await core.loadByPath(rootNode, GRAPH_NODE_PATH);
        figureExtractor =  new FigureExtractor(core, graphNode);
    });

    it('should convert graphNode to JSON', async () => {
        const graphNodeJSON = await figureExtractor.toJSON(graphNode);
        graphNodeJSON.children.forEach(child => {
            assert(graphNodeJSON === child.parent);
        });
    });

    it('should convert graphNode to desc', async () => {
        const exportedJSON = JSON.parse(JSON.stringify(await figureExtractor.extract(graphNode)));
        const referenceJSON = JSON.parse(fs.readFileSync(REFERENCE_JSON));
        assert.deepStrictEqual(exportedJSON, referenceJSON);
    });

    after(async function () {
        await storage.closeDatabase();
        await gmeAuth.unload();
    });

});
