/*globals define*/

define([
    './build/TrainDashboard',
    'plugin/GenerateJob/GenerateJob/templates/index',
    'deepforge/Constants',
    'widgets/InteractiveEditor/InteractiveEditorWidget',
    'deepforge/compute/interactive/message',
    'webgme-plotly/plotly.min',
    'text!./TrainOperation.py',
    'text!./Main.py',
    'deepforge/viz/StorageHelpers',
    'underscore',
    'text!./schemas/index.json',
    'css!./build/TrainDashboard.css',
    'css!./styles/TrainKerasWidget.css',
], function (
    TrainDashboard,
    JobTemplates,
    CONSTANTS,
    InteractiveEditor,
    Message,
    Plotly,
    TrainOperation,
    MainCode,
    StorageHelpers,
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
            this.modelCount = 1;
            container.addClass(WIDGET_CLASS);
            this.currentTrainTask = null;
            this.loadedData = [];
        }

        async onComputeInitialized(session) {
            const initCode = await this.getInitializationCode();
            await session.addFile('utils/init.py', initCode);
            await session.addFile('plotly_backend.py', JobTemplates.MATPLOTLIB_BACKEND);
            await this.session.setEnvVar('MPLBACKEND', 'module://plotly_backend');
        }

        isDataLoaded(dataset) {
            return this.loadedData.find(data => _.isEqual(data, dataset));
        }

        async train(config) {
            const {dataset} = config;
            if (!this.isDataLoaded(dataset)) {
                this.loadedData.push(dataset);
                const auth = await StorageHelpers.getAuthenticationConfig(dataset.dataInfo);
                await this.session.addArtifact(dataset.name, dataset.dataInfo, dataset.type, auth);
            }

            if (this.currentTrainTask) {
                await this.session.kill(this.currentTrainTask);
            }

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
            const saveName = `model_${this.modelCount++}`;
            await this.session.addFile('start_train.py', MainCode({dataset, saveName, archCode}));
            const trainPy = GetTrainCode(config);
            await this.session.addFile('operations/train.py', trainPy);
            this.currentTrainTask = this.session.spawn('python start_train.py');
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
            this.currentTrainTask.on(Message.STDERR, data => console.error(data.toString()));
        }

        parseMetadata(cmd, content) {
            if (cmd === 'PLOT') {
                this.dashboard.setPlotData(content);
            } else {
                console.error('Unrecognized command:', cmd);
            }
        }

        addNode(desc) {
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
            this.partialLine = '';
            this.handler = null;
        }

        on(fn) {
            this.handler = fn;
        }

        receive(data) {
            const text = data.toString();
            const lines = text.split('\n');
            lines.forEach(l => this.handler(l));
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
