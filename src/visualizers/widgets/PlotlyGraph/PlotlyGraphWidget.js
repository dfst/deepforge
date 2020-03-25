/*globals define, _, $*/
define([
    './lib/plotly.min',
    './PlotlyDescExtractor'
], function (
    Plotly,
    PlotlyDescExtractor) {

    'use strict';

    const WIDGET_CLASS = 'plotly-graph';

    function PlotlyGraphWidget(logger, container) {
        this.logger = logger.fork('widget');
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
        this.nodes = {};
        this.plotlyJSON = null;
        this.layout = {};
        this.created = false;
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
        this.plotlyJSON = null;
        this.refreshChart();
        this.setTextVisibility(true);
    };

    PlotlyGraphWidget.prototype.addOrUpdateNode = function (desc) {
        if (desc) {
            this.plotlyJSON = PlotlyDescExtractor.descToPlotlyJSON(desc);
            this.setTextVisibility(false);
            this.refreshChart();
        }
    };

    PlotlyGraphWidget.prototype.updateNode = function (desc) {
        this.addOrUpdateNode(desc);
    };

    PlotlyGraphWidget.prototype.createOrUpdateChart = function () {
        if (!this.plotlyJSON) {
            this.deleteChart();
        } else {
            if (!this.created && !_.isEmpty(this.plotlyJSON)) {
                Plotly.newPlot(this.$el[0], this.plotlyJSON);
                this.created = true;

            } else if(!_.isEmpty(this.plotlyJSON)) {
                // Currently in plotly, ImageTraces have no react support
                // This will be updated when there's additional support
                // for react with responsive layout
                Plotly.newPlot(this.$el[0], this.plotlyJSON);
            }
        }
    };

    PlotlyGraphWidget.prototype.refreshChart = _.debounce(PlotlyGraphWidget.prototype.createOrUpdateChart, 50);

    PlotlyGraphWidget.prototype.deleteChart = function () {
        this.plotlyJSON = null;
        if (this.created) {
            Plotly.purge(this.$el[0]);
        }
        this.created = false;
    };

    PlotlyGraphWidget.prototype.setTextVisibility = function (display) {
        display = display ? 'block' : 'none';
        this.$defaultTextDiv.css('display', display);
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
