/*globals define, d3, nv, _ */
/*jshint browser: true*/

define([
    './lib/nv.d3.min',
    'css!./lib/nv.d3.min.css'
], function (
) {
    'use strict';

    var LineGraphWidget,
        WIDGET_CLASS = 'line-graph';

    LineGraphWidget = function (logger, container) {
        this.logger = logger.fork('Widget');

        this.$el = container;

        this.lineData = {};
        this._initialize();

        this.logger.debug('ctor finished');
    };

    LineGraphWidget.prototype._initialize = function () {
        // set widget class
        this.$el.addClass(WIDGET_CLASS);

        // Create the chart
        this.options = {};
        this.options.xAxis = null;
        this.options.yAxis = null;

        this.chart = null;
        this.$chart = d3.select(this.$el[0]).append('svg');
        nv.addGraph(() => {
            var chart = nv.models.lineChart()
                .useInteractiveGuideline(true)
                .showLegend(true)
                .showYAxis(true)
                .showXAxis(true);

            chart.xAxis
                .tickFormat(d3.format(',r'));
            chart.yAxis.tickFormat(d3.format('.02f'));

            if (this.options.yAxis) {
                chart.yAxis
                    .axisLabel(this.options.yAxis);
            }
            if (this.options.xAxis) {
                chart.xAxis
                    .axisLabel(this.options.xAxis);
            }

            var myData = this.getData();

            this.$chart
                .datum(myData)
                .call(chart);

            //Update the chart when window resizes.
            nv.utils.windowResize(() => chart.update());
            this.chart = chart;
            return chart;
        });

    };

    LineGraphWidget.prototype.getData = function () {
        return Object.keys(this.lineData)
            .map(id => this.lineData[id])
            .filter(data => data.values.length !== 0);  // hide empty lines
    };

    // Adding/Removing/Updating items
    LineGraphWidget.prototype.addNode = function (desc) {
        if (desc) {
            // Add node to a table of nodes
            if (desc.type === 'line') {
                this.lineData[desc.id] = {
                    key: desc.name,
                    values: desc.points
                };
            } else {
                this.options.xAxis = desc.xlabel;
                this.options.yAxis = desc.ylabel;
            }
            this.refreshChart();
        }
    };

    LineGraphWidget.prototype.removeNode = function (id) {
        delete this.lineData[id];
        this.refreshChart();
    };

    LineGraphWidget.prototype.updateNode = function (desc) {
        if (this.lineData[desc.id]) {
            this.lineData[desc.id].values = desc.points;
            this.lineData[desc.id].key = desc.name;
        } else {
            this.options.xAxis = desc.xlabel;
            this.options.yAxis = desc.ylabel;
        }
        this.refreshChart();
    };

    LineGraphWidget.prototype.onWidgetContainerResize = function(width, height) {
        this.$el.css({
            width: width,
            height: height
        });
        this.updateChart();
    };

    LineGraphWidget.prototype.updateChartData = function () {
        if (this.$chart && this.chart) {

            if (this.options.yAxis) {
                this.chart.yAxis
                    .axisLabel(this.options.yAxis || '');
            }
            if (this.options.xAxis) {
                this.chart.xAxis
                    .axisLabel(this.options.xAxis || '');
            }


            this.$chart
                .datum(this.getData())
                .call(this.chart);
        }
    };

    LineGraphWidget.prototype.refreshChart = 
        _.debounce(LineGraphWidget.prototype.updateChartData, 50);

    LineGraphWidget.prototype.updateChart = function () {
        if (this.chart) {
            this.chart.update();
        }
    };

    /* * * * * * * * Visualizer life cycle callbacks * * * * * * * */
    LineGraphWidget.prototype.destroy = function () {
    };

    LineGraphWidget.prototype.onActivate = function () {
        this.logger.debug('LineGraphWidget has been activated');
    };

    LineGraphWidget.prototype.onDeactivate = function () {
        this.logger.debug('LineGraphWidget has been deactivated');
    };

    return LineGraphWidget;
});
