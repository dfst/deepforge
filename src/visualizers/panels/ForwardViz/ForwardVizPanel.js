/*globals define, _, WebGMEGlobal*/
/*jshint browser: true*/

define([
    'js/Constants',
    'deepforge/globals',
    'js/PanelManager/IActivePanel',
    'js/PanelBase/PanelBaseWithHeader'
], function (
    CONSTANTS,
    DeepForge,
    IActivePanel,
    PanelBaseWithHeader
) {
    'use strict';

    var ForwardVizPanel;

    ForwardVizPanel = function (layoutManager, params) {
        var options = {};
        //set properties from options
        options[PanelBaseWithHeader.OPTIONS.LOGGER_INSTANCE_NAME] = 'ForwardViz';

        //call parent's constructor
        PanelBaseWithHeader.apply(this, [options, layoutManager]);

        this._client = params.client;

        //initialize UI
        this._initialize();

        this.logger.debug('ctor finished');
    };

    //inherit from PanelBaseWithHeader
    _.extend(ForwardVizPanel.prototype, PanelBaseWithHeader.prototype);
    _.extend(ForwardVizPanel.prototype, IActivePanel.prototype);

    ForwardVizPanel.prototype._initialize = function () {
        this.control = this;
        this.onActivate();
    };

    ForwardVizPanel.prototype.selectedObjectChanged = function(nodeId) {
        if (nodeId === CONSTANTS.PROJECT_ROOT_ID) {
            DeepForge.places.MyPipelines().then(id => WebGMEGlobal.State.registerActiveObject(id));
        }
    };

    /* OVERRIDE FROM WIDGET-WITH-HEADER */
    /* METHOD CALLED WHEN THE WIDGET'S READ-ONLY PROPERTY CHANGES */
    //apply parent's onReadOnlyChanged
    ForwardVizPanel.prototype.onReadOnlyChanged = function() {
        PanelBaseWithHeader.prototype.onReadOnlyChanged.apply(this, arguments);

    };

    /* * * * * * * * Visualizer life cycle callbacks * * * * * * * */
    ForwardVizPanel.prototype.destroy = function () {
        PanelBaseWithHeader.prototype.destroy.call(this);
    };

    ForwardVizPanel.prototype.onReadOnlyChanged =
    ForwardVizPanel.prototype.onResize =
    ForwardVizPanel.prototype.onActivate =
    ForwardVizPanel.prototype.onDeactivate = function () {
    };

    return ForwardVizPanel;
});
