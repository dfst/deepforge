/*globals define, _, $, WebGMEGlobal*/
/*jshint browser: true*/
// This panel is essentially it's own layout manager. It is
// given a static list of visualizers and tiles them allowing 
// the user to view the current node in a number of different
// ways at once (w/o toggling between visualizers)
//
// For now, it is just split screen

define([
    'js/PanelBase/PanelBaseWithHeader',
    'js/Constants',
    'js/PanelManager/IActivePanel'
], function (
    PanelBaseWithHeader,
    CONSTANTS,
    IActivePanel
) {
    'use strict';

    var TilingVizPanel;

    TilingVizPanel = function (layoutManager, params) {
        var options = {};
        //set properties from options
        options[PanelBaseWithHeader.OPTIONS.LOGGER_INSTANCE_NAME] = 'TilingVizPanel';
        options[PanelBaseWithHeader.OPTIONS.FLOATING_TITLE] = true;

        //call parent's constructor
        PanelBaseWithHeader.apply(this, [options, layoutManager]);

        this._layoutManager = layoutManager;
        this._params = params;
        this._client = params.client;
        this._embedded = params.embedded;
        this._resizeArgs = null;

        //initialize UI
        this._initialize();

        this.logger.debug('ctor finished');
    };

    //inherit from PanelBaseWithHeader
    _.extend(TilingVizPanel.prototype, PanelBaseWithHeader.prototype);
    _.extend(TilingVizPanel.prototype, IActivePanel.prototype);

    TilingVizPanel.prototype.getPanels = function () {
        return [];
    };

    TilingVizPanel.prototype._initialize = function () {
        // Trigger active object
        if (!this._embedded) {
            WebGMEGlobal.State.on('change:' + CONSTANTS.STATE_ACTIVE_OBJECT,
                (model, nodeId) => this.selectedObjectChanged(nodeId)
            );
        }
        this.$el.css({padding: 0});
        this.updatePanels();
    };

    TilingVizPanel.prototype.updatePanels = function () {
        var panels = this.getPanels();

        this.logger.info(`updating panels (${panels.length})`);
        if (panels.length > 2) {
            this.logger.error(`Unsupported number of panels (${panels.length})`);
        }

        if (this._panels) {
            this._panels.forEach(panel => panel.destroy());
            this.$el.empty();
        }

        // Create the panels and containers
        this._panels = panels.map(Panel => new Panel(this._layoutManager, this._params));
        this._containers = this._panels.map((p, i) => $('<div>', {id: `panel ${i}`}));
        this._containers.forEach(c => this.$el.append(c));
        this._activePanel = this._panels[0];

        // Add each panel to the respective container and deactivate
        this._panels.forEach((panel, i) =>
            this._containers[i].append(panel.$el) && panel.onDeactivate()
        );

        this.control = this;
        this.onActivate();
        if (this._resizeArgs) {
            this.onResize.apply(this, this._resizeArgs);
        }
    };

    TilingVizPanel.prototype.selectedObjectChanged = function (nodeId) {
        this._currentNodeId = nodeId;
        this._panels.forEach(p => p.control.selectedObjectChanged(this._currentNodeId));
    };

    /* OVERRIDE FROM WIDGET-WITH-HEADER */
    /* METHOD CALLED WHEN THE WIDGET'S READ-ONLY PROPERTY CHANGES */
    TilingVizPanel.prototype.onReadOnlyChanged = function (isReadOnly) {
        //apply parent's onReadOnlyChanged
        PanelBaseWithHeader.prototype.onReadOnlyChanged.call(this, isReadOnly);
    };

    TilingVizPanel.prototype.onResize = function (width, height) {
        var pwidth = width/this.getPanels().length;

        this._containers.forEach((c, i) => c.css({
            width: pwidth,
            height: height,
            left: pwidth*i,
            position: 'absolute'
        }));
        // Call onResize for each of the tiles
        this.logger.debug('onResize --> width: ' + width + ', height: ' + height);
        this._panels.forEach(p => p.onResize(pwidth, height));
        this._resizeArgs = [width, height];
    };

    /* * * * * * * * Visualizer life cycle callbacks * * * * * * * */
    TilingVizPanel.prototype.destroy = function () {
        this._panels.forEach(p => p.destroy());
        PanelBaseWithHeader.prototype.destroy.call(this);
    };

    TilingVizPanel.prototype.onActivate = function () {
        // Activate the first panel by default
        this._activePanel = this._panels[0];
        //WebGMEGlobal.PanelManager.setActivePanel(this._activePanel);
        this._activePanel.onActivate();
    };

    TilingVizPanel.prototype.onDeactivate = function () {
        this._activePanel.onDeactivate();
    };

    return TilingVizPanel;
});
