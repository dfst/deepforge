define([
    'panels/ArchEditor/ArchEditorControl',
    'widgets/ArchEditor/ArchEditorWidget'
], function(
    ArchEditor,
    ArchEditorWidget
) {
    var nop = () => {};
    var NestedLayer = function(opts) {
        this.$el = opts.$container.append('g')
            .attr('class', 'nested-layer');

        this.id = opts.id;
        this._parent = opts.parent;
        this.type = opts.type;
        this.logger = opts.logger;

        this.initHover();
        this.$content = this.$el.append('g');

        this.widget = new ArchEditorWidget({
            logger: this.logger.fork('ArchWidget'),
            autoCenter: false,
            svg: this.$content
        });
        this.widget.setTitle =
        this.widget.updateEmptyMsg = nop;
        this.onRefresh = opts.onRefresh;
        this.widget.refreshExtras = this.onWidgetRefresh.bind(this);

        this.control = new ArchEditor({
            logger: this.logger.fork('ArchControl'),
            client: opts.client,
            embedded: true,
            widget: this.widget
        });

        // hack :(
        this.control.$btnModelHierarchyUp = {
            show: nop,
            hide: nop
        };
        this.widget.active = true;
        this.control.selectedObjectChanged(this.id);

    };

    NestedLayer.FIRST = 1;
    NestedLayer.LAST = 1;
    NestedLayer.prototype.initHover = function() {
        var btnClass = 'button ';

        this.$hover = this.$el.append('g')
            .attr('class', 'hover-items');

        this.$outline = this.$hover.append('rect')
            .attr('class', 'hover-box')
            .attr('fill-opacity', 0)
            .attr('x', 0)
            .attr('y', 0);

        this.$leftBtn = this.$hover.append('circle')
            .attr('r', 10)
            .attr('class', btnClass);

        this.$rightBtn = this.$hover.append('circle')
            .attr('r', 10)
            .attr('class', btnClass);

        // TODO: Add buttons
        this.$el.on('mouseenter', this.onHover.bind(this));
        this.$el.on('mouseleave', this.onUnhover.bind(this));
        this.$leftBtn.on('click', this.clickLeft.bind(this));
        this.$rightBtn.on('click', this.clickRight.bind(this));
    };

    NestedLayer.prototype.clickLeft = function() {
        if (this.type === NestedLayer.FIRST) {
            this.addLayerBefore();
        } else {
            this.moveLayerForward();
        }
    };

    NestedLayer.prototype.clickRight = function() {
        if (this.type === NestedLayer.LAST) {
            this.addLayerAfter();
        } else {
            this.moveLayerBackward();
        }
    };

    NestedLayer.prototype.onHover = function() {
        this.$hover.attr('class', 'hover-items hovered');
        // TODO
    };

    NestedLayer.prototype.onUnhover = function() {
        this.$hover.attr('class', 'hover-items unhovered');
        // TODO
    };

    NestedLayer.prototype.onWidgetRefresh = function() {
        var width = this.widget.getSvgWidth(),
            height = this.widget.getSvgHeight();

        this.$outline
            .attr('width', width)
            .attr('height', height);

        this.$leftBtn.attr('cy', height/2);
        this.$rightBtn
            .attr('cx', width)
            .attr('cy', height/2);

        this.onRefresh();
    };

    NestedLayer.prototype.destroy = function() {
        this.control.destroy();
    };

    return NestedLayer;
});
