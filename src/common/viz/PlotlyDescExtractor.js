/*globals define*/
define([], function () {
    const PlotlyDescExtractor = function (client) {
        this._client = client;
    };

    PlotlyDescExtractor.prototype.constructor = PlotlyDescExtractor;

    PlotlyDescExtractor.prototype.getGraphDesc = function (node) {
        const id = node.getId(),
            jobId = node.getParentId(),
            execId = this._client.getNode(jobId).getParentId();
        let desc = {
            id: id,
            execId: execId,
            type: 'graph',
            name: node.getAttribute('name'),
            graphId: node.getAttribute('id'),
            title: node.getAttribute('title'),
        };
        let subGraphNodeIds = node.getChildrenIds();
        desc.subGraphs = subGraphNodeIds.map((subGraphNodeId) => {
            let subGraphNode = this._client.getNode(subGraphNodeId);
            return this.getSubGraphDesc(subGraphNode);
        });
        desc.subGraphs.sort(this.compareSubgraphIDs);
        return desc;
    };

    PlotlyDescExtractor.prototype.getSubGraphDesc = function (node) {
        let id = node.getId(),
            graphId = node.getParentId(),
            jobId = this._client.getNode(graphId).getParentId(),
            execId = this._client.getNode(jobId).getParentId(),
            desc;

        desc = {
            id: id,
            execId: execId,
            type: 'subgraph',
            graphId: this._client.getNode(graphId).getAttribute('id'),
            subgraphId: node.getAttribute('id'),
            subgraphName: node.getAttribute('name'),
            title: node.getAttribute('title'),
            xlim: node.getAttribute('xlim'),
            ylim: node.getAttribute('ylim'),
            xlabel: node.getAttribute('xlabel'),
            ylabel: node.getAttribute('ylabel'),
        };

        const children = node.getChildrenIds().map(id => this._client.getNode(id));
        desc.lines = children.filter((node) => node.getValidAttributeNames().includes('points'))
            .map(lineNode => this.getLineDesc(lineNode));
        desc.images = children.filter(node => node.getValidAttributeNames().includes('rgbaMatrix'))
            .map(imageNode => this.getImageDesc(imageNode));
        return desc;
    };

    PlotlyDescExtractor.prototype.getLineDesc = function (node) {
        let id = node.getId(),
            subGraphId = node.getParentId(),
            graphId = this._client.getNode(subGraphId).getParentId(),
            jobId = this._client.getNode(graphId).getParentId(),
            execId = this._client.getNode(jobId).getParentId(),
            points,
            desc;

        points = node.getAttribute('points').split(';')
            .filter(data => !!data)  // remove any ''
            .map(pair => {
                const [x, y] = pair.split(',').map(num => parseFloat(num));
                return {x, y};
            });
        desc = {
            id: id,
            execId: execId,
            subgraphId: this._client.getNode(node.getParentId()).getAttribute('id'),
            lineName: node.getAttribute('name'),
            label: node.getAttribute('label'),
            name: node.getAttribute('name'),
            type: 'line',
            points: points,
            color: node.getAttribute('color')
        };

        return desc;
    };

    PlotlyDescExtractor.prototype.getImageDesc = function (imageNode) {
        const id = imageNode.getId(),
            subGraphId = imageNode.getParentId(),
            graphId = this._client.getNode(subGraphId).getParentId(),
            jobId = this._client.getNode(graphId).getParentId(),
            execId = this._client.getNode(jobId).getParentId(),
            imageHeight = imageNode.getAttribute('height'),
            imageWidth = imageNode.getAttribute('width'),
            numChannels = imageNode.getAttribute('numChannels');
        const colorModel = numChannels === 3 ? 'rgb' : 'rgba';
        return {
            id: id,
            execId: execId,
            subgraphId: this._client.getNode(imageNode.getParentId()).getAttribute('id'),
            type: 'image',
            width: imageWidth,
            height: imageHeight,
            colorModel: colorModel,
            visible: imageNode.getAttribute('visible'),
            rgbaMatrix: base64ToImageArray(imageNode.getAttribute('rgbaMatrix'), imageWidth, imageHeight, numChannels)
        };
    };

    PlotlyDescExtractor.prototype.compareSubgraphIDs = function (desc1, desc2) {
        if (desc1.subgraphId >= desc2.subgraphId) return 1;
        else return -1;
    };

    PlotlyDescExtractor.prototype.descToPlotlyJSON = function (desc) {
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
        IMAGE: 'image'
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


    const base64ToImageArray = function (base64String, width, height, numChannels) {
        const decodedString = atob(base64String);
        let bytes = new Uint8Array(decodedString.length);
        for (let i = 0; i < decodedString.length; i++) {
            bytes[i] = decodedString.charCodeAt(i);
        }
        return reshape(bytes, width, height, numChannels);
    };

    const reshape = function (bytesArray, width, height, numChannels) {
        let pixelArray = [], oneRow = [], rgbaArray = [];
        let i, j = 0;
        for (i = 0; i < height * numChannels; i += numChannels) {
            while (j < width * numChannels) {
                pixelArray = Array.from(bytesArray
                    .slice(i * width + j, i * width + j + numChannels).values());
                oneRow.push(pixelArray);
                j += numChannels;
            }
            j = 0;
            rgbaArray.push(oneRow);
            oneRow = [];
        }
        return rgbaArray;
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