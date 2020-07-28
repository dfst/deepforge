/*globals define*/

define([
    'widgets/InteractiveEditor/InteractiveEditorWidget',
    'deepforge/compute/interactive/message',
    'text!./TrainOperation.py',
    'text!./Main.py',
    'underscore',
    'css!./styles/TrainKerasWidget.css',
], function (
    InteractiveEditor,
    Message,
    TrainOperation,
    MainCode,
    _,
) {
    'use strict';

    const WIDGET_CLASS = 'train-keras';
    const GetTrainCode = _.template(TrainOperation);

    class TrainKerasWidget extends InteractiveEditor {
        constructor(logger, container) {
            super(container);
            container.addClass(WIDGET_CLASS);
            // TODO: Add training dashboard
            // TODO: add event for training?
        }

        async onComputeInitialized(session) {
            const initCode = await this.getInitializationCode();
            await session.addFile('utils/init.py', initCode);
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
            await this.session.addFile('start_train.py', MainCode);
            const task = this.session.spawn('python start_train.py');
            task.on(Message.STDOUT, data => console.log(data.toString()));
            task.on(Message.STDERR, data => console.error(data.toString()));
            // TODO: stop the current execution
            // TODO: stream to the console for now
            // TODO: send feedback to the browser...
            // TODO: we could probably use the same matplotlib code to create the plots
        }

        addNode(desc) {
            console.log('adding', desc);
        }

        removeNode(id) {
            console.log('adding', id);
        }
    }

    return TrainKerasWidget;
});
