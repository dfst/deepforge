/*globals define */

define([
    'panels/InteractiveEditor/InteractiveEditorPanel',
    'widgets/InteractiveExplorer/InteractiveExplorerWidget',
    './InteractiveExplorerControl',
], function (
    InteractiveEditorPanel,
    InteractiveExplorerWidget,
    InteractiveExplorerControl,
) {
    'use strict';

    class InteractiveExplorerPanel extends InteractiveEditorPanel {

        initialize() {
            this.setTitle('');
            this.widget = new InteractiveExplorerWidget(this.logger, this.$el);
            this.widget.setTitle = title => this.setTitle(title);

            this.control = new InteractiveExplorerControl({
                logger: this.logger,
                client: this._client,
                embedded: this._embedded,
                widget: this.widget
            });

            this.onActivate();
        }
    }

    return InteractiveExplorerPanel;
});
