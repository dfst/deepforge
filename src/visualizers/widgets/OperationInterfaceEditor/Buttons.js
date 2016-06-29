/*globals define*/
define([
    'deepforge/viz/Buttons',
    'widgets/EasyDAG/Buttons',
    'underscore'
], function(
    CommonButtons,
    EasyDAGButtons,
    _
) {

    var AddOutput = function(params) {
        EasyDAGButtons.Add.call(this, params);
    };

    _.extend(AddOutput.prototype, EasyDAGButtons.Add.prototype);

    AddOutput.prototype._render = function() {
        var lineRadius = EasyDAGButtons.Add.SIZE - EasyDAGButtons.Add.BORDER,
            btnColor = '#90caf9',
            lineColor = '#7986cb';

        if (this.disabled) {
            btnColor = '#e0e0e0';
            lineColor = '#9e9e9e';
        }

        this.$el
            .append('circle')
            .attr('r', EasyDAGButtons.Add.SIZE)
            .attr('fill', btnColor);

        this.$el
            .append('line')
                .attr('x1', 0)
                .attr('x2', 0)
                .attr('y1', -lineRadius)
                .attr('y2', lineRadius)
                .attr('stroke-width', 2)
                .attr('stroke', lineColor);

        // Arrow
        this.$el
            .append('line')
                .attr('y1', lineRadius)
                .attr('y2', 0)
                .attr('x1', 0)
                .attr('x2', -lineRadius)
                .attr('stroke-width', 2)
                .attr('stroke', lineColor);

        this.$el
            .append('line')
                .attr('y1', lineRadius)
                .attr('y2', 0)
                .attr('x1', 0)
                .attr('x2', lineRadius)
                .attr('stroke-width', 2)
                .attr('stroke', lineColor);

    };

    var AddInput = function(params) {
        EasyDAGButtons.Add.call(this, params);
    };
    _.extend(AddInput.prototype, AddOutput.prototype);

    AddInput.prototype._onClick = function(item) {
        this.onAddButtonClicked(item, true);
    };

    // References
    var AddRef = function(params) {
        EasyDAGButtons.Add.call(this, params);
    };

    _.extend(AddRef.prototype, EasyDAGButtons.Add.prototype);

    AddRef.prototype._onClick = function() {
        this.onAddRefClicked();
    };

    AddRef.prototype._render = function() {
        var lineRadius = EasyDAGButtons.Add.SIZE - EasyDAGButtons.Add.BORDER,
            btnColor = '#81c784',
            lineColor = '#7986cb';

        if (this.disabled) {
            btnColor = '#e0e0e0';
            lineColor = '#9e9e9e';
        }

        this.$el
            .append('circle')
            .attr('r', EasyDAGButtons.Add.SIZE)
            .attr('fill', btnColor);

        this.$el
            .append('line')
                .attr('x1', 0)
                .attr('x2', 0)
                .attr('y1', -lineRadius)
                .attr('y2', lineRadius)
                .attr('stroke-width', 2.5)
                .attr('stroke', lineColor);

        this.$el
            .append('line')
                .attr('y1', 0)
                .attr('y2', 0)
                .attr('x1', -lineRadius)
                .attr('x2', lineRadius)
                .attr('stroke-width', 2.5)
                .attr('stroke', lineColor);

    };

    var Delete = function(params) {
        EasyDAGButtons.DeleteOne.call(this, params);
    };

    _.extend(Delete.prototype, EasyDAGButtons.DeleteOne.prototype);

    Delete.prototype._onClick = function(item) {
        // Check if it is a pointer or 
        if (item.desc.isPointer) {
            this.removePtr(item.name);
        } else {
            this.deleteNode(item.id);
        }
    };

    return {
        AddOutput: AddOutput,
        AddInput: AddInput,
        AddRef: AddRef,
        GoToBase: CommonButtons.GoToBase,
        Delete: Delete
    };
});
