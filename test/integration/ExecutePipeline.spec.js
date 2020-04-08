/* globals */
describe('Pipeline execution', function () {
    this.timeout(15000);
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

    const projectName = `testProject_${Date.now()}`;
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
    Pipeline.ScatterPlots3D = '/f/5';

    const server = new testFixture.WebGME.standaloneServer(gmeConfig);
    server.start = promisify(server.start);
    server.stop = promisify(server.stop);

    before(async function () {
        this.timeout(20000);
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

    describe('pipelines', function() {
        let StorageConfigs, ComputeConfigs;
        before(async () => {
            this.timeout(4000);
            StorageConfigs = await testFixture.getStorageConfigs();
            ComputeConfigs = await testFixture.getComputeConfigs();
        });

        beforeEach(clearStorageData);
        after(clearStorageData);

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
            // s3 config for this fixture points to a server running in localhost,
            // and the artifacts are not accessible in sciserver-compute environment
            const computeOptions = storage === 'gme' || storage === 's3' ?
                ['local', 'gme'] : computeBackends;

            computeOptions.forEach(compute => {
                const activeNode = compute === 'gme' || compute === 'local' ?
                    Pipeline.SmallPipeline : Pipeline.SimpleOutput;
                it(`should execute on ${compute} with ${storage} storage`, async function() {
                    this.timeout(maxDuration(compute, storage));
                    this.retries(maxRetries(compute, storage));
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

                    try {
                        await executePlugin(config, context);
                    } catch (err) {
                        const isFileExistsErr = err instanceof Error &&
                            err.message.includes('File already exists');
                        if (!isFileExistsErr) {
                            throw err;
                        }
                    }
                });
            });
        });

        async function clearStorageData() {
            const sciServerFilesConfig = StorageConfigs['sciserver-files'];
            const s3StorageConfig = StorageConfigs['s3'];
            const sciServerFilesClient = await Storage.getClient('sciserver-files', logger, sciServerFilesConfig);
            const s3StorageClient = await Storage.getClient('s3', logger, s3StorageConfig);
            await sciServerFilesClient.deleteDir(project.projectId)
                .catch(nop);
            await s3StorageClient.deleteDir(project.projectId)
                .catch(nop);
        }
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
        const workerBin = require.resolve('deepforge-worker');
        const args = [ workerBin, '-H', url ];
        const subprocess = spawn('node', args);
        const connect = resolve => {
            let stdout = '';
            subprocess.stdout.on('data', data => {
                if (stdout !== null) {
                    stdout += data.toString();
                    if (stdout.includes('Connected')) {
                        stdout = null;
                        return resolve();
                    }
                }
            });
        };
        await new Promise(connect);
        return subprocess;
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

    function maxRetries(compute, storage) {
        /*
         * SciServer current has an issue in our CI where it periodically fails
         * when fetching files with status code 406. The body of the request is
         * {"size": 0, "timeout": 0}.
         */
        if (storage.startsWith('sciserver')) {
            return 3;
        }
        return 1;
    }

    function nop(){}
});
