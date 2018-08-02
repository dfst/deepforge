/* globals define*/
// Mixin for controllers that can create code modules
define([
], function(
) {
    const CodeControls = function() {
    };

    CodeControls.prototype.getInitialCode = function(name) {
        return [
            `# This contains python code accessible from any operation.`,
            `# Simply write your python code here and then import it elsewhere with:`,
            `#`,
            `#     from utils.${name.replace('.py', '')} import MyCustomCode`,
            `#`
        ].join('\n');
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
        this._client.setAttribute(id, 'code', this.getInitialCode(name));
        this._client.completeTransaction();
    };

    CodeControls.prototype.getValidModuleName = function (name) {
        const currentNode = this._client.getNode(this._currentNodeId);
        const names = currentNode.getChildrenIds()
            .map(id => this._client.getNode(id))
            .map(node => node.getAttribute('name'));

        name = name.replace(/.py$/, '').replace(/[^\da-zA-Z]/g, '_');
        const basename = name;
        let count = 2;

        name = `${basename}.py`;
        while (names.includes(name)) {
            name = `${basename}_${count}.py`;
            count++;
        }
        return name;
    };

    return CodeControls;
});
