/*globals define*/
define([], function () {
    const PlotlyDescExtractor = {};

    PlotlyDescExtractor.descToPlotlyJSON = function (desc) {
        let plotlyJSON = {};
        if (desc) {
            plotlyJSON.layout = createLayout(desc);
            let dataArr = desc.subGraphs.map((subGraph, index) => {
                return createTraces(subGraph, index);
            });
            plotlyJSON.data = flatten(dataArr);
            const axesData = addAxesLabelsAndTicks(desc.subGraphs);
            Object.keys(axesData).forEach((axis) => {
                plotlyJSON.layout[axis] = axesData[axis];
            });
            plotlyJSON.id = desc.id;
        }
        return plotlyJSON;
    };

    /*** Helper Methods For Creating The plotly JSON Reference ***/
    const TraceTypes = {
        SCATTER: 'scatter',
        IMAGE: 'image',
        SCATTER_POINTS: 'scatter'
    };

    const descHasMultipleSubPlots = function (desc) {
        return desc.subGraphs.length > 1;
    };

    const descHasNoSubPlots = function (desc) {
        return desc.subGraphs.length === 0;
    };

    const createLayout = function (desc) {
        let layout = {
            title: desc.title,
            height: 500
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
        } else if(!descHasNoSubPlots(desc)) {
            if (!layout.title){
                layout.title = desc.subGraphs[0].title;
            }
            else {
                layout.title = {
                    text: `${layout.title}<br>${desc.subGraphs[0].title}`
                };
            }
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
                    size: 12
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

    const createTraces = function (subGraph, index) {
        let traceArr = subGraph.lines.map(line => {
            let points = pointsToCartesianArray(line.points);
            let traceData = {
                x: points[0],
                y: points[1],
                name: line.label,
                type: TraceTypes.SCATTER,
                mode: line.marker ? 'line+marker' : 'line',
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
        traceArr.push(...subGraph.scatterPoints.map(scatterPoint => {
            let points = pointsToCartesianArray(scatterPoint.points);
            let traceData = {
                x: points[0],
                y: points[1],
                name: 'scatter points',
                type: TraceTypes.SCATTER_POINTS,
                mode: 'markers',
                marker: {
                    color: scatterPoint.color,
                    size: scatterPoint.width,
                }
            };
            if (index !== 0) {
                traceData.xaxis = `x${index + 1}`;
                traceData.yaxis = `y${index + 1}`;
            }
            return traceData;
        }));

        traceArr.push(...subGraph.images.map(image => {
            let traceData = {
                type: TraceTypes.IMAGE,
                z: image.rgbaMatrix,
                colormodel: image.colorModel
            };
            if (index !== 0) {
                traceData.xaxis = `x${index + 1}`;
                traceData.yaxis = `y${index + 1}`;
            }
            return traceData;
        }));

        return traceArr;
    };

    const addAxesLabelsAndTicks = function (subGraphs) {
        let axesData = {};
        subGraphs.forEach((subGraph, index) => {
            let xAxisName = `xaxis${index + 1}`;
            let yAxisName = `yaxis${index + 1}`;
            if (index === 0) {
                xAxisName = 'xaxis';
                yAxisName = 'yaxis';
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
            if (subGraph.images.length >= 1) {
                axesData[xAxisName].visible = false;
                axesData[yAxisName].visible = false;
            }
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


    return PlotlyDescExtractor;
});
