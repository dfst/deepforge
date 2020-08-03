/*globals define*/

define([
    './build/TrainDashboard',
    'plugin/GenerateJob/GenerateJob/templates/index',
    'deepforge/Constants',
    'widgets/InteractiveEditor/InteractiveEditorWidget',
    'deepforge/compute/interactive/message',
    'widgets/PlotlyGraph/lib/plotly.min',
    'text!./TrainOperation.py',
    'text!./Main.py',
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
    _,
    SchemaText,
) {
    'use strict';

    const WIDGET_CLASS = 'train-keras';
    const GetTrainCode = _.template(TrainOperation);
    const DashboardSchemas = JSON.parse(SchemaText);

    class TrainKerasWidget extends InteractiveEditor {
        constructor(logger, container) {
            super(container);
            this.dashboard = new TrainDashboard({target: container[0]});
            this.dashboard.initialize(Plotly, DashboardSchemas);
            container.addClass(WIDGET_CLASS);
            this.currentTrainTask = null;
            // TODO: add event for training?
        }

        async onComputeInitialized(session) {
            const initCode = await this.getInitializationCode();
            await session.addFile('utils/init.py', initCode);
            await session.addFile('plotly_backend.py', JobTemplates.MATPLOTLIB_BACKEND);
            await this.session.setEnvVar('MPLBACKEND', 'module://plotly_backend');
            await this.session.addFile('start_train.py', MainCode);
            const config = {
                epochs: 2,
                batchSize: 64,
                lr: 0.05,
                optimizer: 'adam',
                loss: 'categorical_crossentropy',
            };
            this.train(config);
        }

        async train(config) {
            const trainPy = GetTrainCode(config);
            await this.session.addFile('operations/train.py', trainPy);
            // TODO: get the architecture
            if (this.currentTrainTask) {
                // TODO: kill the current task
            }
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
            // TODO: stop the current execution
            // TODO: stream to the console for now
            // TODO: send feedback to the browser...
            // TODO: we could probably use the same matplotlib code to create the plots
        }

        parseMetadata(cmd, content) {
            if (cmd === 'PLOT') {
                console.log(content);
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
            this.dashboard.removeArchitecture(desc.id);
            this.dashboard.addArchitecture(desc);
        }

        removeArchitecture(id) {
            this.dashboard.removeArchitecture(id);
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
