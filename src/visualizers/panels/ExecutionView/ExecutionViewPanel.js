/*globals define, $, _, WebGMEGlobal*/
/*jshint browser: true*/

define([
    'js/PanelBase/PanelBaseWithHeader',
    'js/PanelManager/IActivePanel',
    'widgets/ExecutionView/ExecutionViewWidget',
    './ExecutionViewControl'
], function (
    PanelBaseWithHeader,
    IActivePanel,
    ExecutionViewWidget,
    ExecutionViewControl
) {
    'use strict';

    var ExecutionViewPanel;

    ExecutionViewPanel = function (layoutManager, params) {
        var options = {};
        //set properties from options
        options[PanelBaseWithHeader.OPTIONS.LOGGER_INSTANCE_NAME] = 'ExecutionViewPanel';
        options[PanelBaseWithHeader.OPTIONS.FLOATING_TITLE] = true;

        //call parent's constructor
        PanelBaseWithHeader.apply(this, [options, layoutManager]);

        this._client = params.client;
        this._embedded = params.embedded;

        //initialize UI
        this._initialize();

        this.logger.debug('ctor finished');
    };

    //inherit from PanelBaseWithHeader
    _.extend(ExecutionViewPanel.prototype, PanelBaseWithHeader.prototype);
    _.extend(ExecutionViewPanel.prototype, IActivePanel.prototype);

    ExecutionViewPanel.prototype._initialize = function () {
        var self = this,
            footer = $('<div>', {class: 'footer-caption-container'});

        this.$_el.append(footer);

        //set Widget title
        this.setTitle('');

        this.widget = new ExecutionViewWidget(this.logger, this.$el);

        this.widget._setTitle = function (title) {
            self.setTitle(title);
        };

        this.widget.getFooterContainer = function () {
            return footer;
        };

        this.control = new ExecutionViewControl({
            logger: this.logger,
            client: this._client,
            embedded: this._embedded,
            widget: this.widget
        });

        footer.on('click', this.control.onOriginClicked.bind(this.control));
        this.onActivate();
    };

    /* OVERRIDE FROM WIDGET-WITH-HEADER */
    /* METHOD CALLED WHEN THE WIDGET'S READ-ONLY PROPERTY CHANGES */
    ExecutionViewPanel.prototype.onReadOnlyChanged = function (isReadOnly) {
        //apply parent's onReadOnlyChanged
        PanelBaseWithHeader.prototype.onReadOnlyChanged.call(this, isReadOnly);
        this.control.readOnly = isReadOnly;
    };

    ExecutionViewPanel.prototype.onResize = function (width, height) {
        this.logger.debug('onResize --> width: ' + width + ', height: ' + height);
        this.widget.onWidgetContainerResize(width, height);
    };

    /* * * * * * * * Visualizer life cycle callbacks * * * * * * * */
    ExecutionViewPanel.prototype.destroy = function () {
        this.control.destroy();
        this.widget.destroy();

        PanelBaseWithHeader.prototype.destroy.call(this);
        WebGMEGlobal.KeyboardManager.setListener(undefined);
        WebGMEGlobal.Toolbar.refresh();
    };

    ExecutionViewPanel.prototype.onActivate = function () {
        this.widget.onActivate();
        this.control.onActivate();
        WebGMEGlobal.KeyboardManager.setListener(this.widget);
        WebGMEGlobal.Toolbar.refresh();
    };

    ExecutionViewPanel.prototype.onDeactivate = function () {
        this.widget.onDeactivate();
        this.control.onDeactivate();
        WebGMEGlobal.KeyboardManager.setListener(undefined);
        WebGMEGlobal.Toolbar.refresh();
    };

    return ExecutionViewPanel;
});
