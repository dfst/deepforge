/*globals define, $, _, WebGMEGlobal*/
/*jshint browser: true*/

// The main panel shows the PipelineIndex w/ a bar on the left for viewing architectures
// and pipelines
define([
    'js/PanelBase/PanelBaseWithHeader',
    'js/PanelManager/IActivePanel',
    'widgets/MainView/MainViewWidget',
    './MainViewControl',
    'panels/PipelineIndex/PipelineIndexPanel',
    'panels/ExecutionIndex/ExecutionIndexPanel',
    'deepforge/globals'
], function (
    PanelBaseWithHeader,
    IActivePanel,
    MainViewWidget,
    MainViewControl,
    PipelineIndexPanel,
    ExecutionIndexPanel,
    DeepForge
) {
    'use strict';

    var MainViewPanel;

    MainViewPanel = function (layoutManager, params) {
        var options = {};
        //set properties from options
        options[PanelBaseWithHeader.OPTIONS.LOGGER_INSTANCE_NAME] = 'MainViewPanel';
        options[PanelBaseWithHeader.OPTIONS.FLOATING_TITLE] = true;

        //call parent's constructor
        PanelBaseWithHeader.apply(this, [options, layoutManager]);

        this._client = params.client;
        this._embedded = params.embedded;

        //initialize UI
        this.$nav = $('<div>', {id: 'nav-container'});
        this.$el.css({padding: 0});

        this.embeddedPanels = [
            PipelineIndexPanel,
            ExecutionIndexPanel
        ];
        this.nextPanelIndex = 0;
        this._lm = layoutManager;
        this._params = params;
        this.$el.append(this.$nav);
        this._initialize();

        this.logger.debug('ctor finished');
    };

    //inherit from PanelBaseWithHeader
    _.extend(MainViewPanel.prototype, PanelBaseWithHeader.prototype);
    _.extend(MainViewPanel.prototype, IActivePanel.prototype);

    MainViewPanel.prototype._initialize = function () {
        //set Widget title
        this.setTitle('');

        this.widget = new MainViewWidget(this.logger, this.$nav);

        this.control = new MainViewControl({
            logger: this.logger,
            client: this._client,
            embedded: this._embedded,
            widget: this.widget
        });

        this.control.toggleEmbeddedPanel = this.toggleEmbeddedPanel.bind(this);
        var selectedObjectChanged = this.control.selectedObjectChanged;
        this.control.selectedObjectChanged = id => {
            this.getEmbeddedNode().then(nodeId =>
                this.embeddedPanel.control.selectedObjectChanged(nodeId));
            selectedObjectChanged.call(this.control, id);
        };

        this.toggleEmbeddedPanel(true);
        this.onActivate();
    };

    MainViewPanel.prototype.getEmbeddedNode = function() {
        if (this.nextPanelIndex === 1) {
            return DeepForge.places.MyPipelines();
        } else {
            return DeepForge.places.MyExecutions();
        }
    };

    MainViewPanel.prototype.toggleEmbeddedPanel = function (silent) {
        var Panel = this.embeddedPanels[this.nextPanelIndex];
        this.nextPanelIndex = (this.nextPanelIndex + 1) % this.embeddedPanels.length;

        if (this.embeddedPanel) {  // Remove current
            this.embeddedPanel.destroy();
            this.$embedded.remove();
        }

        this.embeddedPanel = new Panel(this._lm, this._params);
        this.$embedded = this.embeddedPanel.$el;
        this.$embedded.addClass('main-view-embedded');
        this.$el.append(this.$embedded);

        // Call on Resize and selectedObjectChanged
        this.onResize(this.width, this.height);
        if (!silent) {
            this.getEmbeddedNode().then(nodeId =>
                this.embeddedPanel.control.selectedObjectChanged(nodeId));
        }
    };

    /* OVERRIDE FROM WIDGET-WITH-HEADER */
    /* METHOD CALLED WHEN THE WIDGET'S READ-ONLY PROPERTY CHANGES */
    MainViewPanel.prototype.onReadOnlyChanged = function (isReadOnly) {
        //apply parent's onReadOnlyChanged
        PanelBaseWithHeader.prototype.onReadOnlyChanged.call(this, isReadOnly);

    };

    MainViewPanel.prototype.onResize = function (width, height) {
        var navWidth,
            embeddedWidth;

        this.logger.debug('onResize --> width: ' + width + ', height: ' + height);
        this.widget.onWidgetContainerResize(width, height);
        navWidth = this.widget.width();
        embeddedWidth = width-navWidth;
        this.$embedded.css({
            width: embeddedWidth,
            height: height,
            left: navWidth,
            margin: 'inherit'
        });
        this.embeddedPanel.onResize(embeddedWidth, height);
        this.width = width;
        this.height = height;
    };

    /* * * * * * * * Visualizer life cycle callbacks * * * * * * * */
    MainViewPanel.prototype.destroy = function () {
        this.control.destroy();
        this.widget.destroy();

        PanelBaseWithHeader.prototype.destroy.call(this);
        WebGMEGlobal.KeyboardManager.setListener(undefined);
        WebGMEGlobal.Toolbar.refresh();
    };

    MainViewPanel.prototype.onActivate = function () {
        this.widget.onActivate();
        this.control.onActivate();
        WebGMEGlobal.KeyboardManager.setListener(this.widget);
        WebGMEGlobal.Toolbar.refresh();
    };

    MainViewPanel.prototype.onDeactivate = function () {
        this.widget.onDeactivate();
        this.control.onDeactivate();
        WebGMEGlobal.KeyboardManager.setListener(undefined);
        WebGMEGlobal.Toolbar.refresh();
    };

    return MainViewPanel;
});
