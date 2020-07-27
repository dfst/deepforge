/*globals define */

define([
    'panels/InteractiveExplorer/InteractiveExplorerControl',
], function (
    InteractiveExplorerControl,
) {

    'use strict';

    class TrainKerasControl extends InteractiveExplorerControl {

        getObjectDescriptor(nodeId) {
            const desc = super.getObjectDescriptor(nodeId);

            if (desc) {
                const node = this.client.getNode(nodeId);
                desc.data = node.getAttribute('data');
                desc.type = node.getAttribute('type');
            }

            return desc;
        }

        getTerritory(nodeId) {
            const territory = {};
            const node = this.client.getNode(nodeId);
            const parentId = node.getParentId();
            territory[parentId] = {children: 1};

            const omitParentNode = event => event.eid !== parentId;
            this.territoryEventFilters = [omitParentNode];

            return territory;
        }
    }

    return TrainKerasControl;
});
