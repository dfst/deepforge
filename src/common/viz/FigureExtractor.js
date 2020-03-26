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
        SCATTER_POINTS: 'ScatterPoints'
    };

    FigureExtractor.prototype._initializeMetaNodesMap = function () {
        const metaNodes = this._client.getAllMetaNodes();
        const idsAndTypes = metaNodes.map(node => [node.getId(), node.getAttribute('name')]);
        return _.object(idsAndTypes);
    };

    FigureExtractor.prototype.extract = function(node) {
        const extractorFn = this.getMetaType(node);
        if (!Object.values(EXTRACTORS).includes(extractorFn)){
            throw new Error(`Node of type ${extractorFn} is not supported yet.`);
        } else {
            return this[extractorFn](node);
        }
    };

    FigureExtractor.prototype.constructor = FigureExtractor;

    FigureExtractor.prototype[EXTRACTORS.GRAPH] = function(node) {
        const id = node.getId(),
            execId = this.getExecutionId(node);

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
        const id = node.getId(),
            graphId = node.getParentId(),
            execId = this.getExecutionId(node);
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
            .map(lineNode => this.extract(lineNode));
        desc.images = children.filter(node => this.getMetaType(node) === EXTRACTORS.IMAGE)
            .map(imageNode => this.extract(imageNode));

        desc.scatterPoints = children.filter(node => this.getMetaType(node) == EXTRACTORS.SCATTER_POINTS)
            .map(scatterPointsNode => this.extract(scatterPointsNode));

        return desc;
    };

    FigureExtractor.prototype[EXTRACTORS.LINE] = function (node) {
        const id = node.getId(),
            execId = this.getExecutionId(node);
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
        const id = node.getId(),
            execId = this.getExecutionId(node),
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

    FigureExtractor.prototype[EXTRACTORS.SCATTER_POINTS] = function(node) {
        const id = node.getId(),
            execId = this.getExecutionId(node);
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
            marker: node.getAttribute('marker'),
            name: node.getAttribute('name'),
            type: 'scatterPoints',
            points: points,
            width: node.getAttribute('width'),
            color: node.getAttribute('color')
        };

        return desc;
    };

    FigureExtractor.prototype.compareSubgraphIDs = function (desc1, desc2) {
        if (desc1.subgraphId >= desc2.subgraphId) return 1;
        else return -1;
    };

    FigureExtractor.prototype.getExecutionId = function (node) {
        let currentNode = node,
            parentId = currentNode.getParentId();
        const EXECUTION_META_TYPE = 'Execution';
        const isExecution = node => this.getMetaType(node) === EXECUTION_META_TYPE;
        while (parentId !== null && !isExecution(currentNode)) {
            currentNode = this._client.getNode(parentId);
            parentId = currentNode.getParentId();
        }
        return isExecution(currentNode) ? currentNode.getId() : null;
    };

    FigureExtractor.prototype.getMetaType = function (node) {
        const metaTypeId = node.getMetaTypeId();
        return this._metaNodesMap[metaTypeId];
    };

    return FigureExtractor;
});
