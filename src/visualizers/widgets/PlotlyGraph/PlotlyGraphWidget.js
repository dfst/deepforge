/*globals define, _*/
define(['./lib/plotly.min',], function (Plotly) {
    'use strict';

    const WIDGET_CLASS = 'plotly-graph';

    function PlotlyGraphWidget(logger, container) {
        this.logger = logger.fork('widget');
        this.$el = container;
        this.$el.css('overflow', 'auto');
        this.$el.addClass(WIDGET_CLASS);
        this.nodes = {};
        this.plotsData = null;
        this.layout = {};
        this.created = false;
        this.logger.debug('ctor finished');
    }

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
            this.plotsData = desc;
            this.refreshChart();
        }
    };

    PlotlyGraphWidget.prototype.removeNode = function () {
        this.plotsData = null;
        this.refreshChart();
    };

    PlotlyGraphWidget.prototype.updateNode = function (desc) {
        if (desc) {
            this.plotsData = desc;
            this.refreshChart();
        }
    };

    PlotlyGraphWidget.prototype.createOrUpdateChart = function () {
        if (!this.plotsData) {
            this.deleteChart();
        } else {
            if (!this.created && !_.isEmpty(this.plotsData)) {
                Plotly.newPlot(this.$el[0], this.plotsData);
                this.created = true;
            } else if(!_.isEmpty(this.plotsData)) {
                Plotly.react(this.$el[0], this.plotsData);
            }
        }
    };

    PlotlyGraphWidget.prototype.refreshChart = _.debounce(PlotlyGraphWidget.prototype.createOrUpdateChart, 50);

    PlotlyGraphWidget.prototype.deleteChart = function () {
        this.plotsData = null;
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
