/*globals define */

define([
    'widgets/InteractiveEditor/InteractiveEditorWidget',
    'css!./styles/InteractiveExplorerWidget.css',
], function (
    InteractiveEditorWidget,
) {
    'use strict';

    class InteractiveExplorerWidget extends InteractiveEditorWidget {

        getCapabilities() {
            return {
                suspend: this.isOveridden('getEditorState') &&
                    this.isOveridden('resume'),
                save: this.isOveridden('getSnapshot'),
                provenance: this.isOveridden('getEditorState') &&
                this.isOveridden('getOperation'),
            };
        }
    }

    return InteractiveExplorerWidget;
});
