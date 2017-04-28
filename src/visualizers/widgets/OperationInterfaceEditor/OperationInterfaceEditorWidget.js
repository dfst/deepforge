/*globals define */
/*jshint browser: true*/

define([
    'deepforge/globals',
    'widgets/EasyDAG/EasyDAGWidget',
    'widgets/EasyDAG/AddNodeDialog',
    './SelectionManager',
    './Buttons',
    './Item',
    'underscore',
    'css!./styles/OperationInterfaceEditorWidget.css'
], function (
    DeepForge,
    EasyDAG,
    AddNodeDialog,
    SelectionManager,
    Buttons,
    Item,
    _
) {
    'use strict';

    var OperationInterfaceEditorWidget,
        WIDGET_CLASS = 'operation-interface-editor',
        NEW_CLASS_ID = '__NEW_CLASS__',
        NEW_PRIM_ID = '__NEW_PRIM__';

    OperationInterfaceEditorWidget = function (logger, container) {
        container.addClass(WIDGET_CLASS);
        EasyDAG.call(this, logger, container);
    };

    _.extend(OperationInterfaceEditorWidget.prototype, EasyDAG.prototype);

    OperationInterfaceEditorWidget.prototype.SelectionManager = SelectionManager;
    OperationInterfaceEditorWidget.prototype.ItemClass = Item;
    OperationInterfaceEditorWidget.prototype.setupItemCallbacks = function() {
        EasyDAG.prototype.setupItemCallbacks.call(this);
        // Add ptr rename callback
        this.ItemClass.prototype.changePtrName = (from, to) => this.changePtrName(from, to);
        this.ItemClass.prototype.onSetRefClicked = OperationInterfaceEditorWidget.prototype.onSetRefClicked.bind(this);

        this.ItemClass.prototype.showHoverButtons = function() {
            var item = this;
            this._widget.showHoverButtons(item);
        };

        this.ItemClass.prototype.hideHoverButtons = function() {
            this._widget.hideHoverButtons();
        };

        this.ItemClass.prototype.isHoverAllowed = function() {
            return true;
        };

    };

    OperationInterfaceEditorWidget.prototype.onAddItemSelected = function(selected, isInput) {
        this.createConnectedNode(selected.node.id, isInput);
    };

    OperationInterfaceEditorWidget.prototype.onAddButtonClicked = function(item, isInput) {
        var successorPairs = this.getValidSuccessors(item.id, isInput),
            newClass = this.getCreationNode('Complex', NEW_CLASS_ID),
            newPrim = this.getCreationNode('Primitive', NEW_PRIM_ID),
            opts = {};

        // Add the 'Create Class' node
        successorPairs.push(newClass);
        successorPairs.push(newPrim);

        // Add tabs
        opts.tabs = ['Primitive', 'Classes'];
        opts.tabFilter = (tab, pair) => {
            return pair.node.isPrimitive === (tab === 'Primitive');
        };

        AddNodeDialog.prompt(successorPairs, opts)
            .then(selected => {
                if (selected.node.id === NEW_CLASS_ID) {
                    DeepForge.create.Complex();
                } else if (selected.node.id === NEW_PRIM_ID) {
                    DeepForge.create.Primitive();
                } else {
                    this.onAddItemSelected(selected, isInput);
                }
            });
    };

    OperationInterfaceEditorWidget.prototype.onDeactivate = function() {
        EasyDAG.prototype.onDeactivate.call(this);
        this.active = true;  // keep refreshing the screen -> it is always visible
    };

    OperationInterfaceEditorWidget.prototype.onSetRefClicked = function(name) {
        var refs = this.allValidReferences();

        // Get all valid references
        if (refs.length > 1) {
            // Create the modal view with all possible subsequent nodes
            var dialog = new AddNodeDialog();

            dialog.show(null, refs);
            dialog.onSelect = selected => {
                if (selected) {
                    this.setRefType(name, selected.node.id);
                }
            };
        } else if (refs[0]) {
            this.setRefType(name, refs[0].node.id);
        }
    };

    OperationInterfaceEditorWidget.prototype.onAddRefClicked = function() {
        var refs = this.allValidReferences();

        // Get all valid references
        if (refs.length > 1) {
            // Create the modal view with all possible subsequent nodes
            var dialog = new AddNodeDialog();

            dialog.show(null, refs);
            dialog.onSelect = selected => {
                if (selected) {
                    this.onAddRefSelected(selected);
                }
            };
        } else if (refs[0]) {
            this.onAddRefSelected(refs[0]);
        }
    };

    OperationInterfaceEditorWidget.prototype.onAddRefSelected = function(target) {
        this.addRefTo(target.node.id);
    };

    OperationInterfaceEditorWidget.prototype.addConnection = function(desc) {
        EasyDAG.prototype.addConnection.call(this, desc);
        // Remove connection selection
        var conn = this.connections[desc.id];
        conn.$el.on('click', null);
    };

    // Hover buttons
    OperationInterfaceEditorWidget.prototype.showHoverButtons = function(item) {
        var dataNodes = this.allDataTypeIds(),
            refNodes = this.allValidReferences(),
            height = item.height,
            cx = item.width/2;

        if (this.$hoverBtns) {
            this.hideHoverButtons();
        }

        this.$hoverBtns = item.$el
            .append('g')
            .attr('class', 'hover-container');

        if (item.desc.baseName === 'Operation') {
            new Buttons.AddOutput({  // Add output data
                context: this,
                $pEl: this.$hoverBtns,
                disabled: dataNodes.length === 0,
                item: item,
                x: cx,
                y: height
            });

            new Buttons.AddInput({  // Add input data
                context: this,
                $pEl: this.$hoverBtns,
                disabled: dataNodes.length === 0,
                item: item,
                x: item.width/3,
                y: 0
            });

            new Buttons.AddRef({  // Add reference
                context: this,
                $pEl: this.$hoverBtns,
                disabled: refNodes.length === 0,
                item: item,
                x: 2*item.width/3,
                y: 0
            });
        }
    };

    OperationInterfaceEditorWidget.prototype.hideHoverButtons = function() {
        if (this.$hoverBtns) {
            this.$hoverBtns.remove();
            this.$hoverBtns = null;
        }
    };

    return OperationInterfaceEditorWidget;
});
