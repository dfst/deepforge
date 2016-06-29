/*globals define*/

define([
    'widgets/EasyDAG/SelectionManager',
    './Buttons',
    'underscore'
], function(
    EasyDAGSelectionManager,
    Buttons,
    _
) {
    'use strict';

    var SelectionManager = function(widget) {
        EasyDAGSelectionManager.call(this, widget);
    };

    _.extend(SelectionManager.prototype, EasyDAGSelectionManager.prototype);

    SelectionManager.prototype.createActionButtons = function(width, height) {
        var selectedType = this.selectedItem.desc.baseName,
            dataNodes,
            refNodes,
            cx = width/2;

        if (selectedType === 'Operation') {
            dataNodes = this._widget.allDataTypeIds();
            refNodes = this._widget.allValidReferences();

            new Buttons.AddOutput({  // Add output data
                context: this._widget,
                $pEl: this.$selection,
                item: this.selectedItem,
                x: cx,
                y: height,
                disabled: dataNodes.length === 0
            });

            new Buttons.AddInput({  // Add input data
                context: this._widget,
                $pEl: this.$selection,
                item: this.selectedItem,
                disabled: dataNodes.length === 0,
                x: width/3,
                y: 0
            });

            new Buttons.AddRef({  // Add reference
                context: this._widget,
                $pEl: this.$selection,
                item: this.selectedItem,
                disabled: refNodes.length === 0,
                x: 2*width/3,
                y: 0
            });
        } else {  // Data or pointer...
            new Buttons.Delete({
                context: this._widget,
                $pEl: this.$selection,
                item: this.selectedItem,
                x: cx,
                y: 0
            });

            if (!this.selectedItem.desc.isPointer) {
                new Buttons.GoToBase({
                    context: this._widget,
                    $pEl: this.$selection,
                    item: this.selectedItem,
                    x: width,
                    y: 0
                });
            }
        }
    };

    return SelectionManager;
});
