/*globals define, WebGMEGlobal*/
define([
    'widgets/EasyDAG/Buttons'
], function(
    EasyDAGButtons
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
    GoToBase.BORDER = 5;
    GoToBase.prototype.BTN_CLASS = 'add';
    GoToBase.prototype = new EasyDAGButtons.ButtonBase();

    GoToBase.prototype._render = function() {
        var lineRadius = GoToBase.SIZE - GoToBase.BORDER,
            btnColor = '#90caf9',
            lineColor = '#7986cb';

        if (this.disabled) {
            btnColor = '#e0e0e0';
            lineColor = '#9e9e9e';
        }

        this.$el
            .append('circle')
            .attr('r', GoToBase.SIZE)
            .attr('fill', btnColor);

        this.$el
            .append('circle')
                .attr('r', GoToBase.SIZE/3)
                .attr('stroke-width', 3)
                .attr('stroke', lineColor);

        this.$el
            .append('line')
                .attr('y1', 0)
                .attr('y2', 0)
                .attr('x1', -lineRadius)
                .attr('x2', lineRadius)
                .attr('stroke-width', 3)
                .attr('stroke', lineColor);

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

    return {
        DeleteOne: EasyDAGButtons.DeleteOne,
        GoToBase: GoToBase
    };
});

