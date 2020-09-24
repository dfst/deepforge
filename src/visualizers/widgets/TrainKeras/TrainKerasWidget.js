/*globals define*/

define([
    './build/TrainDashboard',
    'plugin/GenerateJob/GenerateJob/templates/index',
    'deepforge/Constants',
    'deepforge/storage/index',
    'widgets/InteractiveEditor/InteractiveEditorWidget',
    'deepforge/viz/ConfigDialog',
    'deepforge/compute/interactive/message',
    'webgme-plotly/plotly.min',
    'text!./TrainOperation.py',
    'text!./Main.py',
    'deepforge/viz/StorageHelpers',
    'deepforge/viz/ConfirmDialog',
    'underscore',
    'text!./schemas/index.json',
    'css!./build/TrainDashboard.css',
    'css!./styles/TrainKerasWidget.css',
], function (
    TrainDashboard,
    JobTemplates,
    CONSTANTS,
    Storage,
    InteractiveEditor,
    ConfigDialog,
    Message,
    Plotly,
    TrainOperation,
    MainCode,
    StorageHelpers,
    ConfirmDialog,
    _,
    SchemaText,
) {
    'use strict';

    const WIDGET_CLASS = 'train-keras';
    const GetTrainCode = _.template(TrainOperation);
    const DashboardSchemas = JSON.parse(SchemaText);
    MainCode = _.template(MainCode);

    class TrainKerasWidget extends InteractiveEditor {
        constructor(logger, container) {
            super(container);
            this.dashboard = new TrainDashboard({target: container[0]});
            this.dashboard.initialize(Plotly, DashboardSchemas);
            this.dashboard.events().addEventListener(
                'onTrainClicked',
                () => this.train(this.dashboard.data())
            );
            this.dashboard.events().addEventListener(
                'saveModel',
                event => this.onSaveModel(event.detail)
            );
            this.modelCount = 0;
            container.addClass(WIDGET_CLASS);
            this.currentTrainTask = null;
            this.loadedData = [];
        }

        async onComputeInitialized(session) {
            const initCode = await this.getInitializationCode();
            await session.addFile('utils/init.py', initCode);
            //await session.addFile('utils/query_type.py', QueryTypeCode);
            // TODO: add query_type utility
            await session.addFile('plotly_backend.py', JobTemplates.MATPLOTLIB_BACKEND);
            await session.setEnvVar('MPLBACKEND', 'module://plotly_backend');
        }

        isDataLoaded(dataset) {
            return this.loadedData.find(data => _.isEqual(data, dataset));
        }

        async train(config) {
            if (this.currentTrainTask) {
                const title = 'Stop Current Training';
                const body = 'Would you like to stop the current training to train a model with the new configuration?';
                const dialog = new ConfirmDialog(title, body);
                const confirmed = await dialog.show();

                if (!confirmed) {
                    return;
                }

                this.dashboard.setModelState(this.getCurrentModelID(), 'Canceled');
                await this.session.kill(this.currentTrainTask);
            }

            this.modelCount++;
            const saveName = this.getCurrentModelID();
            const architecture = await this.getNodeSnapshot(config.architecture.id);
            const modelInfo = {
                id: saveName,
                path: saveName,
                name: saveName,
                state: 'Fetching Data...',
                config,
                architecture
            };
            // TODO: save snapshot of architecture
            this.dashboard.addModel(modelInfo);
            const {dataset} = config;
            if (!this.isDataLoaded(dataset)) {
                this.loadedData.push(dataset);
                const auth = await StorageHelpers.getAuthenticationConfig(dataset.dataInfo);
                // TODO: Handle cancellation
                await this.session.addArtifact(dataset.name, dataset.dataInfo, dataset.type, auth);
            }
            this.dashboard.setModelState(this.getCurrentModelID(), 'Generating Code');

            const archCode = await this.getArchitectureCode(config.architecture.id);
            config.loss.arguments.concat(config.optimizer.arguments).forEach(arg => {
                let pyValue = arg.value.toString();
                if (arg.type === 'boolean') {
                    pyValue = arg.value ? 'True' : 'False';
                } else if (arg.type === 'enum') {
                    pyValue = `"${arg.value}"`;
                }
                arg.pyValue = pyValue;
            });
            await this.session.addFile('start_train.py', MainCode({
                dataset,
                path: modelInfo.path,
                archCode
            }));
            const trainPy = GetTrainCode(config);
            await this.session.addFile('operations/train.py', trainPy);
            this.dashboard.setModelState(this.getCurrentModelID(), 'Training...');
            const trainTask = this.session.spawn('python start_train.py');
            this.currentTrainTask = trainTask;
            const lineParser = new LineCollector();
            lineParser.on(line => {
                if (line.startsWith(CONSTANTS.START_CMD)) {
                    line = line.substring(CONSTANTS.START_CMD.length + 1);
                    const splitIndex = line.indexOf(' ');
                    const cmd = line.substring(0, splitIndex);
                    const content = line.substring(splitIndex + 1);
                    this.parseMetadata(cmd, JSON.parse(content));
                }
            });
            this.currentTrainTask.on(Message.STDOUT, data => lineParser.receive(data));
            let stderr = '';
            this.currentTrainTask.on(Message.STDERR, data => stderr += data.toString());
            this.currentTrainTask.on(Message.COMPLETE, exitCode => {
                console.log({exitCode});
                if (exitCode) {  // FIXME: only save the last N lines
                    console.log('ERROR occurred:', stderr);
                    this.dashboard.setModelState(modelInfo.id, 'Error Occurred');
                } else {
                    this.dashboard.setModelState(modelInfo.id);
                    // TODO: Display error?
                    if (this.currentTrainTask === trainTask) {
                        this.currentTrainTask = null;
                    }
                }
            });
        }

        getCurrentModelID() {
            return `model_${this.modelCount}`;
        }

        async promptStorageConfig(name) {
            const metadata = {
                id: 'StorageConfig',
                configStructure: [],
            };
            const storageMetadata = Storage.getAvailableBackends()
                .map(id => Storage.getStorageMetadata(id));

            metadata.configStructure.push({
                name: 'storage',
                displayName: 'Storage',
                description: 'Location to store intermediate/generated data.',
                valueType: 'dict',
                value: Storage.getBackend(Storage.getAvailableBackends()[0]).name,
                valueItems: storageMetadata,
            });

            const configDialog = new ConfigDialog();
            const title = `Select Storage Location for "${name}"`;
            const config = await configDialog.show(metadata, {title});
            const storageName = config[metadata.id].storage.name;
            return {
                id: storageMetadata.find(md => md.name === storageName).id,
                config: config[metadata.id].storage.config,
            };
        }

        async onSaveModel(modelInfo) {
            const storage = await this.promptStorageConfig(modelInfo.name);

            this.dashboard.setModelState(modelInfo.id, 'Uploading...');
            try {
                modelInfo.code = GetTrainCode(modelInfo.config);
                await this.saveModel(modelInfo, storage, this.session);
                this.dashboard.setModelState(modelInfo.id, 'Saved');
            } catch (err) {
                this.dashboard.setModelState(modelInfo.id, 'Error Occurred');
                console.log(err)
                // TODO
            }
        }

        parseMetadata(cmd, content) {
            if (cmd === 'PLOT') {
                this.dashboard.setPlotData(this.getCurrentModelID(), content);
            } else {
                console.error('Unrecognized command:', cmd);
            }
        }

        addNode(desc) {  // FIXME: Remove this
            console.log('adding', desc);
        }

        removeNode(id) {
            console.log('adding', id);
        }

        addArchitecture(desc) {
            this.dashboard.addArchitecture(desc);
        }

        updateArchitecture(desc) {
            this.dashboard.updateArchitecture(desc);
        }

        removeArchitecture(id) {
            this.dashboard.removeArchitecture(id);
        }

        addArtifact(desc) {
            this.dashboard.addArtifact(desc);
        }

        updateArtifact(desc) {
            this.dashboard.updateArtifact(desc);
        }

        removeArtifact(id) {
            this.dashboard.removeArtifact(id);
        }
    }

    class LineCollector {
        constructor() {
            this.currentLine = '';
            this.handler = null;
        }

        on(fn) {
            this.handler = fn;
        }

        receive(data) {
            const text = data.toString();
            const lines = text.split('\n');
            lines.forEach(l => this.handler(l));
            // FIXME
            //const newLine = text.indexOf('\n');
            //let fragment;
            //if (newLine > -1) {
                //const line = this.partialLine + text.substring(0, newLine);
                //this.handler(line);
                //fragment = text.substring(newLine + 1);
                //this.partialLine = '';
            //} else {
                //fragment = text;
            //}
            //this.partialLine += fragment;
        }
    }

    return TrainKerasWidget;
});
