/* globals define*/
define([
    'js/Constants',
    'panels/BreadcrumbHeader/NodePathNavigator'
], function(
    CONSTANTS,
    NodePathNavigator
) {
    var NodePathWithHidden = function() {
        NodePathNavigator.apply(this, arguments);
    };

    NodePathWithHidden.prototype = Object.create(NodePathNavigator.prototype);

    NodePathWithHidden.prototype.getNodePath = function() {
        var nodeIds = NodePathNavigator.prototype.getNodePath.apply(this, arguments),
            lastRootChildIndex = -1,
            node,
            i;

        // Treat any nodeIds in the root object as the same node then remove them
        // Hide any nodeIds in the root object
        for (i = nodeIds.length; i-- && lastRootChildIndex === -1;) {
            node = this.client.getNode(nodeIds[i]);
            if (node.getParentId() === CONSTANTS.PROJECT_ROOT_ID) {
                lastRootChildIndex = i;
            }
        }

        if (lastRootChildIndex > -1) {
            for (i = 1; i <= lastRootChildIndex; i++) {
                delete this.territories[nodeIds[i]];
            }
            nodeIds.splice(1, lastRootChildIndex);
            //nodeIds.unshift(CONSTANTS.PROJECT_ROOT_ID);
        }

        return nodeIds;
    };

    return NodePathWithHidden;
});
