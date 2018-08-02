/*globals define, WebGMEGlobal*/
/*jshint browser: true*/

define([
    'js/Constants',
    'js/PanelBase/PanelBase',
    'panels/AutoViz/AutoVizPanel',
    'widgets/Sidebar/SidebarWidget',
    'deepforge/globals',
    'q'
], function (
    CONSTANTS,
    PanelBase,
    AutoVizPanel,
    SidebarWidget,
    DeepForge,
    Q
) {
    'use strict';

    var SidebarPanel,
        CATEGORY_TO_PLACE = {
            pipelines: 'MyPipelines',
            executions: 'MyExecutions',
            resources: 'MyResources',
            artifacts: 'MyArtifacts',
            code: 'InitCode',
            utils: 'MyUtilities'
        };

    SidebarPanel = function (layoutManager, params) {
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

    SidebarPanel.prototype = Object.create(PanelBase.prototype);
    SidebarPanel.prototype._initialize = function () {
        this.widget = new SidebarWidget(this.logger, this.$el);
        this.widget.getProjectName = this.getProjectName.bind(this);
        this.widget.updateLibraries = this.updateLibraries.bind(this);
        this.widget.checkLibUpdates = this.checkLibUpdates.bind(this);
        this.widget.setEmbeddedPanel = this.setEmbeddedPanel.bind(this);

        this.onActivate();
    };

    SidebarPanel.prototype._stateActiveBranchChanged = function (model, branchId) {
        if (branchId) {
            this.widget.checkLibraries();
        }
    };

    SidebarPanel.prototype.setEmbeddedPanel = function (category) {
        var placeName = CATEGORY_TO_PLACE[category];

        return DeepForge.places[placeName]()
            .then(nodeId => WebGMEGlobal.State.registerActiveObject(nodeId));
    };

    SidebarPanel.prototype.selectedObjectChanged = function (nodeId) {
        var categories,
            category,
            place;

        if (typeof nodeId === 'string') {
            categories = Object.keys(CATEGORY_TO_PLACE);
            
            Q.all(categories.map(category => {
                place = CATEGORY_TO_PLACE[category];
                return DeepForge.places[place]();
            }))
            .then(nodeIdPrefixes => {
                for (var i = nodeIdPrefixes.length; i--;) {
                    if (nodeId.indexOf(nodeIdPrefixes[i]) > -1) {
                        category = categories[i];
                        return this.widget.highlight(category);
                    }
                }
            });
        }
    };

    /* OVERRIDE FROM WIDGET-WITH-HEADER */
    SidebarPanel.prototype.onResize = function (width, height) {
        var navWidth,
            embeddedWidth;

        this.logger.debug('onResize --> width: ' + width + ', height: ' + height);
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
    SidebarPanel.prototype.destroy = function () {
        this.widget.destroy();
        this.$el.remove();
        WebGMEGlobal.KeyboardManager.setListener(undefined);
        WebGMEGlobal.Toolbar.refresh();
    };

    SidebarPanel.prototype._stateActiveObjectChanged = function (model, activeObjectId) {
        this.selectedObjectChanged(activeObjectId);
    };

    SidebarPanel.prototype.onActivate = function () {
        WebGMEGlobal.State.on('change:' + CONSTANTS.STATE_ACTIVE_OBJECT,
            this._stateActiveObjectChanged, this);
        WebGMEGlobal.State.on('change:' + CONSTANTS.STATE_ACTIVE_BRANCH_NAME,
            this._stateActiveBranchChanged, this);
        this.widget.onActivate();
        WebGMEGlobal.KeyboardManager.setListener(this.widget);
        WebGMEGlobal.Toolbar.refresh();
    };

    SidebarPanel.prototype.onDeactivate = function () {
        WebGMEGlobal.State.off('change:' + CONSTANTS.STATE_ACTIVE_OBJECT,
            this._stateActiveObjectChanged);
        WebGMEGlobal.State.off('change:' + CONSTANTS.STATE_ACTIVE_BRANCH_NAME,
            this._stateActiveBranchChanged, this);
        this.widget.onDeactivate();
        WebGMEGlobal.KeyboardManager.setListener(undefined);
        WebGMEGlobal.Toolbar.refresh();
    };

    /* * * * * * * * Library Updates * * * * * * * */

    SidebarPanel.prototype.getProjectName = function () {
        var projectId = this._client.getActiveProjectId();
        return projectId && projectId.split('+')[1];
    };

    SidebarPanel.prototype.checkLibUpdates = function () {
        var pluginId = 'CheckLibraries',
            context = this._client.getCurrentPluginContext(pluginId);

        return Q.ninvoke(this._client, 'runServerPlugin', pluginId, context)
            .then(res => {
                return res.messages.map(msg => msg.message.split(' '));
            });
    };

    SidebarPanel.prototype.updateLibraries = function (libraries) {
        var promises = libraries
            .map(lib => Q.ninvoke(this._client, 'updateLibrary', lib[0], lib[1]));

        return Q.all(promises);
    };

    return SidebarPanel;
});
