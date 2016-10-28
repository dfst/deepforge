/*globals define*/
/*jshint browser: true*/

define([
    'deepforge/globals',
    'deepforge/viz/widgets/Thumbnail',
    'widgets/EasyDAG/AddNodeDialog',
    './SelectionManager',
    './Layer',
    'q',
    'underscore',
    'css!./styles/ArchEditorWidget.css'
], function (
    DeepForge,
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
            'Containers',
            'Misc'
        ];

    ArchEditorWidget = function (logger, container) {
        ThumbnailWidget.call(this, logger, container);
        this.$el.addClass(WIDGET_CLASS);
        this._emptyMsg = 'Click to add a new layer';
    };

    _.extend(ArchEditorWidget.prototype, ThumbnailWidget.prototype);

    ArchEditorWidget.prototype.ItemClass = Layer;
    ArchEditorWidget.prototype.SelectionManager = SelectionManager;

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

    return ArchEditorWidget;
});
