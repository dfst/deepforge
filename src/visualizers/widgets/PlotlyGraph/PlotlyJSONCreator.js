/*globals define*/
/*eslint-env browser*/
define(['./lib/changeset'], function (diff) {
    'use strict';
    const PlotlyJSONCreator = function () {
        this.plotlyJSONSchema = null;
    };

    PlotlyJSONCreator.prototype.constructor = PlotlyJSONCreator;

    // Create a plotly reference from the give Description
    PlotlyJSONCreator.prototype.create = function (desc) {
        this.plotlyJSONSchema = this._descToPlotlyJSON(desc);
    };

    PlotlyJSONCreator.prototype.update = function (newDesc) {
        if (!this.plotlyJSONSchema) {
            this.create(newDesc);
            return;
        }
        let newJSONSchema = this._descToPlotlyJSON(newDesc);
        let changes = diff(this.plotlyJSONSchema, newJSONSchema);
        diff.apply(changes, this.plotlyJSONSchema, true);
    };

    PlotlyJSONCreator.prototype.delete = function () {
        this.plotlyJSONSchema = null;
    };

    PlotlyJSONCreator.prototype._descToPlotlyJSON = function (desc) {
        let plotlyJSON = {};
        plotlyJSON.layout = createLayout(desc);
        let dataArr = desc.subGraphs.map((subGraph, index) => {
            return createScatterTraces(subGraph, index);
        });
        plotlyJSON.data = flatten(dataArr);
        const axesData = addAxesLabels(desc.subGraphs);
        Object.keys(axesData).forEach((axis) => {
            plotlyJSON.layout[axis] = axesData[axis];
        });
        return plotlyJSON;
    };
    /*** Helper Methods For Creating The plotly JSON Reference ***/
    const TraceTypes = {
        SCATTER: 'scatter',
        IMAGE: 'image'
    };

    const descHasMultipleSubPlots = function (desc) {
        return desc.subGraphs.length > 1;
    };

    const createLayout = function (desc) {
        let layout = {
            title: desc.title,
        };
        // Every plot should be drawn as n * 2 Grid??
        if (descHasMultipleSubPlots(desc)) {
            const numRows = Math.ceil(desc.subGraphs.length / 2);
            layout.height = 250 * numRows;
            let subPlots = [];
            let currentSubplotAxes;
            for (let i = 0; i < numRows * 2; i += 2) {
                if (i === 0)
                    currentSubplotAxes = ['xy', 'x2y2'];
                else
                    currentSubplotAxes = [`x${i + 1}y${i + 1}`, `x${i + 2}y${i + 2}`];
                subPlots.push(currentSubplotAxes);
            }
            layout.grid = {
                subplots: subPlots
            };
            layout.annotations = addAnnotations(desc.subGraphs);
        } else {
            if (!layout.title)
                layout.title = desc.subGraphs[0].title;
            else
                layout.title = {
                    text: `${layout.title}<br>${desc.subGraphs[0].title}`
                };
        }
        return layout;
    };

    // https://github.com/plotly/plotly.js/issues/2746#issuecomment-528342877
    // At present the only hacky way to add subplots title
    const addAnnotations = function (subGraphs) {
        const evenLength = subGraphs.length % 2 === 0 ? subGraphs.length : subGraphs.length + 1;
        return subGraphs.map((subGraph, index) => {
            const yPosMarker = (index % 2 === 0) ? index : index - 1;
            return {
                text: `<b>${subGraph.title}</b>`,
                font: {
                    family: 'Arial',
                    color: 'black',
                    size: 14
                },
                showarrow: false,
                xref: 'paper',
                yref: 'paper',
                align: 'center',
                x: (index % 2 === 0) ? 0.15 : 0.85,
                y: (1 - yPosMarker / evenLength) * 1.1 - 0.06
            };
        });
    };

    const createScatterTraces = function (subGraph, index) {
        let traceArr = subGraph.lines.map(line => {
            let points = pointsToCartesianArray(line.points);
            let traceData = {
                x: points[0],
                y: points[1],
                name: line.label,
                type: TraceTypes.SCATTER,
                mode: line.marker ? "line+marker" : "line",
                line: {
                    width: line.lineWidth ? line.lineWidth : 3,
                    color: line.color
                },

            };
            if (index !== 0) {
                traceData.xaxis = `x${index + 1}`;
                traceData.yaxis = `y${index + 1}`;
            }
            return traceData;
        });
        return traceArr;
    };

    const addAxesLabels = function (subGraphs) {
        let axesData = {};
        subGraphs.forEach((subGraph, index) => {
            let xAxisName;
            let yAxisName;
            if (index === 0) {
                xAxisName = 'xaxis';
                yAxisName = 'yaxis';
            } else {
                xAxisName = `xaxis${index + 1}`;
                yAxisName = `yaxis${index + 1}`;
            }
            axesData[xAxisName] = {
                title: {
                    text: subGraph.xlabel,
                    color: '#7f7f7f',
                    standoff: 0
                }

            };

            axesData[yAxisName] = {
                title: {
                    text: subGraph.ylabel,
                    color: '#7f7f7f',
                    standoff: 0
                }
            };
        });
        return axesData;
    };

    const pointsToCartesianArray = function (points) {
        let x = [],
            y = [];
        points.forEach((point) => {
            x.push(point.x);
            y.push(point.y);
        });
        return [x, y];
    };

    const flatten = function (arr) {
        return arr.reduce(function (flat, toFlatten) {
            return flat.concat(Array.isArray(toFlatten) ? flatten(toFlatten) : toFlatten);
        }, []);
    };

    return PlotlyJSONCreator;
});