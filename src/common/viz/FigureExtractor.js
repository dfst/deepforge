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
        extract (nodeInfo) {
            const extractorFn = nodeInfo.meta_type;
            ensureCanExtract(extractorFn);
            return this[extractorFn](nodeInfo);
        }

        extractChildrenOfType (nodeInfo, metaType) {
            const children = nodeInfo.children;
            return children.filter(childInfo => childInfo.meta_type === metaType)
                .map(childInfo => this.extract(childInfo));
        }

        [EXTRACTORS.GRAPH] (nodeInfo) {
            const id = nodeInfo.id,
                execId = nodeInfo.execution_id;

            let desc = {
                id: id,
                execId: execId,
                type: 'graph',
                name: nodeInfo.attributes.name,
                graphId: nodeInfo.attributes.id,
                title: nodeInfo.attributes.title
            };

            desc.subGraphs = nodeInfo.children.map((childInfo) => {
                const childNodeFn = childInfo.meta_type;
                ensureCanExtract(childNodeFn);
                return this[childNodeFn](childInfo);
            });
            return desc;
        }

        [EXTRACTORS.SUBGRAPH] (nodeInfo) {
            const id = nodeInfo.id,
                graphId = nodeInfo.parent_id,
                execId = this.execution_id;
            let desc;

            desc = {
                id: id,
                execId: execId,
                type: nodeInfo.meta_type === EXTRACTORS.PLOT3D ? 'plot3D' : 'plot2D',
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
                execId = nodeInfo.execution_id;
            let points, desc;

            points = nodeInfo.attributes.points.split(';')
                .filter(data => !!data)  // remove any ''
                .map(pair => extractPointsArray(pair));

            desc = {
                id: id,
                execId: execId,
                subgraphId: nodeInfo.parent_id,
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
                execId = nodeInfo.execution_id,
                imageHeight = nodeInfo.attributes.height,
                imageWidth = nodeInfo.attributes.width,
                numChannels = nodeInfo.attributes.numChannels;
            const colorModel = numChannels === 3 ? 'rgb' : 'rgba';
            return {
                id: id,
                execId: execId,
                subgraphId: nodeInfo.parent_id,
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
                execId = nodeInfo.execution_id;
            let points, desc;

            points = nodeInfo.attributes.points.split(';')
                .filter(data => !!data)  // remove any ''
                .map(pair => extractPointsArray(pair));
            desc = {
                id: id,
                execId: execId,
                subgraphId: nodeInfo.parent_id,
                marker: nodeInfo.attributes.marker,
                name: nodeInfo.attributes.name,
                type: 'scatterPoints',
                points: points,
                width: nodeInfo.attributes.width,
                color: nodeInfo.attributes.color
            };

            return desc;
        }

        getExecutionId (/* node */) {
            throw new Error('getExecutionId is not implemented');
        }

        getGraphNode (/* node */) {
            throw new Error('getGraphNode is not implemented');
        }

        _getContainmentParentNodeAt (/* node, metaType */) {
            throw new Error('_getContainmentParentNodeAt is not implemented');
        }

        getMetaType (/* node */) {
            throw new Error('getMetaType is not implmented');
        }

        GMENodeToMetadataJSON (/* node, shallow=false */) {
            throw new Error('GMENodeTOMetadataJSON is not implemented');
        }
    }

    class ClientFigureExtractor extends AbstractFigureExtractor {
        constructor(client) {
            super();
            this._client = client;
        }

        getExecutionId (node) {
            const executionNode = this._getContainmentParentNodeAt(node, 'Execution');
            if (executionNode){
                return executionNode.getId();
            }
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

        getGraphNode (node) {
            return this._getContainmentParentNodeAt(node, 'Graph');
        }

        _getContainmentParentNodeAt (node, metaType) {
            let currentNode = node,
                parentId = currentNode.getParentId();
            const isMetaType = node => this.getMetaType(node) === metaType;
            while (parentId !== null && !isMetaType(currentNode)) {
                currentNode = this._client.getNode(parentId);
                parentId = currentNode.getParentId();
            }
            return isMetaType(currentNode) ? currentNode : null;
        }

        getMetaType (node) {
            const metaTypeId = node.getMetaTypeId();
            const metaNode = this._client.getNode(metaTypeId);
            if(metaNode) {
                return metaNode.getAttribute('name');
            }
        }

        GMENodeToMetadataJSON (node, shallow=false) {
            const json = {
                id: node.getId(),
                parent_id: node.getParentId(),
                execution_id: this.getExecutionId(node),
                meta_type: this.getMetaType(node),
                attributes: {},
                attributes_meta: {}
            };

            node.getOwnAttributeNames().forEach(name => {
                json.attributes[name] = node.getAttribute(name);
            });

            node.getOwnValidAttributeNames().forEach(name => {
                json.attributes_meta[name] = node.getAttribute(name);
            });

            if(!shallow) {
                json.children = [];
                const children = this.getMetadataChildrenIds(node).map(id => this._client.getNode(id));
                children.forEach(node => {
                    json.children.push(this.GMENodeToMetadataJSON(node));
                });
            }
            return json;
        }
    }

    class CoreFigureExtractor extends AbstractFigureExtractor {
        constructor(core, rootNode) {
            super();
            this._core = core;
            this._rootNode = rootNode;
        }

        getExecutionId (node) {
            const executionNode = this._getContainmentParentNodeAt(node, 'Execution');
            if(executionNode) {
                return this._core.getPath(executionNode);
            }
        }

        async getMetadataChildren (node) {
            const children = await this._core.loadChildren(node);
            const allMetaNodes = this._core.getAllMetaNodes(this._rootNode);
            const metadataNodePath = Object.keys(allMetaNodes).find(nodeId => {
                return this.getMetaType(allMetaNodes[nodeId]) === BASE_METADATA_TYPE;
            });

            return children.filter(
                child => {
                    return this._core.isTypeOf(child, metadataNodePath);
                }
            );
        }

        getGraphNode (node) {
            return this._getContainmentParentNodeAt(node, 'Graph');
        }

        _getContainmentParentNodeAt (node, metaType) {
            let currentNode = node,
                parent = this._core.getParent(node);
            const isMetaType = node => this.getMetaType(node) === metaType;

            while(parent != null && !isMetaType(currentNode)){
                currentNode = parent;
                parent = this._core.getParent(currentNode);
            }
            return isMetaType(currentNode) ? currentNode : null;
        }

        getMetaType (node) {
            if (node) {
                return this._core.getAttribute(this._core.getMetaType(node), 'name');
            }
        }

        async GMENodeToMetadataJSON (node, shallow=false) {
            const json = {
                id: this._core.getPath(node),
                parent_id: this._core.getPath(this._core.getParent(node)),
                execution_id: this.getExecutionId(node),
                meta_type: this.getMetaType(node),
                attributes: {},
                attributes_meta: {}
            };

            this._core.getOwnAttributeNames(node).forEach(name => {
                json.attributes[name] = this._core.getAttribute(node, name);
            });

            this._core.getOwnValidAttributeNames(node).forEach(name => {
                json.attributes_meta[name] = this._core.getAttribute(node, name);
            });

            if(!shallow) {
                json.children = [];
                const children = await this.getMetadataChildren(node);
                for (let i = 0; i < children.length; i++) {
                    json.children.push(await this.GMENodeToMetadataJSON(children[i]));
                }
            }
            return json;
        }
    }

    return { ClientFigureExtractor, CoreFigureExtractor };
});
