/*globals define, $*/

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

    SelectionManager.prototype.deselect = function() {
        // this would be better in a 'destroy' method...
        $('.set-color-icon').spectrum('hide');
        EasyDAGSelectionManager.prototype.deselect.call(this);
    };

    SelectionManager.prototype.createActionButtons = function(width, height) {
        var selectedType = this.selectedItem.desc.baseName,
            refNodes,
            cx = width/2;

        if (selectedType === 'Operation') {
            refNodes = this._widget.allValidReferences();

            new Buttons.AddOutput({  // Add output data
                context: this._widget,
                $pEl: this.$selection,
                item: this.selectedItem,
                x: cx,
                y: height
            });

            new Buttons.AddInput({  // Add input data
                context: this._widget,
                $pEl: this.$selection,
                item: this.selectedItem,
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

            if (this.selectedItem.desc.displayColor) {
                new Buttons.SetColor({  // Set the operation color
                    context: this._widget,
                    $pEl: this.$selection,
                    item: this.selectedItem,
                    x: 0,
                    y: height
                });
            }
        } else {  // Data or pointer...
            new Buttons.Delete({
                context: this._widget,
                $pEl: this.$selection,
                item: this.selectedItem,
                x: cx,
                y: 0
            });
        }
    };

    return SelectionManager;
});
