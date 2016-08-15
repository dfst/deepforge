/*globals define */
/*jshint browser: true*/

define([
    'deepforge/globals',
    'widgets/EasyDAG/EasyDAGWidget',
    'widgets/EasyDAG/AddNodeDialog',
    './SelectionManager',
    './Item',
    'underscore',
    'css!./styles/OperationInterfaceEditorWidget.css'
], function (
    DeepForge,
    EasyDAG,
    AddNodeDialog,
    SelectionManager,
    Item,
    _
) {
    'use strict';

    var OperationInterfaceEditorWidget,
        WIDGET_CLASS = 'operation-interface-editor',
        NEW_CLASS_ID = '__NEW_CLASS__',
        NEW_PRIM_ID = '__NEW_PRIM__';

    OperationInterfaceEditorWidget = function (logger, container) {
        EasyDAG.call(this, logger, container);
        this.$el.addClass(WIDGET_CLASS);
    };

    _.extend(OperationInterfaceEditorWidget.prototype, EasyDAG.prototype);

    OperationInterfaceEditorWidget.prototype.SelectionManager = SelectionManager;
    OperationInterfaceEditorWidget.prototype.ItemClass = Item;
    OperationInterfaceEditorWidget.prototype.setupItemCallbacks = function() {
        EasyDAG.prototype.setupItemCallbacks.call(this);
        // Add ptr rename callback
        this.ItemClass.prototype.changePtrName = (from, to) => this.changePtrName(from, to);
        this.ItemClass.prototype.onSetRefClicked = OperationInterfaceEditorWidget.prototype.onSetRefClicked.bind(this);
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

    return OperationInterfaceEditorWidget;
});
