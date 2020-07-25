/*globals define, _, $*/
define([
    './lib/plotly.min'
], function (
    Plotly
) {

    'use strict';

    const WIDGET_CLASS = 'plotly-graph';
    const PLOT_BG_COLOR = '#EEEEEE';

    function PlotlyGraphWidget(logger, container) {
        this.logger = logger.fork('widget');
        this._container = container;
        this.$el = container;
        this.$defaultTextDiv = $('<div>', {
            class: 'h2 center'
        }).text('No Data Available.')
            .css({
                'margin-top': this.$el.height() / 2
            });
        this.$el.append(this.$defaultTextDiv);
        this.$el.css('overflow', 'auto');
        this.$el.addClass(WIDGET_CLASS);
        this.plots = [];
        this.logger.debug('ctor finished');
        this.setTextVisibility(true);
    }

    PlotlyGraphWidget.prototype.onWidgetContainerResize = function (width, height) {
        // Nothing needs to be done here since the chart is already responsive
        this.$el.css({
            width: width,
            height: height
        });
        this.$defaultTextDiv.css({
            'margin-top': height / 2
        });
        this.logger.debug('Widget is resizing...');
    };

    // Adding/Removing/Updating items
    PlotlyGraphWidget.prototype.addNode = function (desc) {
        this.addOrUpdateNode(desc);
    };

    PlotlyGraphWidget.prototype.removeNode = function () {
        this.refreshChart();
        this.setTextVisibility(true);
    };

    PlotlyGraphWidget.prototype.addOrUpdateNode = function (desc) {
        if (desc) {
            const plotlyJSONs = Array.isArray(desc) ?
                desc.map(descr => descr.plotlyData) : [desc.plotlyData];
            this.setTextVisibility(false);
            this.refreshChart(plotlyJSONs);
        }
    };

    PlotlyGraphWidget.prototype.updateNode = function (desc) {
        this.deleteChart();
        this.addOrUpdateNode(desc);
    };

    PlotlyGraphWidget.prototype.createOrUpdateChart = function (plotlyJSONs) {
        if (!plotlyJSONs) {
            this.deleteChart();
        } else {
            this.createChartSlider(plotlyJSONs);
        }
    };

    PlotlyGraphWidget.prototype.createChartSlider = function(plotlyJSONs) {
        const len = plotlyJSONs.length;
        plotlyJSONs.forEach(json => {
            const plotlyDiv = $('<div/>');

            if (len === 1) {
                json.layout.height = this.$el.height();
                json.layout.width = this.$el.width();
            } else {
                json.layout.autosize = true;
                delete json.layout.width;
                delete json.layout.height;
            }
            json.layout.plot_bgcolor = PLOT_BG_COLOR;
            json.layout.paper_bgcolor = PLOT_BG_COLOR;

            Plotly.newPlot(plotlyDiv[0], json);
            this.plots.push(plotlyDiv);
            this.$el.append(plotlyDiv);
        });
    };

    PlotlyGraphWidget.prototype.refreshChart = _.debounce(PlotlyGraphWidget.prototype.createOrUpdateChart, 50);

    PlotlyGraphWidget.prototype.deleteChart = function () {
        this.plots.forEach($plot => {
            Plotly.purge($plot[0]);
            $plot.remove();
        });
    };

    PlotlyGraphWidget.prototype.setTextVisibility = function (display) {
        display = display ? 'block' : 'none';
        this.$defaultTextDiv.css('display', display);
    };
    /* * * * * * * * Visualizer life cycle callbacks * * * * * * * */
    PlotlyGraphWidget.prototype.destroy = function () {
        this.deleteChart();
    };

    PlotlyGraphWidget.prototype.onActivate = function () {
        this.logger.debug('PlotlyGraphWidget has been activated');
    };

    PlotlyGraphWidget.prototype.onDeactivate = function () {
        this.logger.debug('PlotlyGraphWidget has been deactivated');
    };

    return PlotlyGraphWidget;
});
