/*globals define, _, WebGMEGlobal*/

define([
    'js/PanelBase/PanelBaseWithHeader',
    'js/PanelManager/IActivePanel',
], function (
    PanelBaseWithHeader,
    IActivePanel,
) {
    'use strict';

    function InteractiveEditorPanel(options, params) {
        const panelOptions = {};
        //set properties from options
        panelOptions[PanelBaseWithHeader.OPTIONS.LOGGER_INSTANCE_NAME] = name + 'Panel';

        //call parent's constructor
        PanelBaseWithHeader.call(this, panelOptions);

        this._client = params.client;
        this._embedded = params.embedded;
        this.session = params.session;

        this.initialize(options);

        this.logger.debug('ctor finished');
    }

    //inherit from PanelBaseWithHeader
    _.extend(InteractiveEditorPanel.prototype, PanelBaseWithHeader.prototype);
    _.extend(InteractiveEditorPanel.prototype, IActivePanel.prototype);

    InteractiveEditorPanel.prototype.initialize = function (options) {
        const {Control, Widget} = options;
        var self = this;

        //set Widget title
        this.setTitle('');

        this.widget = new Widget(this.logger, this.$el);

        this.widget.setTitle = function (title) {
            self.setTitle(title);
        };

        this.control = new Control({
            logger: this.logger,
            client: this._client,
            embedded: this._embedded,
            widget: this.widget,
            session: this.session,
        });

        this.onActivate();
    };

    /* OVERRIDE FROM WIDGET-WITH-HEADER */
    /* METHOD CALLED WHEN THE WIDGET'S READ-ONLY PROPERTY CHANGES */
    InteractiveEditorPanel.prototype.onReadOnlyChanged = function (isReadOnly) {
        //apply parent's onReadOnlyChanged
        PanelBaseWithHeader.prototype.onReadOnlyChanged.call(this, isReadOnly);

    };

    InteractiveEditorPanel.prototype.onResize = function (width, height) {
        this.logger.debug('onResize --> width: ' + width + ', height: ' + height);
        this.widget.onWidgetContainerResize(width, height);
    };

    /* * * * * * * * Visualizer life cycle callbacks * * * * * * * */
    InteractiveEditorPanel.prototype.destroy = function () {
        this.control.destroy();
        this.widget.destroy();

        PanelBaseWithHeader.prototype.destroy.call(this);
        WebGMEGlobal.KeyboardManager.setListener(undefined);
        WebGMEGlobal.Toolbar.refresh();
    };

    InteractiveEditorPanel.prototype.onActivate = function () {
        this.widget.onActivate();
        this.control.onActivate();
        WebGMEGlobal.KeyboardManager.setListener(this.widget);
        WebGMEGlobal.Toolbar.refresh();
    };

    InteractiveEditorPanel.prototype.onDeactivate = function () {
        this.widget.onDeactivate();
        this.control.onDeactivate();
        WebGMEGlobal.KeyboardManager.setListener(undefined);
        WebGMEGlobal.Toolbar.refresh();
    };

    return InteractiveEditorPanel;
});
