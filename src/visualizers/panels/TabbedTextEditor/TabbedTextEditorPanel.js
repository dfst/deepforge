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

        this.widget = new TabbedTextEditorWidget(this.logger, this.$el);
        this.widget.setTitle = title => {
            this.setTitle(title);
        };

        // embedded text editor
        this.editor = new AutoVizPanel(this, this._params);
        this.$editorCntr = this.$el.find('.current-tab-content');
        this.$editorCntr.append(this.editor.$el);

        this.control = new TabbedTextEditorControl({
            logger: this.logger,
            client: this._client,
            editor: this.editor,
            embedded: this._embedded,
            widget: this.widget
        });

        this.onActivate();
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
