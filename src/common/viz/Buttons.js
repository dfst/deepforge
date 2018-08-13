/*globals define, WebGMEGlobal*/
define([
    'deepforge/globals',
    'widgets/EasyDAG/Buttons',
    'webgme-easydag/Icons'
], function(
    DeepForge,
    EasyDAGButtons,
    Icons
) {

    // Create a GoToBase button
    var client = WebGMEGlobal.Client;

    var GoToBase = function(params) {
        // Check if it should be disabled
        var baseId = this._getBaseId(params.item),
            base = baseId && client.getNode(baseId);

        if (!params.disabled) {
            params.disabled = base ? base.isLibraryElement() : true;
        }
        EasyDAGButtons.ButtonBase.call(this, params);
    };

    GoToBase.SIZE = 10;
    GoToBase.BORDER = 1;
    GoToBase.prototype.BTN_CLASS = 'go-to-base';
    GoToBase.prototype = new EasyDAGButtons.ButtonBase();

    GoToBase.prototype._render = function() {
        var lineRadius = GoToBase.SIZE - GoToBase.BORDER,
            btnColor = '#90caf9';

        if (this.disabled) {
            btnColor = '#e0e0e0';
        }

        this.$el
            .append('circle')
            .attr('r', GoToBase.SIZE)
            .attr('fill', btnColor);

        // Show the 'code' icon
        Icons.addIcon('code', this.$el, {
            radius: lineRadius
        });
    };

    GoToBase.prototype._onClick = function(item) {
        var node = client.getNode(item.id),
            baseId = node.getBaseId();

        WebGMEGlobal.State.registerActiveObject(baseId);
    };

    GoToBase.prototype._getBaseId = function(item) {
        var n = client.getNode(item.id);
        return n && n.getBaseId();
    };

    var CloneAndEdit = function(params) {
        GoToBase.call(this, params);
    };

    CloneAndEdit.prototype = Object.create(GoToBase.prototype);
    CloneAndEdit.prototype.BTN_CLASS = 'clone-and-edit';

    CloneAndEdit.prototype._render = function() {
        var lineRadius = GoToBase.SIZE - GoToBase.BORDER,
            btnColor = '#a5d6a7';

        if (this.disabled) {
            btnColor = '#e0e0e0';
        }

        this.$el
            .append('circle')
            .attr('r', GoToBase.SIZE)
            .attr('fill', btnColor);

        // Show the 'code' icon
        Icons.addIcon('code', this.$el, {
            radius: lineRadius
        });
    };

    CloneAndEdit.prototype._onClick = function(item) {
        var node = client.getNode(item.id),
            baseId = node && node.getBaseId(),
            base = baseId && client.getNode(baseId),
            typeId = base && base.getBaseId(),
            type = typeId && client.getNode(typeId),
            ctrName,
            typeName,
            name,
            newId;

        // Clone the given node's base and change to it
        if (type) {
            typeName = type.getAttribute('name');
            ctrName = `My${typeName}s`;
            if (DeepForge.places[ctrName]) {
                DeepForge.places[ctrName]().then(ctrId => {
                    type = base.getAttribute('name');
                    client.startTransaction(`Creating new ${typeName} from ${item.name}`);
                    newId = client.copyNode(baseId, ctrId);
                    name = node.getAttribute('name');
                    client.setAttribute(newId, 'name', `${name}Copy`);
                    DeepForge.register[typeName](newId);

                    client.completeTransaction();
                    WebGMEGlobal.State.registerActiveObject(newId);
                });
            }
        } else {
            this.logger.warn('Could not find the base node!');
        }
    };

    var Insert = function(params) {
        EasyDAGButtons.ButtonBase.call(this, params);
    };

    Insert.prototype = Object.create(EasyDAGButtons.Add.prototype);
    Insert.prototype._onClick = function(item) {
        this.onInsertButtonClicked(item);
    };

    return {
        DeleteOne: EasyDAGButtons.DeleteOne,
        GoToBase: GoToBase,
        CloneAndEdit: CloneAndEdit,
        Insert: Insert
    };
});

