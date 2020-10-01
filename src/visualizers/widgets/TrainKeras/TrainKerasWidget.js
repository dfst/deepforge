/*globals define */

define([
    './build/TrainDashboard',
    'deepforge/storage/index',
    'widgets/InteractiveEditor/InteractiveEditorWidget',
    'deepforge/viz/ConfigDialog',
    'webgme-plotly/plotly.min',
    'deepforge/viz/StorageHelpers',
    'deepforge/viz/ConfirmDialog',
    'deepforge/viz/InformDialog',
    'underscore',
    'text!./schemas/index.json',
    'css!./build/TrainDashboard.css',
    'css!./styles/TrainKerasWidget.css',
], function (
    TrainDashboard,
    Storage,
    InteractiveEditor,
    ConfigDialog,
    Plotly,
    StorageHelpers,
    ConfirmDialog,
    InformDialog,
    _,
    SchemaText,
) {
    'use strict';

    const WIDGET_CLASS = 'train-keras';
    const DashboardSchemas = JSON.parse(SchemaText);

    class TrainKerasWidget extends InteractiveEditor {
        constructor(logger, container) {
            super(container);
            this.dashboard = new TrainDashboard({target: container[0]});
            this.dashboard.initialize(Plotly, DashboardSchemas);
            this.dashboard.events().addEventListener(
                'onTrainClicked',
                () => this.onTrainClicked()
            );
            this.dashboard.events().addEventListener(
                'saveModel',
                event => this.onSaveModel(event.detail)
            );
            this.dashboard.events().addEventListener(
                'showModelInfo',
                event => this.onShowModelInfo(event.detail)
            );
            container.addClass(WIDGET_CLASS);
            this.loadedData = [];
        }

        isDataLoaded(dataset) {
            return this.loadedData.find(data => _.isEqual(data, dataset));
        }

        async onTrainClicked() {
            if (this.isTrainingModel()) {
                const title = 'Stop Current Training';
                const body = 'Would you like to stop the current training to train a model with the new configuration?';
                const dialog = new ConfirmDialog(title, body);
                const confirmed = await dialog.show();

                if (!confirmed) {
                    return;
                }

                this.dashboard.setModelState(this.getCurrentModelID(), 'Canceled');
                await this.stopCurrentTask();
            }

            const config = this.dashboard.data();
            const {dataset} = config;
            const modelInfo = await this.createModelInfo(config);
            modelInfo.state = 'Fetching Data';
            this.dashboard.addModel(modelInfo);

            if (!this.isDataLoaded(dataset)) {
                this.loadedData.push(dataset);
                const auth = await StorageHelpers.getAuthenticationConfig(dataset.dataInfo);
                await this.addArtifact(dataset, auth);
            }

            const createTrainTask = this.train(modelInfo);
            createTrainTask.on(
                'update',
                status => this.dashboard.setModelState(modelInfo.id, status)
            );
            createTrainTask.on(
                'plot',
                plotData => this.dashboard.setPlotData(modelInfo.id, plotData)
            );
            createTrainTask.on(
                'error',
                stderr => this.dashboard.setModelState(modelInfo.id, 'Error Occurred', stderr)
            );
            createTrainTask.on(
                'end',
                () => this.dashboard.setModelState(modelInfo.id)
            );
            await createTrainTask;
        }

        async onShowModelInfo(modelInfo) {
            let body = (modelInfo.info || '').replace(/\n/g, '<br/>');
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
                await this.saveModel(modelInfo, storage);
                this.dashboard.setModelState(modelInfo.id, 'Saved');
            } catch (err) {
                this.dashboard.setModelState(
                    modelInfo.id,
                    'Save Failed',
                    err.stack
                );
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
