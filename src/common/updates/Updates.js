/* globals define */
define([
    'deepforge/storage/index',
    './Version',
    'q'
], function(
    Storage,
    Version,
    Q
) {

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
                const pipelineRoot = core.getLibraryRoot(rootNode, 'pipeline');
                const hasPipelineLibrary = !!pipelineRoot;
                if (hasPipelineLibrary) {
                    const versionString = core.getAttribute(pipelineRoot, 'version');
                    const version = new Version(versionString);
                    return version.lessThan(new Version('0.13.0'));
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
