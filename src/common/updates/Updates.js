/* globals define */
define([
    'q'
], function(
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
            apply: function(core, rootNode) {
                // Create 'MyUtilities' node
                // TODO

                // Add 'MyUtilities' to the META
                // TODO

                // Add 'Code' from 'pipelines' as a valid child
                // TODO

                // Set the default visualizer to TabbedTextEditor
                // TODO
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

    return Updates;
});
