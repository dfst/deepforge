/*globals define, WebGMEGlobal*/
define([
    'widgets/EasyDAG/Buttons',
    'widgets/EasyDAG/Icons'
], function(
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
        EasyDAGButtons.ButtonBase.call(this, params);
    };

    CloneAndEdit.prototype = Object.create(GoToBase.prototype);
    CloneAndEdit.prototype.BTN_CLASS = 'clone-and-edit';

    CloneAndEdit.prototype._render = function() {
        var lineRadius = GoToBase.SIZE - GoToBase.BORDER,
            btnColor = '#80deea';

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
        console.log('Clone and edit!');
    };

    return {
        DeleteOne: EasyDAGButtons.DeleteOne,
        GoToBase: GoToBase,
        CloneAndEdit: CloneAndEdit
    };
});

