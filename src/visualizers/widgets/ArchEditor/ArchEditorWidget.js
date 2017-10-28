/*globals define*/
/*jshint browser: true*/

define([
    'deepforge/globals',
    'widgets/EasyDAG/Buttons',
    'deepforge/viz/widgets/Thumbnail',
    'widgets/EasyDAG/AddNodeDialog',
    './SelectionManager',
    './Layer',
    'q',
    'underscore',
    'css!./styles/ArchEditorWidget.css'
], function (
    DeepForge,
    Buttons,
    ThumbnailWidget,
    AddNodeDialog,
    SelectionManager,
    Layer,
    Q,
    _
) {
    'use strict';

    var CREATE_ID = '__NEW_LAYER__',
        ArchEditorWidget,
        WIDGET_CLASS = 'arch-editor',
        LAYER_TAB_ORDER = [
            'Simple',
            'Transfer',
            'Convolution',
            'RNN',
            'Container',
            'Misc'
        ];

    ArchEditorWidget = function () {
        var container = arguments[1];
        if (container) {
            container.addClass(WIDGET_CLASS);
        }
        ThumbnailWidget.apply(this, arguments);
        this._emptyMsg = 'Click to add a new layer';
        this.hasError = {};
    };

    _.extend(ArchEditorWidget.prototype, ThumbnailWidget.prototype);

    ArchEditorWidget.prototype.ItemClass = Layer;
    ArchEditorWidget.prototype.SelectionManager = SelectionManager;

    ArchEditorWidget.prototype.getComponentId = function() {
        return 'ArchEditor';
    };

    ArchEditorWidget.prototype.setupItemCallbacks = function() {
        ThumbnailWidget.prototype.setupItemCallbacks.apply(this, arguments);
        // Add the hover button functions
        this.ItemClass.prototype.showHoverButtons = function() {
            var layer = this;
            this._widget.showHoverButtons(layer);
        };

        this.ItemClass.prototype.hideHoverButtons = function() {
            this._widget.hideHoverButtons();
        };

        this.ItemClass.prototype.isHoverAllowed = function() {
            return !this._widget.isConnecting();
        };

        this.ItemClass.prototype.promptInitialLayer = function() {
            var nodes = this._widget.getValidInitialNodes();
            return this._widget.promptLayer(nodes)
                .then(selected => selected.node.id);
        };
    };

    ArchEditorWidget.prototype.showHoverButtons = function(layer) {
        var btn,
            height = layer.height,
            cx = layer.width/2;

        if (this.$hoverBtns) {
            this.hideHoverButtons();
        }

        this.$hoverBtns = layer.$el
            .append('g')
            .attr('class', 'hover-container');

        btn = new Buttons.Connect.From({
            context: this,
            $pEl: this.$hoverBtns,
            item: layer,
            x: cx,
            y: height
        });

        btn = new Buttons.Connect.To({
            context: this,
            $pEl: this.$hoverBtns,
            item: layer,
            x: cx,
            y: 0
        });

        return btn;
    };

    ArchEditorWidget.prototype.hideHoverButtons = function() {
        if (this.$hoverBtns) {
            this.$hoverBtns.remove();
            this.$hoverBtns = null;
        }
    };

    ArchEditorWidget.prototype.startConnection = function () {
        this.hideHoverButtons();
        ThumbnailWidget.prototype.startConnection.apply(this, arguments);
    };

    ArchEditorWidget.prototype.onCreateInitialNode = function() {
        var nodes = this.getValidInitialNodes();
        return this.promptLayer(nodes)
            .then(selected => this.createNode(selected.node.id));
    };

    ArchEditorWidget.prototype.onAddButtonClicked = function(item, reverse) {
        var nodes = this.getValidSuccessors(item.id);

        return this.promptLayer(nodes)
            .then(selected => this.onAddItemSelected(item, selected, reverse));
    };

    ArchEditorWidget.prototype.getLayerCategoryTabs = function(types) {
        var tabs = [],
            allTabs = {},
            tab,
            i;

        Object.keys(types).forEach(type => allTabs[type] = true);
        delete allTabs.Criterion;

        // Add the ordered tabs
        for (i = LAYER_TAB_ORDER.length; i--;) {
            tab = LAYER_TAB_ORDER[i];
            if (allTabs[tab]) {
                tabs.unshift(tab);
                delete allTabs[tab];
            }
        }

        // Add any remaining categories
        Object.keys(allTabs).forEach(tab => tabs.unshift(tab));

        return tabs;
    };

    ArchEditorWidget.prototype.promptLayer = function(nodes) {
        var deferred = Q.defer(),
            types = {},
            Decorator = this.getCreateNewDecorator(),
            createNews,
            opts = {};  // 'create new' nodes

        nodes.map(pair => pair.node)
            .forEach(node => types[node.layerType] = node.color);

        createNews = Object.keys(types).map(type =>
            this._creationNode(type, types[type], Decorator));

        nodes.sort((a, b) => a.node.name < b.node.name ? -1 : 1);
        nodes = nodes.concat(createNews);

        // Sort by layer type
        opts.tabs = this.getLayerCategoryTabs(types);
        opts.tabFilter = (tab, pair) => {
            return pair.node.layerType === tab;
        };

        AddNodeDialog.prompt(nodes, opts)
            .then(selected => {
                if (selected.node.id === CREATE_ID) {
                    DeepForge.create.Layer(selected.node.layerType);
                } else {
                    deferred.resolve(selected);
                }
            });
        return deferred.promise;
    };

    ArchEditorWidget.prototype._creationNode = function(type, color, Decorator) {
        return {
            node: {
                id: CREATE_ID,
                class: 'create-node',
                attributes: {},
                name: `New ${type} Layer...`,
                baseName: `New ${type} Layer...`,
                layerType: type,
                color: color,
                Decorator: Decorator
            }
        };
    };

    ArchEditorWidget.prototype.updateNode = function(desc) {
        var item = this.items[desc.id];
        item.update(desc);
        this.refreshUI();
    };

    ArchEditorWidget.prototype.expandAllNodes = function(reverse) {
        var itemIds = Object.keys(this.items),
            method = reverse ? 'condenseAll' : 'expandAll';

        for (var i = itemIds.length; i--;) {
            this.items[itemIds[i]][method]();
        }
    };

    ArchEditorWidget.prototype.onInsertButtonClicked = function(item) {
        var nodes = this.getValidInitialNodes();
        return this.promptLayer(nodes)
            .then(selected => this.insertLayer(selected.node.id, item.id));
    };

    ArchEditorWidget.prototype.displayErrors = function(errors) {
        // For each of the errors, highlight the given nodes
        var oldErrored = Object.keys(this.hasError),
            currentErrored = errors.map(err => err.id),
            newErrored = _.difference(currentErrored, oldErrored),
            fixedLayers = _.difference(oldErrored, currentErrored);

        this.logger.info('updating displayed errors to', currentErrored);
        this.hasError = {};
        newErrored.forEach(id => {
            if (this.items[id]) {
                this.items[id].decorator.highlight('red');
                this.hasError[id] = true;
            }
        });

        fixedLayers.forEach(id => {
            if (this.items[id]) {
                this.items[id].clear();
            }
        });
    };

    return ArchEditorWidget;
});
