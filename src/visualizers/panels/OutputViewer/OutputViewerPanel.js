/*globals define, $, _, WebGMEGlobal*/
/*jshint browser: true*/

// The OutputViewer is a viz which shows the LogViewer and, if the job has
// metadata, provides a pagination bar in the lower left to page through
// the metadata results
define([
    'text!./icons.json',
    'js/PanelBase/PanelBaseWithHeader',
    'js/PanelManager/IActivePanel',
    'panels/LogViewer/LogViewerPanel',
    'js/Constants',
    'js/RegistryKeys',
    'text!api/visualizers',
    'css!./OutputViewer.css'
], function (
    IconTxt,
    PanelBaseWithHeader,
    IActivePanel,
    LogViewer,
    CONSTANTS,
    REGISTRY_KEYS,
    VisualizersJSON
) {
    'use strict';

    var OutputViewerPanel,
        Visualizers = JSON.parse(VisualizersJSON),
        IconFor = JSON.parse(IconTxt);

    OutputViewerPanel = function (layoutManager, params) {
        var options = {};
        //set properties from options
        options[PanelBaseWithHeader.OPTIONS.LOGGER_INSTANCE_NAME] = 'OutputViewerPanel';

        //call parent's constructor
        PanelBaseWithHeader.apply(this, [options, layoutManager]);

        this._currentNodeId = null;
        this._client = params.client;
        this._embedded = params.embedded;

        //initialize UI
        this._layoutManager = layoutManager;
        this.dimensions = null;
        this._params = params;
        this._initialize();

        this.logger.debug('ctor finished');
    };

    //inherit from PanelBaseWithHeader
    _.extend(OutputViewerPanel.prototype, PanelBaseWithHeader.prototype);
    _.extend(OutputViewerPanel.prototype, IActivePanel.prototype);

    OutputViewerPanel.prototype._initialize = function () {
        this.control = this;  // implement selectedObjectChanged here
        this._panels = {
            LogViewer: LogViewer
        };

        // Create the pagination container
        this._pages = {};
        this._pageCount = 0;
        this.$el.addClass('output-viewer');
        this.$pager = $('<nav>', {class: 'output-pager empty'});
        this.$pagerList = $('<ul>', {class: 'pagination'});

        // Add the console item
        var logviewer = $('<li class="active"><a><span class="glyphicon glyphicon-console"></span> Console</a></li>');
        this.$logviewer = logviewer.find('a');
        this.$selected = this.$logviewer;
        this.$pagerList.append(logviewer);

        this.$pager.append(this.$pagerList);
        this.$el.append(this.$pager);
        this.$el.css({padding: 0});

        // On 'page' clicked, set the activePanel to a new AutoViz and set
        // the given nodeId as the active node for it
        this.$pager.on('click', 'li', event => {
            var element = $(event.target);
            this.selectOutput(element);
        });

        // Set the activePanel
        this.activePanel = new LogViewer(this._layoutManager, this._params);
        this.$el.append(this.activePanel.$el);

        this.onActivate();
    };

    OutputViewerPanel.prototype.selectOutput = function (element) {
        if (this.$selected !== element) {
            // Update the panel
            var dataId = element.data('id');

            while (element.prop('tagName').toLowerCase() !== 'a' && element.length) {
                element = element.parent();
            }

            dataId = element.data('id');
            this.$selected.parent().removeClass('active');
            element.parent().addClass('active');
            this.$selected = element;

            if (dataId) {
                this.loadOutputFor(dataId);
            } else {  // Set the logviewer
                this.loadPanel(LogViewer, this._currentNodeId);
            }
        }
    };

    OutputViewerPanel.prototype.loadOutputFor = function (id) {
        var node = this._client.getNode(id),
            panelId,
            panel,
            panelPath;

        if (!node) {
            this.logger.error(`could not load node: ${id}`);
            return;
        }

        // Get the registered visualizer
        panelId = (node.getRegistry(REGISTRY_KEYS.VALID_VISUALIZERS) || '')
            .split(' ')
            .shift();

        // Load it (embedded) and set the selected node to 'id'
        panel= Visualizers.find(desc => desc.id === panelId);
        if (panel) {
            panelPath = panel.panel;
            if (this._panels[panelPath]) {
                this.loadPanel(this._panels[panelPath], id);
            } else {
                require([panelPath],
                    function(Panel) {
                        this._panels[panelPath] = Panel;
                        this.loadPanel(Panel, id);
                    }.bind(this),
                    err =>
                        this.logger.error(`could not load ${panelPath}: ${err}`)
                );
            }
        } else {
            this.logger.warn(`Could not find visualizer: ${panelId}`);
        }
    };

    OutputViewerPanel.prototype.loadPanel = function (Panel, nodeId) {
        if (this.activePanel) {
            this.activePanel.destroy();
            this.activePanel.$el.remove();
        }

        this.activePanel = new Panel(this._layoutManager, this._params);
        this.$el.append(this.activePanel.$el);
        if (nodeId) {
            this.activePanel.control.selectedObjectChanged(nodeId);
        }
        if (this.dimensions) {
            this.onResize.apply(this, this.dimensions);
        }
    };

    OutputViewerPanel.prototype.clearTerritory = function () {
        if (this._territoryUI) {
            this._client.removeUI(this._territoryUI);
            this._territoryUI = null;
        }
    };

    OutputViewerPanel.prototype.selectedObjectChanged = function (nodeId) {
        if (typeof nodeId === 'string') {
            this._currentNodeId = nodeId;
            this.clearTerritory();
            this._territoryUI = this._client.addUI(this, this.handleEvents.bind(this));

            // Create the territory (active node and children)
            this._territory = {};
            this._territory[nodeId] = {children: 1};
            this._client.updateTerritory(this._territoryUI, this._territory);

            this.activePanel.control.selectedObjectChanged(nodeId);
        }
    };

    OutputViewerPanel.prototype.getMetadataId = function () {
        var metanodes = this._client.getAllMetaNodes();
        for (var i = metanodes.length; i--;) {
            if (metanodes[i].getAttribute('name') === 'Metadata') {
                return metanodes[i].getId();
            }
        }
        return null;
    };

    OutputViewerPanel.prototype.handleEvents = function (events) {
        var metadataId = this.getMetadataId(),
            node,
            event;

        if (!metadataId) {
            this.logger.error(`No metadata id found! "${metadataId}"`);
            return;
        }

        events = events.filter(event => {
            if (event.eid) {
                node = this._client.getNode(event.eid);
                return this._pages[event.eid] || node.isTypeOf(metadataId);
            }
            return false;
        });
        for (var i = events.length; i--;) {
            event = events[i];
            switch (event.etype) {

            case CONSTANTS.TERRITORY_EVENT_LOAD:
                this.onLoad(event.eid);
                break;
            case CONSTANTS.TERRITORY_EVENT_UPDATE:
                this.onUpdate(event.eid);
                break;
            case CONSTANTS.TERRITORY_EVENT_UNLOAD:
                this.onUnload(event.eid);
                break;
            }
        }
    };

    OutputViewerPanel.prototype.onUpdate = function (nodeId) {
        if (this._pages[nodeId]) {
            this.updatePage(nodeId);
        }
    };

    OutputViewerPanel.prototype.onLoad = function (nodeId) {
        var node = this._client.getNode(nodeId),
            name = node.getAttribute('name');

        this.addToPager(name, nodeId);
    };

    OutputViewerPanel.prototype.onUnload = function (nodeId) {
        // If the current metadata node is deleted, change back to logviewer
        if (this._pages[nodeId]) {
            var selectedId = this.$selected.data('id');
            if (nodeId === selectedId) {
                this.selectOutput(this.$logviewer);
            }

            // Update the pager
            this._pages[nodeId].remove();
            this._pageCount--;
            if (this._pageCount === 0) {
                this.$pager.addClass('empty');
            }
        }
    };

    OutputViewerPanel.prototype.updatePage = function (nodeId) {
        var node = this._client.getNode(nodeId),
            baseId = node.getBaseId(),
            base = this._client.getNode(baseId),
            type = base.getAttribute('name'),
            name = node.getAttribute('name'),
            icon = IconFor[type] || 'info-sign',
            anchor = this._pages[nodeId].find('a'),
            span = document.createElement('span');

        span.className = 'glyphicon glyphicon-' + icon;
        anchor.empty();
        anchor.html(span.outerHTML + ' ' + name);
    };

    OutputViewerPanel.prototype.addToPager = function (name, nodeId) {
        var $el = $('<li>'),
            $a = $('<a>');

        $a.attr('data-id', nodeId);
        $el.append($a);
        this._pages[nodeId] = $el;
        this.updatePage(nodeId);
        this.$pager.removeClass('empty');
        this.$pagerList.append($el);

        this._pageCount++;
    };

    /* OVERRIDE FROM WIDGET-WITH-HEADER */
    /* METHOD CALLED WHEN THE WIDGET'S READ-ONLY PROPERTY CHANGES */
    OutputViewerPanel.prototype.onReadOnlyChanged = function (isReadOnly) {
        //apply parent's onReadOnlyChanged
        PanelBaseWithHeader.prototype.onReadOnlyChanged.call(this, isReadOnly);

    };

    OutputViewerPanel.prototype.onResize = function (width, height) {
        this.logger.debug('onResize --> width: ' + width + ', height: ' + height);
        this.dimensions = arguments;
        this.$el.css({
            width: width,
            height: height
        });
        this.activePanel.onResize(width, height);
    };

    /* * * * * * * * Visualizer life cycle callbacks * * * * * * * */
    OutputViewerPanel.prototype.destroy = function () {
        this.activePanel.destroy();
        this.clearTerritory();
        PanelBaseWithHeader.prototype.destroy.call(this);
        WebGMEGlobal.KeyboardManager.setListener(undefined);
        WebGMEGlobal.Toolbar.refresh();
    };

    OutputViewerPanel.prototype.onActivate = function () {
        this.activePanel.onActivate();
    };

    OutputViewerPanel.prototype.onDeactivate = function () {
        this.activePanel.onDeactivate();
    };

    return OutputViewerPanel;
});
