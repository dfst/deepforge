/*globals define, $, _, WebGMEGlobal*/
/*jshint browser: true*/

define([
    'js/PanelBase/PanelBaseWithHeader',
    'js/PanelManager/IActivePanel',
    'widgets/PipelineEditor/PipelineEditorWidget',
    './PipelineEditorControl'
], function (
    PanelBaseWithHeader,
    IActivePanel,
    PipelineEditorWidget,
    PipelineEditorControl
) {
    'use strict';

    var PipelineEditorPanel;

    PipelineEditorPanel = function (layoutManager, params) {
        var options = {};
        //set properties from options
        options[PanelBaseWithHeader.OPTIONS.LOGGER_INSTANCE_NAME] = 'PipelineEditorPanel';
        options[PanelBaseWithHeader.OPTIONS.FLOATING_TITLE] = true;

        //call parent's constructor
        PanelBaseWithHeader.apply(this, [options, layoutManager]);

        this._client = params.client;
        this._embedded = params.embedded;

        //initialize UI
        this._initialize();

        this.$el.addClass('pipeline-editor');
        this.logger.debug('ctor finished');
    };

    //inherit from PanelBaseWithHeader
    _.extend(PipelineEditorPanel.prototype, PanelBaseWithHeader.prototype);
    _.extend(PipelineEditorPanel.prototype, IActivePanel.prototype);

    PipelineEditorPanel.prototype._initialize = function () {
        var self = this,
            execCntr = $('<div>', {class: 'execution-container'});

        //set Widget title
        this.setTitle('');
        this.$_el.append(execCntr);
        this.$_el.addClass('pipeline-editor');

        this.widget = new PipelineEditorWidget(this.logger, this.$el, execCntr);

        this.widget.setTitle = function (title) {
            self.setTitle(title);
        };

        this.control = new PipelineEditorControl({
            logger: this.logger,
            client: this._client,
            embedded: this._embedded,
            widget: this.widget
        });

        // Editable pipeline name
        this.$panelHeaderTitle.on('click', () => this.editTitle());

        this.onActivate();
    };

    PipelineEditorPanel.prototype.editTitle = function () {
        if (this.control.hasCurrentNode()) {
            this.$panelHeaderTitle.editInPlace({
                css: {
                    'z-index': 1000
                },
                onChange: (oldValue, newValue) => {
                    this.control.onNodeNameChanged(oldValue, newValue);
                }
            });
        }
    };

    /* OVERRIDE FROM WIDGET-WITH-HEADER */
    /* METHOD CALLED WHEN THE WIDGET'S READ-ONLY PROPERTY CHANGES */
    PipelineEditorPanel.prototype.onReadOnlyChanged = function (isReadOnly) {
        //apply parent's onReadOnlyChanged
        PanelBaseWithHeader.prototype.onReadOnlyChanged.call(this, isReadOnly);

    };

    PipelineEditorPanel.prototype.onResize = function (width, height) {
        this.logger.debug('onResize --> width: ' + width + ', height: ' + height);
        this.widget.onWidgetContainerResize(width, height);
    };

    /* * * * * * * * Visualizer life cycle callbacks * * * * * * * */
    PipelineEditorPanel.prototype.destroy = function () {
        this.control.destroy();
        this.widget.destroy();

        PanelBaseWithHeader.prototype.destroy.call(this);
        WebGMEGlobal.KeyboardManager.setListener(undefined);
        WebGMEGlobal.Toolbar.refresh();
    };

    PipelineEditorPanel.prototype.onActivate = function () {
        this.widget.onActivate();
        this.control.onActivate();
        WebGMEGlobal.KeyboardManager.setListener(this.widget);
        WebGMEGlobal.Toolbar.refresh();
    };

    PipelineEditorPanel.prototype.onDeactivate = function () {
        this.widget.onDeactivate();
        this.control.onDeactivate();
        WebGMEGlobal.KeyboardManager.setListener(undefined);
        WebGMEGlobal.Toolbar.refresh();
    };

    return PipelineEditorPanel;
});
