/* globals define, WebGMEGlobal*/
define([
    'js/Constants',
    'panels/BreadcrumbHeader/NodePathNavigator'
], function(
    CONSTANTS,
    NodePathNavigator
) {
    var PATH_SEP = '/';
    var NodePathWithHidden = function() {
        NodePathNavigator.apply(this, arguments);
    };

    NodePathWithHidden.prototype = Object.create(NodePathNavigator.prototype);

    NodePathWithHidden.prototype.getNodePath = function() {
        var nodeIds = NodePathNavigator.prototype.getNodePath.apply(this, arguments),
            lastRootChildIndex = -1,
            pathSepRegex = new RegExp(PATH_SEP, 'g'),
            i;

        // Treat any nodeIds in the root object as the same node then remove them
        // Hide any nodeIds in the root object
        for (i = nodeIds.length; i-- && lastRootChildIndex === -1;) {
            // Check for multiple '/' separators in the id (else it's a child of
            // the root node)
            if (nodeIds[i] && nodeIds[i].match(pathSepRegex).length === 1) {
                lastRootChildIndex = i;
            }
        }

        if (lastRootChildIndex > -1) {
            for (i = 1; i <= lastRootChildIndex; i++) {
                delete this.territories[nodeIds[i]];
            }
            nodeIds.splice(1, lastRootChildIndex);
        }

        return nodeIds;
    };

    NodePathWithHidden.prototype.addNode = function(id, isActive) {
        if (id === CONSTANTS.PROJECT_ROOT_ID && !isActive) {
            var item = document.createElement('li'),
                anchor = document.createElement('a');

            this._nodes[id] = anchor;
            item.appendChild(anchor);
            item.addEventListener('click', () => {
                var nodeId = this._nodeHistory[1],
                    node;

                if (nodeId) {
                    // Get the id for the child of the root node
                    node = this.client.getNode(nodeId);
                    if (node.getParentId() !== CONSTANTS.PROJECT_ROOT_ID) {
                        nodeId = node.getParentId();
                    }
                } else {
                    // Try to load the 'MyPipelines' child of the root node
                    node = this.client.getNode(CONSTANTS.PROJECT_ROOT_ID)
                        // Get the child nodes
                        .getChildrenIds().map(id => this.client.getNode(id))
                        // Find the child named 'MyPipelines'
                        .find(child => child && child.getAttribute('name') === 'MyPipelines');

                    if (node) {
                        nodeId = node.getId();
                    }
                }
                // If none are loaded, try to register MyPipelines
                WebGMEGlobal.State.registerActiveObject(nodeId || id);
            });
            this.territories[id] = {children: 0};
            this.pathContainer.append(item);
        } else {
            return NodePathNavigator.prototype.addNode.apply(this, arguments);
        }
    };

    return NodePathWithHidden;
});
