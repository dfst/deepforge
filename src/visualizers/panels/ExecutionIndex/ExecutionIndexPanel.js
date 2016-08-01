/*globals define, _, WebGMEGlobal*/
/*jshint browser: true*/

define([
    'js/PanelBase/PanelBase',
    'js/PanelManager/IActivePanel',
    'widgets/ExecutionIndex/ExecutionIndexWidget',
    './ExecutionIndexControl'
], function (
    PanelBase,
    IActivePanel,
    ExecutionIndexWidget,
    ExecutionIndexControl
) {
    'use strict';

    var ExecutionIndexPanel;

    ExecutionIndexPanel = function (layoutManager, params) {
        var options = {};
        //set properties from options
        options[PanelBase.OPTIONS.LOGGER_INSTANCE_NAME] = 'ExecutionIndexPanel';
        options[PanelBase.OPTIONS.FLOATING_TITLE] = true;

        //call parent's constructor
        PanelBase.apply(this, [options, layoutManager]);

        this._client = params.client;
        this._embedded = params.embedded;

        //initialize UI
        this._initialize();

        this.logger.debug('ctor finished');
    };

    //inherit from PanelBase
    _.extend(ExecutionIndexPanel.prototype, PanelBase.prototype);
    _.extend(ExecutionIndexPanel.prototype, IActivePanel.prototype);

    ExecutionIndexPanel.prototype._initialize = function () {
        //set Widget title
        this.widget = new ExecutionIndexWidget(this.logger, this.$el);

        this.control = new ExecutionIndexControl({
            logger: this.logger,
            client: this._client,
            embedded: this._embedded,
            widget: this.widget
        });

        this.onActivate();
    };

    /* OVERRIDE FROM WIDGET-WITH-HEADER */
    /* METHOD CALLED WHEN THE WIDGET'S READ-ONLY PROPERTY CHANGES */
    ExecutionIndexPanel.prototype.onReadOnlyChanged = function (isReadOnly) {
        //apply parent's onReadOnlyChanged
        PanelBase.prototype.onReadOnlyChanged.call(this, isReadOnly);

    };

    ExecutionIndexPanel.prototype.onResize = function (width, height) {
        this.logger.debug('onResize --> width: ' + width + ', height: ' + height);
        this.widget.onWidgetContainerResize(width, height);
    };

    /* * * * * * * * Visualizer life cycle callbacks * * * * * * * */
    ExecutionIndexPanel.prototype.destroy = function () {
        this.control.destroy();
        this.widget.destroy();

        PanelBase.prototype.destroy.call(this);
        WebGMEGlobal.KeyboardManager.setListener(undefined);
        WebGMEGlobal.Toolbar.refresh();
    };

    ExecutionIndexPanel.prototype.onActivate = function () {
        this.widget.onActivate();
        this.control.onActivate();
        WebGMEGlobal.KeyboardManager.setListener(this.widget);
        WebGMEGlobal.Toolbar.refresh();
    };

    ExecutionIndexPanel.prototype.onDeactivate = function () {
        this.widget.onDeactivate();
        this.control.onDeactivate();
        WebGMEGlobal.KeyboardManager.setListener(undefined);
        WebGMEGlobal.Toolbar.refresh();
    };

    return ExecutionIndexPanel;
});
