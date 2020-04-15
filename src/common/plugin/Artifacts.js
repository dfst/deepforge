/*globals define*/
define([
], function(
) {
    const Artifacts = function () {
        throw new Error('Artifacts is supposed to be used as an extension object, do not instantiate');
    };

    Artifacts.prototype.constructor = Artifacts;

    Artifacts.prototype.getArtifactMetaNode = function () {
        const metaDict = this.core.getAllMetaNodes(this.activeNode);
        const metanodes = Object.keys(metaDict).map(id => metaDict[id]);
        const base = metanodes.find(node =>
            this.core.getAttribute(node, 'name') === 'Data'
        );
        return base;
    };

    Artifacts.prototype.createArtifact = async function (attrs) {
        const base = this.getArtifactMetaNode();
        // Find the artifacts dir
        const children = await this.core.loadChildren(this.rootNode);
        const parent = children.find(child => this.core.getAttribute(child, 'name') === 'MyArtifacts') ||
            this.activeNode;
        const dataNode = this.core.createNode({base, parent});
        const {data, type, name} = attrs;
        this.core.setAttribute(dataNode, 'data', JSON.stringify(data));
        this.core.setAttribute(dataNode, 'type', type);
        this.core.setAttribute(dataNode, 'createdAt', Date.now());
        this.core.setAttribute(dataNode, 'name', name);
    };

    Artifacts.prototype.ensureCompatibleMeta = function () {
        const base = this.getArtifactMetaNode();
        if(!base){
            throw new Error('An appropriate meta node to store artifact information does not exist.');
        }
    };

    return Artifacts;
});

