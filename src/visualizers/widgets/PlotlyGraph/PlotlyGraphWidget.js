/*globals define, WebGMEGlobal*/
define(['./lib/plotly.min', './PlotlyJSONCreator'], function (Plotly, PlotlyJSONCreator) {
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
            this.plotlyJSONCreator = new PlotlyJSONCreator();
            this.created = false;
            this._initialize();
            this.logger.debug('ctor finished');
        }

        PlotlyGraphWidget.prototype._initialize = function () {
            // set widget class

            this.created = false;
        };

        PlotlyGraphWidget.prototype.getData = function () {
            return Object.keys(this.plotsData)
                .map(id => this.plotsData[id])
                .filter(data => data.x.length !== 0);
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
            this.plotsData[desc.id] = desc;
            this.createOrUpdateChart();
        };

        PlotlyGraphWidget.prototype.removeNode = function (id) {
            delete this.plotsData[id];
            this.createOrUpdateChart();
        };

        PlotlyGraphWidget.prototype.updateNode = function (desc) {
            this.plotsData[desc.id] = desc;
            this.createOrUpdateChart();
        };

        PlotlyGraphWidget.prototype.createOrUpdateChart = function () {
            if (Object.keys(this.plotsData).length === 0) {
                this.deleteChart();
            } else {
                if (!this.created) {
                    this.plotlyJSONCreator.create(this.plotsData);
                    Plotly.newPlot(this.$el[0], this.plotlyJSONCreator.plotlyJSONSchema);
                    this.created = true;
                } else {
                    this.plotlyJSONCreator.update(this.plotsData);
                    Plotly.react(this.$el[0], this.plotlyJSONCreator.plotlyJSONSchema);
                }
            }
        };

        PlotlyGraphWidget.prototype.deleteChart = function () {
            Plotly.purge(this.$el[0]);
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
    }
);
