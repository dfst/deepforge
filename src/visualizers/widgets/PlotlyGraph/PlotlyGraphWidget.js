/*globals define, WebGMEGlobal, _*/
define(['./lib/plotly.min',], function (Plotly) {
    'use strict';

    const WIDGET_CLASS = 'plotly-graph';

    function PlotlyGraphWidget(logger, container) {
        this.logger = logger.fork('widget');
        this.$el = container;
        this.$el.css('overflow', 'auto');
        this.$el.addClass(WIDGET_CLASS);
        this.nodes = {};
        this.plotsData = {};
        this.layout = {};
        this.created = false;
        this._initialize();
        this.logger.debug('ctor finished');
    }

    PlotlyGraphWidget.prototype._initialize = function () {
        this.created = false;
    };


    PlotlyGraphWidget.prototype.onWidgetContainerResize = function (width, height) {
        // Nothing needs to be done here since the chart is already responsive
        this.$el.css({
            width: width,
            height: height
        });
        this.logger.debug('Widget is resizing...');
    };

    // Adding/Removing/Updating items
    PlotlyGraphWidget.prototype.addNode = function (desc) {
        if (desc) {
            this.plotsData[desc.id] = desc;
            this.refreshChart();
        }
    };

    PlotlyGraphWidget.prototype.removeNode = function (id) {
        delete this.plotsData[id];
        this.refreshChart();
    };

    PlotlyGraphWidget.prototype.updateNode = function (desc) {
        if (desc) {
            this.plotsData[desc.id] = desc;
            this.refreshChart();
        }
    };

    PlotlyGraphWidget.prototype.createOrUpdateChart = function () {
        if (Object.keys(this.plotsData).length === 0) {
            this.deleteChart();
        } else {
            let plotlyJSON = Object.keys(this.plotsData)
                .map(id => this.plotsData[id]);
            if (!this.created && !_.isEmpty(...plotlyJSON)) {
                Plotly.newPlot(this.$el[0], ...plotlyJSON);
                this.created = true;
            } else if(!_.isEmpty(...plotlyJSON)) {
                Plotly.react(this.$el[0], ...plotlyJSON);
            }
        }
    };

    PlotlyGraphWidget.prototype.refreshChart = _.debounce(PlotlyGraphWidget.prototype.createOrUpdateChart, 50);

    PlotlyGraphWidget.prototype.deleteChart = function () {
        this.plotsData = {};
        if (this.created) {
            Plotly.purge(this.$el[0]);
        }
        this.created = false;
    };

    /* * * * * * * * Visualizer life cycle callbacks * * * * * * * */
    PlotlyGraphWidget.prototype.destroy = function () {
        Plotly.purge(this.$el[0]);
    };

    PlotlyGraphWidget.prototype.onActivate = function () {
        this.logger.debug('PlotlyGraphWidget has been activated');
    };

    PlotlyGraphWidget.prototype.onDeactivate = function () {
        this.logger.debug('PlotlyGraphWidget has been deactivated');
    };

    return PlotlyGraphWidget;
});
