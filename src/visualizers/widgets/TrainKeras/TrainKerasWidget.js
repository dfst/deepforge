/*globals define */

define([
    './build/TrainDashboard',
    'plugin/GenerateJob/GenerateJob/templates/index',
    'deepforge/Constants',
    'deepforge/storage/index',
    'widgets/InteractiveEditor/InteractiveEditorWidget',
    'deepforge/viz/ConfigDialog',
    'deepforge/compute/interactive/message',
    'deepforge/compute/line-collector',
    'webgme-plotly/plotly.min',
    'text!./TrainOperation.py',
    'text!./Main.py',
    'deepforge/viz/StorageHelpers',
    'deepforge/viz/ConfirmDialog',
    'deepforge/viz/InformDialog',
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
    LineCollector,
    Plotly,
    TrainOperation,
    MainCode,
    StorageHelpers,
    ConfirmDialog,
    InformDialog,
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
            this.dashboard.events().addEventListener(
                'showModelInfo',
                event => this.onShowModelInfo(event.detail)
            );
            this.modelCount = 0;
            container.addClass(WIDGET_CLASS);
            this.currentTrainTask = null;
            this.loadedData = [];
        }

        async onComputeInitialized(session) {
            const initCode = await this.getInitializationCode();
            await session.addFile('utils/init.py', initCode);
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
            this.dashboard.addModel(modelInfo);
            const {dataset} = config;
            if (!this.isDataLoaded(dataset)) {
                this.loadedData.push(dataset);
                const auth = await StorageHelpers.getAuthenticationConfig(dataset.dataInfo);
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
            this.currentTrainTask.on(Message.STDOUT, data => {
                let line = data.toString();
                if (line.startsWith(CONSTANTS.START_CMD)) {
                    line = line.substring(CONSTANTS.START_CMD.length + 1);
                    const splitIndex = line.indexOf(' ');
                    const cmd = line.substring(0, splitIndex);
                    const content = line.substring(splitIndex + 1);
                    this.parseMetadata(cmd, JSON.parse(content));
                }
            });
            let stderr = '';
            this.currentTrainTask.on(Message.STDERR, data => stderr += data.toString());
            this.currentTrainTask.on(Message.COMPLETE, exitCode => {
                if (exitCode) {
                    this.dashboard.setModelState(modelInfo.id, 'Error Occurred', stderr);
                } else {
                    this.dashboard.setModelState(modelInfo.id);
                }
                if (this.currentTrainTask === trainTask) {
                    this.currentTrainTask = null;
                }
            });
        }

        async onShowModelInfo(modelInfo) {
            let body = modelInfo.info.replace(/\n/g, '<br/>');
            const isSaveError = modelInfo.state === 'Save Failed';
            if (isSaveError) {
                body += '<br/><br/>Would you like to clear this error?';
                const dialog = new ConfirmDialog(modelInfo.state, body);
                const confirmed = await dialog.show();
                if (confirmed) {
                    this.dashboard.setModelState(modelInfo.id);
                }
            } else {
                const dialog = new InformDialog(
                    modelInfo.state,
                    body
                );
                dialog.show();
            }
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
                this.dashboard.setModelState(
                    modelInfo.id,
                    'Save Failed',
                    err.stack
                );
            }
        }

        parseMetadata(cmd, content) {
            if (cmd === 'PLOT') {
                this.dashboard.setPlotData(this.getCurrentModelID(), content);
            } else {
                console.error('Unrecognized command:', cmd);
            }
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

        addNode(artifactDesc) {
            this.dashboard.addArtifact(artifactDesc);
        }

        updateNode(artifactDesc) {
            this.dashboard.updateArtifact(artifactDesc);
        }

        removeNode(artifactId) {
            this.dashboard.removeArtifact(artifactId);
        }
    }

    return TrainKerasWidget;
});
