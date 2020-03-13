/*globals define*/
define([
    'js/PanelBase/PanelBaseWithHeader',
    'panels/TabbedTextEditor/TabbedTextEditorPanel',
    './OperationSecondaryEditorControl'
], function (
    PanelBaseWithHeader,
    TabbedTextPanel,
    OperationSecondaryEditorControl
) {
    'use strict';

    function OperationSecondaryEditorPanel(layoutManager, params) {
        var options = {};
        //set properties from options
        options[PanelBaseWithHeader.OPTIONS.LOGGER_INSTANCE_NAME] = 'OperationSecondaryEditorPanel';
        options[PanelBaseWithHeader.OPTIONS.FLOATING_TITLE] = true;

        PanelBaseWithHeader.apply(this, [options, layoutManager]);

        this._layoutManager = layoutManager;
        this._params = params;

        this._client = params.client;
        this._embedded = params.embedded;

        this._initialize();

        this.logger.debug('ctor finished');
    }

    OperationSecondaryEditorPanel.prototype = Object.create(TabbedTextPanel.prototype);

    OperationSecondaryEditorPanel.prototype.getWidgetConfig = function () {
        return {
            canCreateTabs: false
        };
    };

    OperationSecondaryEditorPanel.prototype.getController = function () {
        return new OperationSecondaryEditorControl({
            logger: this.logger,
            client: this._client,
            embedded: this._embedded,
            widget: this.widget
        });
    };

    return OperationSecondaryEditorPanel;
});
