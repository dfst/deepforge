/* globals define*/
// Mixin for controllers that can create code modules
define([
], function(
) {
    const CodeControls = function() {
    };

    CodeControls.prototype.addNewFile = function(name) {
        const parentId = this._currentNodeId;
        const baseId = this._client.getAllMetaNodes()
            .find(node => node.getAttribute('name') === 'Code')
            .getId();

        const msg = `Created ${name} python module`;

        name = this.getValidModuleName(name);

        this._client.startTransaction(msg);
        const id = this._client.createNode({parentId, baseId});
        this._client.setAttribute(id, 'name', name);
        // Add helpful initial code message
        // TODO
        this._client.completeTransaction();
    };

    CodeControls.prototype.getValidModuleName = function (name) {
        name = name.replace(/[^\da-zA-Z]/g, '_');
        const currentNode = this._client.getNode(this._currentNodeId);
        const names = currentNode.getChildrenIds()
            .map(id => this._client.getNode(id))
            .map(node => node.getAttribute('name'));
        const [basename, ext='py'] = name.split('.');
        let count = 2;

        name = `${basename}.${ext}`;
        while (names.includes(name)) {
            name = `${basename}_${count}.${ext}`;
        }
        return name;
    };

    return CodeControls;
});
