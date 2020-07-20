/* globals define */
define(['./Utils'], function (Utils) {
    const BASE_METADATA_TYPE = 'Metadata';
    const EXTRACTORS = {
        GRAPH: 'Graph',
        SUBGRAPH: 'SubGraph',
        PLOT2D: 'Plot2D',
        PLOT3D: 'Plot3D',
        IMAGE: 'Image',
        LINE: 'Line',
        SCATTER_POINTS: 'ScatterPoints'
    };

    const ensureCanExtract = function(metaType) {
        if(!Object.values(EXTRACTORS).includes(metaType)) {
            throw new Error(`Node of type ${metaType} is not supported yet.`);
        }
    };

    const extractPointsArray = function (pair) {
        const pointsArr = pair.split(',').map(num => parseFloat(num));
        let cartesianPoint = {x: pointsArr[0], y: pointsArr[1]};
        if (pointsArr.length === 3) {
            cartesianPoint.z = pointsArr[2];
        }
        return cartesianPoint;
    };

    class AbstractFigureExtractor {

        _extract (nodeInfo) {
            const extractorFn = this.getMetaType(nodeInfo);
            ensureCanExtract(extractorFn);
            return this[extractorFn](nodeInfo);
        }

        extractChildrenOfType (nodeInfo, metaType) {
            const children = nodeInfo.children;
            return children.filter(childInfo => this.getMetaType(childInfo) === metaType)
                .map(childInfo => this._extract(childInfo));
        }

        [EXTRACTORS.GRAPH] (nodeInfo) {
            const id = nodeInfo.id,
                execId = this.getExecutionId(nodeInfo);

            let desc = {
                id: id,
                execId: execId,
                type: 'graph',
                name: nodeInfo.attributes.name,
                graphId: nodeInfo.attributes.id,
                title: nodeInfo.attributes.title
            };

            desc.subGraphs = nodeInfo.children.map((childInfo) => {
                const childNodeFn = this.getMetaType(childInfo);
                ensureCanExtract(childNodeFn);
                return this[childNodeFn](childInfo);
            });

            return desc;
        }

        [EXTRACTORS.SUBGRAPH] (nodeInfo) {
            const id = nodeInfo.id,
                graphId = nodeInfo.parent.id,
                execId = this.getExecutionId(nodeInfo);
            let desc;

            desc = {
                id: id,
                execId: execId,
                type: this.getMetaType(nodeInfo) === EXTRACTORS.PLOT3D ? 'plot3D' : 'plot2D',
                graphId: graphId,
                subgraphId: nodeInfo.attributes.id,
                subgraphName: nodeInfo.attributes.name,
                title: nodeInfo.attributes.title,
                xlim: nodeInfo.attributes.xlim,
                ylim: nodeInfo.attributes.ylim,
                xlabel: nodeInfo.attributes.xlabel,
                ylabel: nodeInfo.attributes.ylabel,
            };

            desc.lines = this.extractChildrenOfType(nodeInfo, EXTRACTORS.LINE);
            desc.scatterPoints = this.extractChildrenOfType(nodeInfo, EXTRACTORS.SCATTER_POINTS);
            return desc;
        }


        [EXTRACTORS.PLOT2D] (nodeInfo) {
            let desc = this[EXTRACTORS.SUBGRAPH](nodeInfo);
            desc.images = this.extractChildrenOfType(nodeInfo, EXTRACTORS.IMAGE);
            return desc;
        }

        [EXTRACTORS.PLOT3D] (nodeInfo) {
            let desc = this[EXTRACTORS.SUBGRAPH](nodeInfo);
            desc.zlim = nodeInfo.attributes.zlim;
            desc.zlabel = nodeInfo.attributes.zlabel;
            return desc;
        }

        [EXTRACTORS.LINE] (nodeInfo) {
            const id = nodeInfo.id,
                execId = this.getExecutionId(nodeInfo);
            let points, desc;

            points = nodeInfo.attributes.points.split(';')
                .filter(data => !!data)  // remove any ''
                .map(pair => extractPointsArray(pair));

            desc = {
                id: id,
                execId: execId,
                subgraphId: nodeInfo.parent.id,
                lineName: nodeInfo.attributes.name,
                label:  nodeInfo.attributes.label,
                lineWidth: nodeInfo.attributes.lineWidth,
                marker: nodeInfo.attributes.marker,
                name: nodeInfo.attributes.name,
                type: 'line',
                points: points,
                color: nodeInfo.attributes.color
            };
            return desc;
        }

        [EXTRACTORS.IMAGE] (nodeInfo) {
            const id = nodeInfo.id,
                execId = this.getExecutionId(nodeInfo),
                imageHeight = nodeInfo.attributes.height,
                imageWidth = nodeInfo.attributes.width,
                numChannels = nodeInfo.attributes.numChannels;
            const colorModel = numChannels === 3 ? 'rgb' : 'rgba';
            return {
                id: id,
                execId: execId,
                subgraphId: nodeInfo.parent.id,
                type: 'image',
                width: imageWidth,
                height: imageHeight,
                colorModel: colorModel,
                visible: nodeInfo.attributes.visible,
                rgbaMatrix: Utils.base64ToImageArray(nodeInfo.attributes.rgbaMatrix, imageWidth, imageHeight, numChannels)
            };
        }

        [EXTRACTORS.SCATTER_POINTS] (nodeInfo) {
            const id = nodeInfo.id,
                execId = this.getExecutionId(nodeInfo);
            let points, desc;

            points = nodeInfo.attributes.points.split(';')
                .filter(data => !!data)  // remove any ''
                .map(pair => extractPointsArray(pair));
            desc = {
                id: id,
                execId: execId,
                subgraphId: nodeInfo.parent.id,
                marker: nodeInfo.attributes.marker,
                name: nodeInfo.attributes.name,
                type: 'scatterPoints',
                points: points,
                width: nodeInfo.attributes.width,
                color: nodeInfo.attributes.color
            };

            return desc;
        }

        getExecutionId (nodeInfo) {
            return this._getContainmentParentNodeInfoAt(nodeInfo, 'Execution').id;
        }

        _getContainmentParentNodeInfoAt (nodeInfo, metaType) {
            let currentNodeInfo = nodeInfo,
                parentId = currentNodeInfo.parent.id;
            const isMetaType = nodeInfo => this.getMetaType(nodeInfo) === metaType;
            while (parentId && !isMetaType(currentNodeInfo)) {
                currentNodeInfo = currentNodeInfo.parent;
                parentId = currentNodeInfo.parent.id;
            }
            return isMetaType(currentNodeInfo) ? currentNodeInfo : null;
        }

        getMetaType (nodeInfo) {
            if(nodeInfo.base) {
                return nodeInfo.base.attributes.name;
            }
        }

        toJSON (/* node, shallow=false, cache={} */) {
            throw new Error('toJSON is not implemented');
        }
    }

    class ClientFigureExtractor extends AbstractFigureExtractor {
        constructor(client) {
            super();
            this._client = client;
        }

        extract(node) {
            const nodeInfo = this.toJSON(node);
            return this._extract(nodeInfo);
        }

        getMetadataChildrenIds (node) {
            const allMetaNodes = this._client.getAllMetaNodes();
            const metadataBaseNode = allMetaNodes
                .find(node => node.getAttribute('name') === BASE_METADATA_TYPE);

            if(metadataBaseNode) {
                return node.getChildrenIds().filter(id => {
                    return this._client.isTypeOf(id, metadataBaseNode.getId());
                });
            } else {
                return [];
            }
        }

        toJSON (node, shallow=false, cache={}) {
            if (cache[node.getId()]) {
                return cache[node.getId()];
            }
            const parentNode = this._client.getNode(node.getParentId());
            const baseNode = this._client.getNode(node.getBaseId());
            const json = {
                id: node.getId(),
                attributes: {},
            };

            cache[node.getId()] = json;

            node.getOwnAttributeNames().forEach(name => {
                json.attributes[name] = node.getAttribute(name);
            });
            if(!shallow) {
                json.children = [];
                const children = this.getMetadataChildrenIds(node).map(id => this._client.getNode(id));
                children.forEach(node => {
                    json.children.push(this.toJSON(node, false, cache));
                });
            }
            json.parent = parentNode ? this.toJSON(parentNode, true, cache): null;
            json.base = baseNode ? this.toJSON(baseNode, true, cache): null;
            return json;
        }
    }

    class CoreFigureExtractor extends AbstractFigureExtractor {
        constructor(core, rootNode) {
            super();
            this._core = core;
            this._rootNode = rootNode;
        }

        async extract (node) {
            const nodeInfo = await this.toJSON(node);
            return this._extract(nodeInfo);
        }

        async getMetadataChildren (node) {
            const children = await this._core.loadChildren(node);
            const allMetaNodes = this._core.getAllMetaNodes(this._rootNode);
            const metadataNodePath = Object.keys(allMetaNodes).find(nodeId => {
                return this._core.getAttribute(allMetaNodes[nodeId], 'name') === BASE_METADATA_TYPE;
            });

            return children.filter(
                child => {
                    return this._core.isTypeOf(child, metadataNodePath);
                }
            );
        }

        async toJSON (node, shallow=false, cache={}) {
            if (cache[this._core.getPath(node)]) {
                return cache[this._core.getPath(node)];
            }
            const parentNode = this._core.getParent(node);
            const baseNode = this._core.getBase(node);

            const json = {
                id: this._core.getPath(node),
                attributes: {},
            };

            cache[this._core.getPath(node)] = json;

            this._core.getOwnAttributeNames(node).forEach(name => {
                json.attributes[name] = this._core.getAttribute(node, name);
            });

            if(!shallow) {
                json.children = [];
                const children = await this.getMetadataChildren(node);
                for (let i = 0; i < children.length; i++) {
                    json.children.push(await this.toJSON(children[i], false, cache));
                }
            }
            json.parent = parentNode ? await this.toJSON(parentNode, true, cache): null;
            json.base = baseNode ? await this.toJSON(baseNode, true, cache): null;
            return json;
        }
    }

    return { ClientFigureExtractor, CoreFigureExtractor };
});
