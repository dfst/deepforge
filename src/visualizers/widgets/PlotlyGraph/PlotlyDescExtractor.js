/*globals define*/
define([], function () {
    const PlotlyDescExtractor = {};

    PlotlyDescExtractor.descToPlotlyJSON = function (desc) {
        let plotlyJSON = {id: desc.id};

        addSubGraphAxisAndDomains(desc, 2);

        const dataArray = desc.subGraphs.map((subGraph)=>{
            return createTraces(subGraph);
        });

        plotlyJSON.data = flatten(dataArray);

        plotlyJSON.layout = createLayout(desc);

        return plotlyJSON;
    };

    /*** Helper Methods For Creating The plotly JSON Reference ***/
    const TRACE_TYPES = {
        SCATTER: 'scatter',
        IMAGE: 'image',
        SCATTER_POINTS: 'scatter',
        SCATTER_3D: 'scatter3d',
        SCATTER_POINTS_3D: 'scatter3d'
    };

    const needsTightLayout = function (desc, label) {
        return !!desc.subGraphs.find(subGraph => hasTitleAndAxisLabel(subGraph, label));
    };

    const hasTitleAndAxisLabel = function (subGraph, axisLabel) {
        return subGraph.title && subGraph[axisLabel];
    };

    const is3D = function (subGraph) {
        return subGraph.type === 'plot3D';
    };

    const descHasMultipleSubPlots = function (desc) {
        return desc.subGraphs.length > 1;
    };

    const descHasNoSubPlots = function (desc) {
        return desc.subGraphs.length === 0;
    };

    const addSubGraphAxisAndDomains = function (desc, numCols=2) {
        const numRows = Math.ceil(desc.subGraphs.length/ numCols);
        const colSep = 1/numCols;
        const rowSep = 1/numRows;
        let colCount = 0,
            rowCount=0,
            sceneCount=1,
            axisCount=1;

        const xMargin = needsTightLayout(desc, 'xlabel') ? 0.10 : 0.05;
        const yMargin = needsTightLayout(desc, 'ylabel') ? 0.10 : 0.05;

        desc.subGraphs.forEach((subGraph, index) => {
            const xDomain = [colCount * colSep + xMargin, (colCount + 1) * colSep];
            const yDomain = [1-(rowCount+1)*rowSep + yMargin, 1-rowCount*rowSep];
            ++colCount;
            if((index+1) % numCols === 0){
                colCount = 0;
                ++rowCount;
            }
            if(is3D(subGraph)){
                subGraph.scene = {
                    name: `scene${sceneCount}`,
                    domain: {
                        x: xDomain,
                        y: yDomain
                    }
                };
                sceneCount++;
            } else {
                subGraph.xaxis = {
                    name: `xaxis${axisCount}`,
                    ref: `x${axisCount}`,
                    domain: xDomain
                };
                subGraph.yaxis = {
                    name: `yaxis${axisCount}`,
                    ref: `y${axisCount}`,
                    domain: yDomain
                };
                axisCount++;
            }
        });
    };

    const createTraces = function (subGraph) {
        const traceArr = createLineTraces(subGraph);
        traceArr.push(...createScatterPointsTraces(subGraph));
        if(!is3D(subGraph)){
            traceArr.push(...createImageTraces(subGraph));
        }
        return traceArr;
    };

    const createLineTraces = function (subGraph) {
        const lineTraceArr = subGraph.lines.map((line) => {
            const points = pointsToCartesianArray(line.points);
            let traceData = {
                x: points[0],
                y: points[1],
                name: line.label,
                mode: !!line.marker ? 'lines+markers' : 'lines',
            };
            if(is3D(subGraph)){
                traceData.z = points[2];
                traceData.type = TRACE_TYPES.SCATTER_3D;
                traceData.scene = subGraph.scene.name;
                if(!!line.marker){
                    traceData.marker = {
                        size: 1
                    };
                }
            } else {
                traceData.type = TRACE_TYPES.SCATTER;
                traceData.xaxis = subGraph.xaxis.ref;
                traceData.yaxis = subGraph.yaxis.ref;
            }
            traceData.line = {
                width: parseFloat(line.lineWidth),
                color: line.color,
            };
            return traceData;
        });
        return lineTraceArr;
    };

    const createScatterPointsTraces = function (subGraph) {
        const scatterTraceArr = subGraph.scatterPoints.map((scatterPoint) => {
            const points = pointsToCartesianArray(scatterPoint.points);
            let traceData = {
                x: points[0],
                y: points[1],
                name: 'scatter points',
                type: TRACE_TYPES.SCATTER_POINTS,
                mode: 'markers',
                marker: {
                    color: scatterPoint.color,
                    size: Math.sqrt(scatterPoint.width)
                },
            };
            if(is3D(subGraph)){
                traceData.z = points[2];
                traceData.type = TRACE_TYPES.SCATTER_POINTS_3D;
                traceData.scene = subGraph.scene.name;
            } else {
                traceData.xaxis = subGraph.xaxis.ref;
                traceData.yaxis = subGraph.yaxis.ref;
            }
            return traceData;
        });
        return scatterTraceArr;
    };

    const createImageTraces = function (subGraph) {
        const imageArr = subGraph.images.map(image => {
            let traceData = {
                type: TRACE_TYPES.IMAGE,
                z: image.rgbaMatrix,
                colormodel: image.colorModel,
                xaxis: subGraph.xaxis.ref,
                yaxis: subGraph.yaxis.ref
            };
            return traceData;
        });
        return imageArr;
    };

    const createLayout = function (desc) {
        const multipleSubPlots = descHasMultipleSubPlots(desc);
        let layout = {
            title: desc.title,
            autosize: !multipleSubPlots
        };
        let axisProperties;

        if(multipleSubPlots){
            const numRows = Math.ceil(desc.subGraphs.length/2);
            layout.height = numRows === 1 ? 500 : 250 * numRows;
            layout.grid = {
                rows: numRows,
                columns: 2,
                pattern: 'independent'
            };
            desc.subGraphs.forEach((subGraph) => {
                if(is3D(subGraph)){
                    layout[subGraph.scene.name] = add3dSceneProperties(subGraph);
                } else {
                    axisProperties = add2dAxisProperties(subGraph);
                    layout[subGraph.xaxis.name] = axisProperties.xaxis;
                    layout[subGraph.yaxis.name] = axisProperties.yaxis;
                }
            });
        } else if(!descHasNoSubPlots(desc)) {
            if (!layout.title){
                layout.title = desc.subGraphs[0].title;
            }
            else {
                layout.title = {
                    text: `${layout.title}<br>${desc.subGraphs[0].title}`
                };
            }
            if(is3D(desc.subGraphs[0])){
                layout.scene = add3dSceneProperties(desc.subGraphs[0]);
                layout.scene.domain = {
                    x: [0, 1],
                    y: [0, 1]
                };
            } else {
                axisProperties = add2dAxisProperties(desc.subGraphs[0]);
                layout.xaxis = axisProperties.xaxis;
                layout.yaxis = axisProperties.yaxis;
                layout.xaxis.domain = [0, 1];
                layout.yaxis.domain = [0, 1];
            }
        }
        layout.annotations = addAnnotations(desc.subGraphs);
        return layout;
    };

    const pointsToCartesianArray = function (points) {
        let x = [],
            y = [],
            z = [];
        points.forEach((point) => {
            x.push(point.x);
            y.push(point.y);
            if(point.z){
                z.push(point.z);
            }
        });
        return z.length > 0 ? [x, y, z]: [x, y];
    };

    const flatten = function (arr) {
        return arr.reduce(function (flat, toFlatten) {
            return flat.concat(Array.isArray(toFlatten) ? flatten(toFlatten) : toFlatten);
        }, []);
    };

    const add3dSceneProperties = function (subGraph) {
        const AXES_FONT = {
            color: '#7f7f7f',
            size: 10
        };
        const props = {
            domain: subGraph.scene.domain,
            xaxis: {
                title: {
                    text: subGraph.xlabel,
                    font: AXES_FONT,
                    standoff: 0
                }
            },
            yaxis: {
                title: {
                    text: subGraph.ylabel,
                    font: AXES_FONT,
                    standoff: 0
                }
            },
            zaxis: {
                title: {
                    text: subGraph.zlabel,
                    font: AXES_FONT
                }
            }
        };
        return props;
    };

    const add2dAxisProperties = function (subGraph) {
        const xaxis = {
            domain: subGraph.xaxis.domain,
            title: {
                text: subGraph.xlabel,
                color: '#7f7f7f',
                font : {
                    size: 10,
                },
                standoff: 0
            },
            visible: subGraph.images.length === 0
        };

        const yaxis = {
            domain: subGraph.yaxis.domain,
            title: {
                text: subGraph.ylabel,
                color: '#7f7f7f',
                font : {
                    size: 10,
                },
                standoff: 0
            },
            visible: subGraph.images.length === 0
        };
        return {xaxis, yaxis};
    };

    // https://github.com/plotly/plotly.js/issues/2746#issuecomment-528342877
    // At present the only hacky way to add subplots title
    const addAnnotations = function (subGraphs) {
        const average = arr => arr.reduce((runningSum, another) => runningSum + another, 0) / arr.length;
        if(subGraphs.length === 1){
            subGraphs[0].title = '';
        }
        return subGraphs.map(subGraph => {
            const midPointX = average(is3D(subGraph) ? subGraph.scene.domain.x : subGraph.xaxis.domain);
            const yPosition =  (is3D(subGraph) ? subGraph.scene.domain.y[1] : subGraph.yaxis.domain[1]) + 0.005;
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
                xanchor: 'center',
                yanchor: 'bottom',
                x: midPointX,
                y: yPosition
            };
        });
    };

    return PlotlyDescExtractor;
});


