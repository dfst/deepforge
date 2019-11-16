/*globals define, WebGMEGlobal*/
define(['./lib/plotly.min', './PlotlyJSONCreator'], function (Plotly, PlotlyJSONCreator) {
        'use strict';

        const WIDGET_CLASS = 'plotly-graph';


        function PlotlyGraphWidget(logger, container) {
            this.logger = logger.fork('widget');
            this.$el = container;
            this.$el.css('overflow', 'auto');
            this.nodes = {};
            this.plotsData = {};
            this.layout = {};
            this.plotlyJSONCreator = new PlotlyJSONCreator();
            this.axesCount = 1;
            this.created = false;
            this._initialize();
            this.logger.debug('ctor finished');
        }

        PlotlyGraphWidget.prototype._initialize = function () {
            // set widget class
            let desc = {
                title: 'My Plotly Graph',
                subGraphs: [
                    {
                        title: 'Subplot Two',
                        xlabel: 'My Time',
                        ylabel: 'My Value',
                        lines: [{
                            points: [
                                {
                                    x: 1,
                                    y: 4
                                },
                                {
                                    x: 2,
                                    y: 5
                                },
                                {
                                    x: 3,
                                    y: 6
                                }
                            ],
                            color: '#EEC2A9'
                        }]
                    }
                ]
            };
            this.created = false;
        };

        PlotlyGraphWidget.prototype.getData = function () {
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
            if(desc && this.created){
                this.plotlyJSONCreator.update(desc);
                this.plotsData[desc.id] = desc;
                Plotly.react(this.$el[0], this.plotlyJSONCreator.plotlyJSONSchema);
            }
            else if(desc && !this.created){
                this.plotlyJSONCreator.create(desc);
                Plotly.newPlot(this.$el[0], this.plotlyJSONCreator.plotlyJSONSchema);
                this.created = true;
            }
        };

        PlotlyGraphWidget.prototype.removeNode = function (gmeId) {

        };

        PlotlyGraphWidget.prototype.updateNode = function (desc) {

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
    }
);
