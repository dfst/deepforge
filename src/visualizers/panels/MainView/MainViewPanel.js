/*globals define, $, WebGMEGlobal*/
/*jshint browser: true*/

// The main panel shows the PipelineIndex w/ a bar on the left for viewing architectures
// and pipelines
define([
    'js/PanelBase/PanelBase',
    'panels/AutoViz/AutoVizPanel',
    'widgets/MainView/MainViewWidget',
    'deepforge/globals',
    'q',
    'text!/api/visualizers'
], function (
    PanelBase,
    AutoVizPanel,
    MainViewWidget,
    DeepForge,
    Q,
    VisualizersText
) {
    'use strict';

    var MainViewPanel,
        CATEGORY_TO_PLACE = {
            pipelines: 'MyPipelines',
            executions: 'MyPipelines',
            architectures: 'MyArchitectures',
            artifacts: 'MyArtifacts'
        },
        CATEGORY_TO_VIZ = {
            pipelines: 'PipelineIndex',
            executions: 'ExecutionIndex',
            //architectures: 'ArchitectureIndex',
            architectures: 'PipelineIndex',
            //artifacts: 'ArtifactIndex'
            artifacts: 'ArtifactIndex'
        },
        VisualizerPathFor = {};

    JSON.parse(VisualizersText).forEach(viz => VisualizerPathFor[viz.id] = viz.panel);

    MainViewPanel = function (layoutManager, params) {
        var opts = {};
        opts[PanelBase.OPTIONS.LOGGER_INSTANCE_NAME] = 'SidebarPanel';
        PanelBase.call(this, opts);

        this._client = params.client;
        this._embedded = params.embedded;

        this._lm = layoutManager;
        this._params = params;
        this._panels = {};
        this._initialize();

        this.logger.debug('ctor finished');
    };

    MainViewPanel.prototype = Object.create(PanelBase.prototype);
    MainViewPanel.prototype._initialize = function () {
        this.widget = new MainViewWidget(this.logger, this.$el);
        this.widget.getProjectName = this.getProjectName.bind(this);
        this.widget.updateLibraries = this.updateLibraries.bind(this);
        this.widget.checkLibUpdates = this.checkLibUpdates.bind(this);
        this.widget.setEmbeddedPanel = this.setEmbeddedPanel.bind(this);

        this.setEmbeddedPanel('pipelines');
        this.onActivate();
    };

    MainViewPanel.prototype.getPanelPath = function (category) {
        return VisualizerPathFor[CATEGORY_TO_VIZ[category]];
    };

    MainViewPanel.prototype.getPanel = function (category, nodeId) {
        var deferred = Q.defer(),
            panelPath = this.getPanelPath(category, nodeId);

        if (this._panels[panelPath]) {
            deferred.resolve(this._panels[panelPath]);
        } else {
            require([panelPath], Panel => {
                this._panels[panelPath] = Panel;
                deferred.resolve(Panel);
            });
        }

        return deferred.promise;
    };

    MainViewPanel.prototype.setEmbeddedPanel = function (category, silent) {
        var placeName = CATEGORY_TO_PLACE[category],
            nodeId;

        DeepForge.places[placeName]()
            .then(_nodeId => {
                // TODO: Change this to simply change the activeNode
                nodeId = _nodeId;
                console.log('setting nodeId to', nodeId);
                return this.getPanel(category, nodeId);
            });
            //.then(Panel => {

                //if (this.embeddedPanel) {  // Remove current
                    //this.embeddedPanel.destroy();
                    //this.$embedded.remove();
                //}

                //this.embeddedPanel = new Panel(this._lm, this._params);
                //this.$embedded = this.embeddedPanel.$el;
                //this.$embedded.addClass('main-view-embedded');
                //this.$el.append(this.$embedded);

                //// Call on Resize and selectedObjectChanged
                //this.onResize(this.width, this.height);
                //if (!silent) {
                    //this.embeddedPanel.control.selectedObjectChanged(nodeId);
                //}
            //});
    };

    /* OVERRIDE FROM WIDGET-WITH-HEADER */
    MainViewPanel.prototype.onResize = function (width, height) {
        var navWidth,
            embeddedWidth;

        this.logger.debug('onResize --> width: ' + width + ', height: ' + height);
        this.widget.onWidgetContainerResize(width, height);
        navWidth = this.widget.width();
        embeddedWidth = width-navWidth;
        if (this.embeddedPanel) {
            this.$embedded.css({
                width: embeddedWidth,
                height: height,
                left: navWidth,
                margin: 'inherit'
            });
            this.embeddedPanel.onResize(embeddedWidth, height);
        }
        this.width = width;
        this.height = height;
    };

    /* * * * * * * * Visualizer life cycle callbacks * * * * * * * */
    MainViewPanel.prototype.destroy = function () {
        this.widget.destroy();
        this.$el.remove();
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
        var projectId = this._client.getActiveProjectId();
        return projectId && projectId.split('+')[1];
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
