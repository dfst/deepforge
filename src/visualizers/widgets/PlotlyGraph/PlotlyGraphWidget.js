/*globals define, WebGMEGlobal*/
define(['./lib/plotly.min', './PlotlyJSONCreator'], function (Plotly, PlotlyJSONCreator) {
    'use strict';

    const WIDGET_CLASS = 'plotly-graph';
    const plotlyJSONCreator = new PlotlyJSONCreator();

    function PlotlyGraphWidget(logger, container) {
        this.logger = logger.fork('widget');
        this.$el = container;
        this.$el.css('overflow', 'auto');
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
        let desc = {
            title: 'My Plotly Graph',
            subGraphs: [
                {
                    title: 'Subplot Two',
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
                        ]
                    }]
                },
                {
                    title: 'Subplot Three',
                    lines: [{
                        points: [
                            {
                                x: 20,
                                y: 50
                            },
                            {
                                x: 30,
                                y: 60
                            },
                            {
                                x: 40,
                                y: 70
                            }
                        ]
                    }, {
                        points: [
                            {
                                x: 18,
                                y: 255
                            },
                            {
                                x: 60,
                                y: 270
                            },
                            {
                                x: 100,
                                y: 180
                            }
                        ]
                    }]
                },
                {
                    title: 'Subplot Four',
                    lines: [{
                        label: 'MyTrace',
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
                        ]
                    }]
                },
                {
                    title: 'Subplot Five',
                    lines: [{
                        points: [
                            {
                                x: 20,
                                y: 50
                            },
                            {
                                x: 30,
                                y: 60
                            },
                            {
                                x: 40,
                                y: 70
                            }
                        ]
                    }, {
                        points: [
                            {
                                x: 18,
                                y: 255
                            },
                            {
                                x: 60,
                                y: 270
                            },
                            {
                                x: 100,
                                y: 180
                            }
                        ]
                    }]
                },
                {
                    title: 'Subplot Six',
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
                        ]
                    }]
                },
                {
                    title: 'Subplot Seven',
                    lines: [{
                        points: [
                            {
                                x: 20,
                                y: 50
                            },
                            {
                                x: 30,
                                y: 60
                            },
                            {
                                x: 40,
                                y: 70
                            }
                        ]
                    }, {
                        points: [
                            {
                                x: 18,
                                y: 255
                            },
                            {
                                x: 60,
                                y: 270
                            },
                            {
                                x: 100,
                                y: 180
                            }
                        ]
                    }]
                },
                {
                    title: 'Subplot Eight',
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
                        ]
                    }]
                },
                {
                    title: 'Subplot Five',
                    lines: [{
                        points: [
                            {
                                x: 20,
                                y: 50
                            },
                            {
                                x: 30,
                                y: 60
                            },
                            {
                                x: 40,
                                y: 70
                            }
                        ]
                    }, {
                        points: [
                            {
                                x: 18,
                                y: 255
                            },
                            {
                                x: 60,
                                y: 270
                            },
                            {
                                x: 100,
                                y: 180
                            }
                        ]
                    }]
                },
                {
                    title: 'Subplot Six',
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
                        ]
                    }]
                },
                {
                    title: 'Subplot Seven',
                    lines: [{
                        points: [
                            {
                                x: 20,
                                y: 50
                            },
                            {
                                x: 30,
                                y: 60
                            },
                            {
                                x: 40,
                                y: 70
                            }
                        ]
                    }, {
                        points: [
                            {
                                x: 18,
                                y: 255
                            },
                            {
                                x: 60,
                                y: 270
                            },
                            {
                                x: 100,
                                y: 180
                            }
                        ]
                    }]
                },
                {
                    title: 'Subplot Eight',
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
                        ]
                    }]
                }
            ],
        };
        plotlyJSONCreator.create(desc);
        // console.log(plotsData);
        // plotsData.layout.xaxis = null;
        // plotsData.layout.yaxis = null;
        Plotly.newPlot(this.$el[0],
            plotlyJSONCreator.plotlyJSONSchema,
            {
                responsive: true,
                showsendtocloud: true
            });
        // console.log(plotsData.data);
        this.created = true;
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
        if (desc) {
            if (desc.type === 'line') {
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

    PlotlyGraphWidget.prototype.refreshChart = function () {
        if (this.created) {
            let data = this.getData();
            Plotly.react(this.$el[0], data, {}, config);
        }
    };

    // Only support 2D-Cartesian for now
    PlotlyGraphWidget.prototype._pointsToCartesianArray = function (points) {
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
