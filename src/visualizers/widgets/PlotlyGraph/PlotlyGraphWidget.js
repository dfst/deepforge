/*globals define, WebGMEGlobal*/
define(['./lib/plotly.min', './PlotlyConfig'], function (Plotly, config) {
    'use strict';

    const WIDGET_CLASS = 'plotly-graph';

    function PlotlyGraphWidget(logger, container) {
        this.logger = logger.fork('widget');
        this.$el = container;
        this.nodes = {};
        this.plotsData = {};
        this.layout = {};
        this.axesCount = 1;
        this.created = false;
        this._initialize();
        this.logger.debug('ctor finished');
    }

    PlotlyGraphWidget.prototype._initialize = function () {
        // set widget class
        this.$el.addClass(WIDGET_CLASS);
        let data = this.getData();
        Plotly.newPlot(this.$el[0], data, {}, config);
        this.created = true;
    };

    PlotlyGraphWidget.prototype.getData = function(){
        return Object.keys(this.plotsData)
            .map(id => this.plotsData[id])
            .filter(data => data.x.length !== 0);
    };

    PlotlyGraphWidget.prototype.onWidgetContainerResize = function (width, height) {
        // Nothing needs to be done here since the chart is already responsive
        this.logger.debug('Widget is resizing...');
    };

    // Adding/Removing/Updating items
    PlotlyGraphWidget.prototype.addNode = function (desc) {
        if(desc){
            if(desc.type === 'line'){
                let pointsArr = this._pointsToCartesianArray(desc.points);
                this.plotsData[desc.id] = {
                    type: 'scatter',
                    x: pointsArr[0],
                    y: pointsArr[1],
                    mode: 'lines',
                    name: desc.label,
                    line: {
                        color: desc.color,
                        width: desc.lineWidth
                    }
                };
            }
        }
        this.refreshChart();
    };

    PlotlyGraphWidget.prototype.removeNode = function (gmeId) {
        delete this.plotsData[gmeId];
        this.refreshChart();
    };

    PlotlyGraphWidget.prototype.updateNode = function (desc) {
        if (this.lineData[desc.id]) {
            let pointsArr = this._pointsToCartesianArray(desc.points);
            this.plotsData[desc.id] = {
                type: 'scatter',
                x: pointsArr[0],
                y: pointsArr[1],
                mode: 'lines',
                name: desc.label,
                line: {
                    color: desc.color,
                    width: desc.lineWidth
                }
            };
        }
        this.refreshChart();
    };

    PlotlyGraphWidget.prototype.refreshChart = function(){
        if(this.created){
            let data = this.getData();
            Plotly.react(this.$el[0], data, {}, config);
        }
    };

    // Only support 2D-Cartesian for now
    PlotlyGraphWidget.prototype._pointsToCartesianArray = function (points){
        let x = [],
            y = [];
        points.forEach((point) => {
            x.push(point.x);
            y.push(point.y);
        });
        return [x, y];
    };



    /* * * * * * * * Visualizer event handlers * * * * * * * */

    PlotlyGraphWidget.prototype.onNodeClick = function (/*id*/) {
        // This currently changes the active node to the given id and
        // this is overridden in the controller.
    };

    PlotlyGraphWidget.prototype.onBackgroundDblClick = function () {
    };

    /* * * * * * * * Visualizer life cycle callbacks * * * * * * * */
    PlotlyGraphWidget.prototype.destroy = function () {
    };

    PlotlyGraphWidget.prototype.onActivate = function () {
        this.logger.debug('PlotlyGraphWidget has been activated');
    };

    PlotlyGraphWidget.prototype.onDeactivate = function () {
        this.logger.debug('PlotlyGraphWidget has been deactivated');
    };

    return PlotlyGraphWidget;
});
