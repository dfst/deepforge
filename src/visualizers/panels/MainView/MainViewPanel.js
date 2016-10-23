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
    'deepforge/globals',
    'q'
], function (
    PanelBaseWithHeader,
    IActivePanel,
    MainViewWidget,
    MainViewControl,
    PipelineIndexPanel,
    ExecutionIndexPanel,
    DeepForge,
    Q
) {
    'use strict';

    var MainViewPanel,
        CATEGORY_TO_PLACE = {
            pipelines: 'MyPipelines',
            executions: 'MyPipelines',
            architectures: 'MyArchitectures',
            artifacts: 'MyArtifacts'
        };

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
        this.widget.updateLibraries = this.updateLibraries.bind(this);
        this.widget.checkLibUpdates = this.checkLibUpdates.bind(this);
        this.widget.setEmbeddedPanel = this.setEmbeddedPanel.bind(this);

        this.setEmbeddedPanel('pipelines');
        this.onActivate();
    };

    MainViewPanel.prototype.setEmbeddedPanel = function (category, silent) {
        // TODO: Change this to toggle specific views
        var Panel = this.embeddedPanels[0],
            // TODO: Get the panel to use...
            placeName = CATEGORY_TO_PLACE[category];


        // TODO: Highlight the current toggled panel
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
            DeepForge.places[placeName]().then(nodeId => {
            console.log('new nodeId is', nodeId);
                this.embeddedPanel.control.selectedObjectChanged(nodeId)});
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
        this.widget.destroy();

        PanelBaseWithHeader.prototype.destroy.call(this);
        WebGMEGlobal.KeyboardManager.setListener(undefined);
        WebGMEGlobal.Toolbar.refresh();
    };

    MainViewPanel.prototype.onActivate = function () {
        this.widget.onActivate();
        WebGMEGlobal.KeyboardManager.setListener(this.widget);
        WebGMEGlobal.Toolbar.refresh();
    };

    MainViewPanel.prototype.onDeactivate = function () {
        this.widget.onDeactivate();
        WebGMEGlobal.KeyboardManager.setListener(undefined);
        WebGMEGlobal.Toolbar.refresh();
    };

    /* * * * * * * * Library Updates * * * * * * * */

    MainViewPanel.prototype.getProjectName = function () {
        return this._client.getActiveProjectId().split('+')[1];
    };

    MainViewPanel.prototype.checkLibUpdates = function () {
        var pluginId = 'CheckLibraries',
            context = this._client.getCurrentPluginContext(pluginId);

        return Q.ninvoke(this._client, 'runServerPlugin', pluginId, context)
            .then(res => {
                return res.messages.map(msg => msg.message.split(' '));
            });
    };

    MainViewPanel.prototype.updateLibraries = function (libraries) {
        var promises = libraries
            .map(lib => Q.ninvoke(this._client, 'updateLibrary', lib[0], lib[1]));

        return Q.all(promises);
    };

    return MainViewPanel;
});
