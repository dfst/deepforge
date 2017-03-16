/*globals define*/
define([
    'deepforge/viz/Buttons',
    'deepforge/Constants',
    'widgets/EasyDAG/Buttons',
    'widgets/EasyDAG/Icons',
    'underscore',
    './lib/spectrum.min'
], function(
    CommonButtons,
    Constants,
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
        this.selectionManager.deselect();
    };

    // Set the color
    var SetColor = function(params) {
        params.title = params.title || 'Set operation color';
        EasyDAGButtons.Add.call(this, params);

        // Add the click handling
        var currentColor = this.item.desc.displayColor;
        $('.set-color-icon').spectrum({
            change: color => this.onColorChanged(color.toHexString()),
            showPaletteOnly: true,
            showPalette: true,
            clickoutFiresChange: true,
            hideAfterPaletteSelect: true,

            color: currentColor,
            palette: [
                // TODO: get more meaningful colors
                [currentColor, 'white', 'blanchedalmond',
                'rgb(255, 128, 0);', 'hsv 100 70 50'],
                ['red', 'yellow', 'green', 'blue', 'violet']
            ]

        });
    };
    _.extend(SetColor.prototype, EasyDAGButtons.Add.prototype);  // FIXME

    SetColor.prototype.BTN_CLASS = 'set-color-icon';
    SetColor.prototype._onClick = function() {};

    SetColor.prototype.onColorChanged = function(color) {
        console.log('changing color to', color);
        // Set the displayColor attribute to the given hex value
        this.context.saveAttributeForNode(this.item.id, Constants.DISPLAY_COLOR, color);

        // Update the color of the displayed node
        // TODO
    };

    SetColor.prototype._render = function() {
        var lineRadius = EasyDAGButtons.Add.SIZE - EasyDAGButtons.Add.BORDER,
            btnColor = '#ffcc80';

        if (this.disabled) {
            btnColor = '#e0e0e0';
        }

        this.$el
            .append('circle')
            .attr('r', EasyDAGButtons.Add.SIZE)
            .attr('fill', btnColor);

        Icons.addIcon('brush', this.$el, {radius: lineRadius});
    };

    return {
        AddOutput: AddOutput,
        AddInput: AddInput,
        SetColor: SetColor,
        AddRef: AddRef,
        GoToBase: CommonButtons.GoToBase,
        Delete: Delete
    };
});
