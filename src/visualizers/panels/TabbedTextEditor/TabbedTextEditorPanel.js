/*globals define, _, WebGMEGlobal*/

define([
    'js/PanelBase/PanelBaseWithHeader',
    'js/PanelManager/IActivePanel',
    'widgets/TabbedTextEditor/TabbedTextEditorWidget',
    'panels/AutoViz/AutoVizPanel',
    './TabbedTextEditorControl'
], function (
    PanelBaseWithHeader,
    IActivePanel,
    TabbedTextEditorWidget,
    AutoVizPanel,
    TabbedTextEditorControl
) {
    'use strict';

    var TabbedTextEditorPanel;

    TabbedTextEditorPanel = function (layoutManager, params) {
        var options = {};
        //set properties from options
        options[PanelBaseWithHeader.OPTIONS.LOGGER_INSTANCE_NAME] = 'TabbedTextEditorPanel';
        options[PanelBaseWithHeader.OPTIONS.FLOATING_TITLE] = true;

        //call parent's constructor
        PanelBaseWithHeader.apply(this, [options, layoutManager]);

        this._layoutManager = layoutManager;
        this._params = params;

        this._client = params.client;
        this._embedded = params.embedded;

        //initialize UI
        this._initialize();

        this.logger.debug('ctor finished');
    };

    //inherit from PanelBaseWithHeader
    _.extend(TabbedTextEditorPanel.prototype, PanelBaseWithHeader.prototype);
    _.extend(TabbedTextEditorPanel.prototype, IActivePanel.prototype);

    TabbedTextEditorPanel.prototype._initialize = function () {
        //set Widget title
        this.setTitle('');

        this.$el.css('height', '100%');
        this.widget = new TabbedTextEditorWidget(
            this.logger,
            this.$el,
            this.getWidgetConfig()
        );
        this.widget.setTitle = title => {
            this.setTitle(title);
        };

        this.$editorCntr = this.$el.find('.current-tab-content');
        this.setEditorPanel(AutoVizPanel);

        this.control = this.getController();
        this.control.setEditorNode = this.setEditorNode.bind(this);
        this.control.setEditor = this.setEditorPanel.bind(this);

        this.onActivate();
    };

    TabbedTextEditorPanel.prototype.getWidgetConfig = function () {
        return null;
    };

    TabbedTextEditorPanel.prototype.getController = function () {
        return new TabbedTextEditorControl({
            logger: this.logger,
            client: this._client,
            embedded: this._embedded,
            widget: this.widget
        });
    };

    TabbedTextEditorPanel.prototype.setEditorNode = function (nodeId) {
        const controller = this.editor.selectedObjectChanged ? this.editor :
            this.editor.control;
        controller.selectedObjectChanged(nodeId);
    };

    TabbedTextEditorPanel.prototype.setEditorPanel = function (PanelClass) {
        if (this.editor) {
            this.editor.destroy();
            this.$editorCntr.empty();
        }

        this.editor = new PanelClass(this, this._params);
        this.$editorCntr.append(this.editor.$el);

        const isDisplayed = this.width && this.height;
        if (isDisplayed) {
            this.onResize(this.width, this.height);
        }
    };

    TabbedTextEditorPanel.prototype.addPanel = function (name, panel) {
        this.$editorCntr.append(panel.$pEl);
        panel.setSize(this.width-2, this.height-1);
        panel.afterAppend();
    };

    /* OVERRIDE FROM WIDGET-WITH-HEADER */
    /* METHOD CALLED WHEN THE WIDGET'S READ-ONLY PROPERTY CHANGES */
    TabbedTextEditorPanel.prototype.onReadOnlyChanged = function (isReadOnly) {
        //apply parent's onReadOnlyChanged
        PanelBaseWithHeader.prototype.onReadOnlyChanged.call(this, isReadOnly);

    };

    TabbedTextEditorPanel.prototype.onResize = function (width, height) {
        this.width = width;
        this.height = height;
        this.widget.onWidgetContainerResize(width, height);
        this.editor.onResize(this.width-2, this.height-1);
    };

    /* * * * * * * * Visualizer life cycle callbacks * * * * * * * */
    TabbedTextEditorPanel.prototype.destroy = function () {
        this.control.destroy();
        this.widget.destroy();

        PanelBaseWithHeader.prototype.destroy.call(this);
        WebGMEGlobal.KeyboardManager.setListener(undefined);
        WebGMEGlobal.Toolbar.refresh();
    };

    TabbedTextEditorPanel.prototype.onActivate = function () {
        this.widget.onActivate();
        this.control.onActivate();
        WebGMEGlobal.KeyboardManager.setListener(this.widget);
        WebGMEGlobal.Toolbar.refresh();
    };

    TabbedTextEditorPanel.prototype.onDeactivate = function () {
        this.widget.onDeactivate();
        this.control.onDeactivate();
        WebGMEGlobal.KeyboardManager.setListener(undefined);
        WebGMEGlobal.Toolbar.refresh();
    };

    return TabbedTextEditorPanel;
});
