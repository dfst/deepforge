/*globals define*/
define([
    'deepforge/viz/Buttons',
    'widgets/EasyDAG/Buttons',
    'widgets/EasyDAG/Icons',
    'underscore'
], function(
    CommonButtons,
    EasyDAGButtons,
    Icons,
    _
) {

    var AddOutput = function(params) {
        params.title = params.title || 'Add operation output';
        EasyDAGButtons.Add.call(this, params);
    };

    _.extend(AddOutput.prototype, EasyDAGButtons.Add.prototype);

    AddOutput.BORDER = 2;
    AddOutput.prototype._render = function() {
        var lineRadius = EasyDAGButtons.Add.SIZE - AddOutput.BORDER,
            btnColor = '#90caf9';

        if (this.disabled) {
            btnColor = '#e0e0e0';
        }

        this.$el
            .append('circle')
            .attr('r', EasyDAGButtons.Add.SIZE)
            .attr('fill', btnColor);

        Icons.addIcon('chevron-bottom', this.$el, {radius: lineRadius});
    };

    var AddInput = function(params) {
        params.title = params.title || 'Add operation input';
        EasyDAGButtons.Add.call(this, params);
    };
    _.extend(AddInput.prototype, AddOutput.prototype);

    AddInput.prototype._onClick = function(item) {
        this.onAddButtonClicked(item, true);
    };

    // References
    var AddRef = function(params) {
        params.title = params.title || 'Add pointer type';
        EasyDAGButtons.Add.call(this, params);
    };

    _.extend(AddRef.prototype, EasyDAGButtons.Add.prototype);

    AddRef.prototype._onClick = function() {
        this.onAddRefClicked();
    };

    AddRef.prototype._render = function() {
        var lineRadius = EasyDAGButtons.Add.SIZE - EasyDAGButtons.Add.BORDER,
            btnColor = '#80deea';

        if (this.disabled) {
            btnColor = '#e0e0e0';
        }

        this.$el
            .append('circle')
            .attr('r', EasyDAGButtons.Add.SIZE)
            .attr('fill', btnColor);

        Icons.addIcon('plus', this.$el, {radius: lineRadius});
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
