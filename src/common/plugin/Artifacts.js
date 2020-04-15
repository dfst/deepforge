/*globals define*/
define([
], function(
) {
    const Artifacts = function () {
        throw new Error('Aritifacts is supposed to be used as an extension object, do not instantiate');
    };

    Artifacts.prototype.constructor = Artifacts;

    Artifacts.prototype.getBaseNode = function (baseName) {
        const metaDict = this.core.getAllMetaNodes(this.activeNode);
        const metanodes = Object.keys(metaDict).map(id => metaDict[id]);
        const base = metanodes.find(node =>
            this.core.getAttribute(node, 'name') === baseName
        );
        return base;
    };

    Artifacts.prototype.createArtifact = async function (baseNode, attrs) {
        // Find the artifacts dir
        const children = await this.core.loadChildren(this.rootNode);
        const parent = children.find(child => this.core.getAttribute(child, 'name') === 'MyArtifacts') ||
            this.activeNode;
        const dataNode = this.core.createNode({baseNode, parent});
        const {data, type, name} = attrs;
        this.core.setAttribute(dataNode, 'data', JSON.stringify(data));
        this.core.setAttribute(dataNode, 'type', type);
        this.core.setAttribute(dataNode, 'createdAt', Date.now());
        this.core.setAttribute(dataNode, 'name', name);
    };

    return Artifacts;
});

