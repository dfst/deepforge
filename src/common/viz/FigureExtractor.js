/*globals define, _*/
define(['./Utils'], function (Utils) {
    const FigureExtractor = function (client) {
        this._client = client;
        this._metaNodesMap = this._initializeMetaNodesMap();
    };
    const EXTRACTORS = {
        GRAPH: 'Graph',
        SUB_GRAPH: 'SubGraph',
        IMAGE: 'Image',
        LINE: 'Line',
    };

    FigureExtractor.prototype._initializeMetaNodesMap = function () {
        const metaNodes = this._client.getAllMetaNodes();
        const idsAndTypes = metaNodes.map(node => [node.getId(), node.getAttribute('name')]);
        return _.object(idsAndTypes);
    };

    FigureExtractor.prototype.extract = function(node) {
        const extractorFn = this.getMetaType(node);
        return this[extractorFn](node);
    };

    FigureExtractor.prototype.constructor = FigureExtractor;

    FigureExtractor.prototype[EXTRACTORS.GRAPH] = function(node) {
        const [id, jobId, execId] = this.getIdHierarchy(node, 3); // eslint-disable-line no-unused-vars
        let desc = {
            id: id,
            execId: execId,
            type: 'graph',
            name: node.getAttribute('name'),
            graphId: node.getAttribute('id'),
            title: node.getAttribute('title'),
        };

        let childrenIds = node.getChildrenIds();
        let childNode, childNodeFn;
        desc.subGraphs = childrenIds.map((childId) => {
            childNode = this._client.getNode(childId);
            childNodeFn = this.getMetaType(childNode);
            return this[childNodeFn](childNode);
        });
        desc.subGraphs.sort(this.compareSubgraphIDs);
        return desc;
    };

    FigureExtractor.prototype[EXTRACTORS.SUB_GRAPH] = function (node) {
        const [id, graphId, jobId, execId] = this.getIdHierarchy(node, 4); // eslint-disable-line no-unused-vars
        let desc;

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
        desc.lines = children.filter(node => this.getMetaType(node) === EXTRACTORS.LINE)
            .map(lineNode => this[this.getMetaType(lineNode)](lineNode));
        desc.images = children.filter(node => this.getMetaType(node) === EXTRACTORS.IMAGE)
            .map(imageNode => this[this.getMetaType(imageNode)](imageNode));

        return desc;
    };

    FigureExtractor.prototype[EXTRACTORS.LINE] = function (node) {
        const ids= this.getIdHierarchy(node, 5),
            id = ids[0],
            execId = ids[ids.length-1];
        let points, desc;

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

    FigureExtractor.prototype[EXTRACTORS.IMAGE] = function (node) {
        const ids= this.getIdHierarchy(node, 5),
            id = ids[0],
            execId = ids[ids.length-1],
            imageHeight = node.getAttribute('height'),
            imageWidth = node.getAttribute('width'),
            numChannels = node.getAttribute('numChannels');
        const colorModel = numChannels === 3 ? 'rgb' : 'rgba';
        return {
            id: id,
            execId: execId,
            subgraphId: this._client.getNode(node.getParentId()).getAttribute('id'),
            type: 'image',
            width: imageWidth,
            height: imageHeight,
            colorModel: colorModel,
            visible: node.getAttribute('visible'),
            rgbaMatrix: Utils.base64ToImageArray(node.getAttribute('rgbaMatrix'), imageWidth, imageHeight, numChannels)
        };
    };

    FigureExtractor.prototype.compareSubgraphIDs = function (desc1, desc2) {
        if (desc1.subgraphId >= desc2.subgraphId) return 1;
        else return -1;
    };

    FigureExtractor.prototype.getIdHierarchy = function (node, level) {
        const ids = [];
        let currentNode = node;
        for(let i = 0; i < level; i++) {
            ids.push(currentNode.getId());
            currentNode = this._client.getNode(currentNode.getParentId());
        }
        return ids;
    };

    FigureExtractor.prototype.getMetaType = function (node) {
        const metaTypeId = node.getMetaTypeId();
        return this._metaNodesMap[metaTypeId];
    };

    return FigureExtractor;
});
