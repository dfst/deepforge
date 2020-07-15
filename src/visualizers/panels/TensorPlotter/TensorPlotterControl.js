/*globals define */
/**
 * Generated by VisualizerGenerator 1.7.0 from webgme on Mon May 04 2020 17:09:31 GMT-0500 (Central Daylight Time).
 */

define([
    'panels/InteractiveExplorer/InteractiveExplorerControl',
], function (
    InteractiveExplorerControl,
) {

    'use strict';

    class TensorPlotterControl extends InteractiveExplorerControl {

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

    return TensorPlotterControl;
});
