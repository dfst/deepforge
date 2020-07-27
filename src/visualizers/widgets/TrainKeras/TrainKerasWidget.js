/*globals define, WebGMEGlobal*/

define([
    'widgets/InteractiveEditor/InteractiveEditorWidget',
    'css!./styles/TrainKerasWidget.css',
], function (
    InteractiveEditor,
) {
    'use strict';

    const WIDGET_CLASS = 'train-keras';

    class TrainKerasWidget extends InteractiveEditor {
        constructor(logger, container) {
            super(container);
            container.addClass(WIDGET_CLASS);
        }
    }

    return TrainKerasWidget;
});
