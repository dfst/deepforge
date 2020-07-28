/* globals define */
define([
    'deepforge/storage/index',
    'deepforge/viz/PlotlyDescExtractor',
    'deepforge/viz/FigureExtractor',
    './Version',
    'q'
], function(
    Storage,
    PlotlyDescExtractor,
    FigureExtractor,
    Version,
    Q
) {
    const GRAPH = 'Graph';
    const getGraphNodes = async function(core, rootNode, graphNodes=[]) {
        const children = await core.loadChildren(rootNode);
        for(let i = 0; i < children.length; i++) {
            if (core.getAttribute(children[i], 'name') === GRAPH && !core.isMetaNode(children[i])) {
                graphNodes.push(children[i]);
            }
            await getGraphNodes(core, children[i], graphNodes);
        }
    };

    const addMetadataMixinToNodeSubTree = async function(core, META, node) {
        const METADATA_NODE_PATH =  core.getPath(META['pipeline.Metadata']);
        const IMPLICIT_OPERATION_NODE = META['pipeline.ImplicitOperation'];
        const graphNodeChildren = (await core.loadSubTree(node))
            .filter(node => {
                return IMPLICIT_OPERATION_NODE ?
                    !core.isTypeOf(node, IMPLICIT_OPERATION_NODE) :
                    true;
            });

        graphNodeChildren.forEach(node => {
            core.addMixin(node, METADATA_NODE_PATH);
        });
    };

    const getPipelineLibraryVersion = function(core, rootNode) {
        const pipelineRoot = core.getLibraryRoot(rootNode, 'pipeline');
        const hasPipelineLibrary = !!pipelineRoot;
        if (hasPipelineLibrary) {
            const versionString = core.getAttribute(pipelineRoot, 'version');
            return new Version(versionString);
        }
    };

    const allUpdates = [
        {
            name: 'CustomUtilities',
            isNeeded: function(core, rootNode) {
                // Check the root directory for a MyUtilities node
                return core.loadChildren(rootNode)
                    .then(children => {
                        const names = children.map(node => core.getAttribute(node, 'name'));
                        return !names.includes('MyUtilities');
                    });
            },
            apply: function(core, rootNode, META) {
                // Create 'MyUtilities' node
                const utils = core.createNode({
                    parent: rootNode,
                    base: META.FCO
                });
                core.setAttribute(utils, 'name', 'MyUtilities');

                // Add 'MyUtilities' to the META
                const META_ASPECT_SET_NAME = 'MetaAspectSet';
                const META_SHEETS = 'MetaSheets';
                const tabId = core.getRegistry(rootNode, META_SHEETS)
                    .find(desc => desc.order === 0)
                    .SetID;

                core.addMember(rootNode, META_ASPECT_SET_NAME, utils);
                core.addMember(rootNode, tabId, utils);

                // Add 'Code' from 'pipelines' as a valid child
                core.setChildMeta(utils, META['pipeline.Code']);

                // Set the default visualizer to TabbedTextEditor
                core.setRegistry(utils, 'validVisualizers', 'TabbedTextEditor');
            }
        },
        {
            name: 'UpdateDataNodesToUserAssets',
            isNeeded: async function(core, rootNode) {
                const pipelineLibraryVersion = getPipelineLibraryVersion(core, rootNode);
                if(pipelineLibraryVersion) {
                    return pipelineLibraryVersion.lessThan(new Version('0.13.0'));
                }
            },
            apply: async function(core, rootNode, META) {
                const isDataNode = node => core.getMetaType(node) === META['pipeline.Data'];
                const dataNodes = (await core.loadSubTree(rootNode))
                    .filter(isDataNode)
                    .filter(node => !core.isLibraryElement(node));

                const storageClient = await Storage.getBackend('gme').getClient();
                for (let i = dataNodes.length; i--;) {
                    const node = dataNodes[i];
                    const hash = core.getAttribute(node, 'data');
                    if (hash && !hash.includes('{')) {  // not already updated
                        const dataInfo = storageClient.createDataInfo(hash);
                        core.setAttribute(node, 'data', JSON.stringify(dataInfo));
                    }
                }
            }
        },
        {
            name: 'UpdateGraphContainment',
            beforeLibraryUpdates: true,
            isNeeded: async function(core, rootNode) {
                const pipelineLibraryVersion = getPipelineLibraryVersion(core, rootNode);
                if (pipelineLibraryVersion) {
                    return pipelineLibraryVersion.lessThan(new Version('0.22.0')) &&
                           pipelineLibraryVersion.greaterThan(new Version('0.19.1'));
                }
            },
            apply: async function(core, rootNode, META) {
                let graphNodes = [];
                await getGraphNodes(core, rootNode, graphNodes);
                const coreFigureExtractor = new FigureExtractor.CoreFigureExtractor(core, rootNode);
                const pipelineVersion = getPipelineLibraryVersion(core, rootNode);
                const shouldAddMetadataMixin = pipelineVersion ?
                    pipelineVersion.lessThan(new Version('0.21.1')) :
                    false;

                for (let i = 0; i < graphNodes.length; i++){
                    const graphNode = graphNodes[i];
                    if(shouldAddMetadataMixin){
                        await addMetadataMixinToNodeSubTree(core, META, graphNode);
                    }
                    const desc = await coreFigureExtractor.extract(graphNode);
                    const plotlyJSON = PlotlyDescExtractor.descToPlotlyJSON(desc);
                    const parentNode = core.getParent(graphNode);
                    const updatedGraphNode = core.createNode({
                        parent: parentNode,
                        base: META['pipeline.Graph']
                    });
                    core.setAttribute(updatedGraphNode, 'data', JSON.stringify(plotlyJSON));
                    core.deleteNode(graphNode);
                }
            }
        }
    ];

    const Updates = {};

    Updates.getAvailableUpdates = function(core, rootNode) {
        return Q.all(allUpdates.map(update => update.isNeeded(core, rootNode)))
            .then(isNeeded => {
                const updates = allUpdates.filter((update, i) => isNeeded[i]);
                return updates;
            });
    };

    Updates.getUpdates = function(names) {
        if (names) {
            return allUpdates.filter(update => names.includes(update.name));
        }
        return allUpdates;
    };

    Updates.getUpdate = function(name) {
        return Updates.getUpdates([name])[0];
    };

    // Constants
    Updates.MIGRATION = 'Migration';
    Updates.SEED = 'SeedUpdate';
    return Updates;
});
