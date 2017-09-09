/* globals define, $, _ */
define([
    'widgets/EasyDAG/EasyDAGWidget'
], function(
    EasyDAGWidget
) {

    var ThumbnailWidget = function() {
        EasyDAGWidget.apply(this, arguments);
        this.logger = this._logger;
    };

    ThumbnailWidget.prototype = Object.create(EasyDAGWidget.prototype);

    ThumbnailWidget.prototype.addNode = function() {
        var result = EasyDAGWidget.prototype.addNode.apply(this, arguments);

        this.refreshThumbnail();
        return result;
    };

    ThumbnailWidget.prototype.removeNode = function() {
        var result = EasyDAGWidget.prototype.removeNode.apply(this, arguments);

        this.refreshThumbnail();
        return result;
    };

    ThumbnailWidget.prototype._removeConnection = function() {
        var result = EasyDAGWidget.prototype._removeConnection.apply(this, arguments);

        this.refreshThumbnail();
        return result;
    };

    ThumbnailWidget.prototype.addConnection = function() {
        var result = EasyDAGWidget.prototype.addConnection.apply(this, arguments);

        this.refreshThumbnail();
        return result;
    };

    ////////////////////////// Thumbnail updates //////////////////////////
    ThumbnailWidget.prototype.getSvgDistanceDim = function(dim) {
        var maxValue = this._getMaxAlongAxis(dim),
            nodes,
            minValue;

        nodes = this.graph.nodes().map(id => this.graph.node(id));
        minValue = nodes.length ? Math.min.apply(null, nodes.map(node => node[dim] || 0)) : 0;
        return maxValue-minValue;
    };

    ThumbnailWidget.prototype.getSvgWidth = function() {
        return this.getSvgDistanceDim('x');
    };

    ThumbnailWidget.prototype.getSvgHeight = function() {
        return this.height - 25;
    };

    ThumbnailWidget.prototype.getViewBox = function() {
        var maxX = this.getSvgWidth('x'),
            maxY = this.getSvgHeight('y');

        return `0 0 ${maxX} ${maxY}`;
    };

    ThumbnailWidget.prototype.refreshThumbnail = _.debounce(function() {
        // Get the svg...
        var svg = document.createElement('svg'),
            group = this.$svg.node(),
            child;

        svg.setAttribute('viewBox', this.getViewBox());
        for (var i = 0; i < group.children.length; i++) {
            child = $(group.children[i]);
            svg.appendChild(child.clone()[0]);
        }

        this.updateThumbnail(svg.outerHTML);
    }, 1000);

    return ThumbnailWidget;
});
