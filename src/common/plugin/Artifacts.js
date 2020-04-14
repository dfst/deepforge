/*globals define*/
define([
], function(
) {
    const Artifacts = function () {};

    // Supposed to be used as an extension object, do not instantiate
    Artifacts.prototype.constructor = null;

    Artifacts.prototype.getArtifactsDir = async function() {
        // Find the artifacts dir
        const children = await this.core.loadChildren(this.rootNode);
        return children
                .find(child => this.core.getAttribute(child, 'name') === 'MyArtifacts') ||
            this.activeNode;
    };

    Artifacts.prototype.getAssetNameFromHash = async function(hash){
        const metadata = await this.blobClient.getMetadata(hash);
        if (metadata) {
            return metadata.name.replace(/\.[^.]*?$/, '');
        }
    };

    Artifacts.prototype.getAssetNameFromPath = async function (path) {
        return path.split('/').pop().replace(/\.[^.]*?$/, '');
    };

    Artifacts.prototype.getBaseNode = function () {
        const metaDict = this.core.getAllMetaNodes(this.activeNode);
        const metanodes = Object.keys(metaDict).map(id => metaDict[id]);
        const base = metanodes.find(node =>
            this.core.getAttribute(node, 'name') === 'Data'
        );
        return base;
    };

    Artifacts.prototype.assignAssetAttributes = function (node, attrs) {
        const {data, type, name} = attrs;
        this.core.setAttribute(node, 'data', JSON.stringify(data));
        this.core.setAttribute(node, 'type', type);
        this.core.setAttribute(node, 'createdAt', Date.now());
        this.core.setAttribute(node, 'name', name);
    };

    return Artifacts;
});

