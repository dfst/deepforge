/* globals */
describe('Pipeline execution', function () {
    this.timeout(5000);
    const {promisify} = require('util');
    const {spawn} = require('child_process');
    const testFixture = require('../globals');
    const {path, requirejs} = testFixture;
    const gmeConfig = testFixture.getGmeConfig();
    const Storage = requirejs('deepforge/storage/index');
    const Compute = requirejs('deepforge/compute/index');
    const logger = testFixture.logger.fork('ExecutePipeline');
    const PluginNodeManager = require('webgme-engine/src/plugin/nodemanager');
    const manager = new PluginNodeManager(null, null, logger, gmeConfig);

    const projectName = 'testProject';
    const pluginName = 'ExecutePipeline';
    let project,
        gmeAuth,
        storage,
        plugin,
        commitHash,
        worker;

    manager.executePlugin = promisify(manager.executePlugin);
    manager.runPluginMain = promisify(manager.runPluginMain);

    const Pipeline = {};
    Pipeline.HelloWorld = '/f/h';
    Pipeline.SimpleIO = '/f/x';
    Pipeline.SimpleOutput = '/f/X';
    Pipeline.SmallPipeline = '/f/d';
    Pipeline.ComplexPipeline = '/f/3';
    Pipeline.ExportPlugin = '/f/s';

    const server = new testFixture.WebGME.standaloneServer(gmeConfig);
    server.start = promisify(server.start);
    server.stop = promisify(server.stop);

    before(async function () {
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
        worker = await startWorker();
    });

    after(async function () {
        await storage.closeDatabase();
        await gmeAuth.unload();
        await server.stop();
        worker.kill();
    });

    const storageBackends = Storage.getAvailableBackends();
    const computeBackends = Compute.getAvailableBackends();

    describe.only('pipelines', function() {
        let StorageConfigs, ComputeConfigs;
        before(async () => {
            this.timeout(4000);
            StorageConfigs = await testFixture.getStorageConfigs();
            ComputeConfigs = await testFixture.getComputeConfigs();
        });

        beforeEach(async () => {
            const config = StorageConfigs['sciserver-files'];
            const client = await Storage.getClient('sciserver-files', logger, config);
            const nop = () => {};
            await client.deleteDir(project.projectId)
                .catch(nop);
        });

        const config = {
            compute: {id: 'local'},
            storage: {id: 'gme'},
        };

        Object.entries(Pipeline).forEach(entry => {
            const [name, nodeId] = entry;
            it(`should run ${name} pipeline`, async function() {
                const context = {
                    project: project,
                    commitHash: commitHash,
                    namespace: 'pipeline',
                    branchName: 'test',
                    activeNode: nodeId,
                };

                await executePlugin(config, context);
            });
        });

        storageBackends.forEach(storage => {
            // GME storage does not yet support remote execution (issue #1357)
            const computeOptions = storage === 'gme' ?
                ['local', 'gme'] : computeBackends;

            computeOptions.forEach(compute => {
                const activeNode = compute === 'gme' || compute === 'local' ?
                    Pipeline.SmallPipeline : Pipeline.SimpleOutput;
                it(`should execute on ${compute} with ${storage} storage`, async function() {
                    this.timeout(maxDuration(compute, storage));
                    const config = {
                        storage: {
                            id: storage,
                            config: StorageConfigs[storage],
                        },
                        compute: {
                            id: compute,
                            config: ComputeConfigs[compute],
                        },
                    };
                    const context = {
                        project: project,
                        commitHash: commitHash,
                        namespace: 'pipeline',
                        branchName: 'test',
                        activeNode: activeNode,
                    };

                    await executePlugin(config, context);
                });
            });
        });
    });

    async function executePlugin(config, context) {
        const plugin = await preparePlugin(config, context);
        return await manager.runPluginMain(plugin);
    }

    async function preparePlugin(config, context) {
        plugin = await manager.initializePlugin(pluginName);
        plugin.executionId = Promise.resolve('some_execution_id');
        await manager.configurePlugin(plugin, config, context);
        return plugin;
    }

    async function startWorker() {
        const url = `http://localhost:${gmeConfig.server.port}`;
        const workerScript = path.join(testFixture.PROJECT_ROOT, 'bin', 'start-worker.js');
        const subprocess = spawn('node', [workerScript, url]);
        return new Promise(resolve => {
            let stdout = '';
            subprocess.stdout.on('data', data => {
                if (stdout !== null) {
                    stdout += data.toString();
                    if (stdout.includes(`Connected to ${url}`)) {
                        stdout = null;
                        return resolve(subprocess);
                    }
                }
            });
        });
    }

    function maxDuration(compute) {
        const seconds = 1000;
        const minutes = 60*seconds;
        if (compute.startsWith('sciserver')) {
            return 5*minutes;
        } else if (compute === 'gme'){
            return 30*seconds;
        } else {
            return 15*seconds;
        }
    }
});
