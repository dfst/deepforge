/*globals define, WebGMEGlobal*/
/*eslint browser: true*/

define([], function () {
    const GraphDescExtractor = function (client) {
        this._client = client;
    };

    GraphDescExtractor.prototype.constructor = GraphDescExtractor;

    GraphDescExtractor.prototype.getGraphDesc = function (node) {
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
            subGraphs: []
        };
        let subGraphNodeIds = node.getChildrenIds();
        subGraphNodeIds.forEach((subGraphNodeId) => {
            let subGraphNode = this._client.getNode(subGraphNodeId);
            desc.subGraphs.push(this.getSubGraphDesc(subGraphNode));
        });
        desc.subGraphs.sort(this.compareSubgraphIDs);
        return desc;
    };

    GraphDescExtractor.prototype.getSubGraphDesc = function (node) {
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
            lines: []
        };

        const lineIds = node.getChildrenIds();
        lineIds.forEach((lineId) => {
            let lineNode = this._client.getNode(lineId);
            desc.lines.push(this.getLineDesc(lineNode));
        });
        return desc;
    };

    GraphDescExtractor.prototype.getLineDesc = function (node) {
        var id = node.getId(),
            subGraphId = node.getParentId(),
            graphId = this._client.getNode(subGraphId).getParentId(),
            jobId = this._client.getNode(graphId).getParentId(),
            execId = this._client.getNode(jobId).getParentId(),
            points,
            desc;

        points = node.getAttribute('points').split(';')
            .filter(data => !!data)  // remove any ''
            .map(pair => {
                var nums = pair.split(',').map(num => parseFloat(num));
                return {
                    x: nums[0],
                    y: nums[1]
                };
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


    GraphDescExtractor.prototype.compareSubgraphIDs = function (desc1, desc2) {
        if (desc1.subgraphId >= desc2.subgraphId) return 1;
        else return -1;
    };


    return GraphDescExtractor;
});