/*globals define, _ */
define([
    'panels/ArchEditor/ArchEditorControl',
    'widgets/ArchEditor/ArchEditorWidget',
    'widgets/EasyDAG/Buttons'
], function(
    ArchEditor,
    ArchEditorWidget,
    Buttons
) {
    var nop = () => {};
    var NestedLayer = function(opts) {
        this.$el = opts.$container.append('g')
            .attr('class', 'nested-layer');

        this.id = opts.id;
        this._parent = opts.parent;
        this.logger = opts.logger;

        this.refreshButtons = _.debounce(this.updateButtons.bind(this), 100);
        this.$outline = this.$el.append('rect')  // for hover detection
            .attr('fill-opacity', 0)
            .attr('x', 0)
            .attr('y', 0);

        this.$content = this.$el.append('g');
        this.initHover();

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
        this.control._onUnload = id => {
            ArchEditor.prototype._onUnload.call(this.control, id);
            // If it was the last node, remove it
            var node = this.control._client.getNode(this.id);
            if (node.getChildrenIds().length === 0) {
                this.onLastNodeRemoved();
            }
        };

        // hack :(
        this.control.$btnModelHierarchyUp = {
            show: nop,
            hide: nop
        };
        this.widget.active = true;
        this.control.selectedObjectChanged(this.id);
    };

    NestedLayer.prototype.initHover = function() {
        this.$hover = this.$el.append('g')
            .attr('class', 'hover-items');



        this.$el.on('mouseenter', this.onHover.bind(this));
        this.$el.on('mouseleave', this.onUnhover.bind(this));

        // Buttons
        this.$leftBtn = new Buttons.Add({
            hide: true,
            icon: this.isFirst() ? 'plus' : 'chevron-left',
            $pEl: this.$hover
        });

        this.$rightBtn = new Buttons.Add({
            hide: true,
            icon: this.isLast() ? 'plus' : 'chevron-right',
            $pEl: this.$hover
        });

        this.$deleteBtn = new Buttons.DeleteOne({
            hide: true,
            title: 'Delete',
            $pEl: this.$hover
        });

        this.$leftBtn._onClick = this.clickLeft.bind(this);
        this.$rightBtn._onClick = this.clickRight.bind(this);
        this.$deleteBtn._onClick = () => this.onLastNodeRemoved();

        this.$leftHint = this.$leftBtn.$el.append('title');
        this.$rightHint = this.$rightBtn.$el.append('title');
        this.refreshButtons();
    };

    NestedLayer.prototype.updateButtons = function() {
        this.$leftBtn.icon = this.isFirst() ? 'plus' : 'chevron-left';
        this.$rightBtn.icon = this.isLast() ? 'plus' : 'chevron-right';

        this.$leftHint.text(this.isFirst() ?
            'Add nested layer' :
            'Move nested layer left'
        );
        this.$rightHint.text(this.isLast() ?
            'Add nested layer' :
            'Move nested layer right'
        );

        this.$leftBtn.render();
        this.$rightBtn.render();
    };

    NestedLayer.prototype.clickLeft = function() {
        if (this.isFirst()) {
            this.promptLayer()
                .then(layerId => this.addLayerBefore(layerId));
        } else {
            this.moveLayerForward();
        }
        this.onUnhover();
    };

    NestedLayer.prototype.promptLayer = function() {
        var nodes = this.widget.getValidInitialNodes();

        return this.widget.promptLayer(nodes)
            .then(selected => selected.node.id);
    };

    NestedLayer.prototype.clickRight = function() {
        if (this.isLast()) {
            this.promptLayer()
                .then(layerId => this.addLayerAfter(layerId));
        } else {
            this.moveLayerBackward();
        }
        this.onUnhover();
    };

    NestedLayer.prototype.onHover = function() {
        this.refreshButtons();
        this.$hover.attr('class', 'hover-items hovered');
    };

    NestedLayer.prototype.onUnhover = function() {
        this.$hover.attr('class', 'hover-items unhovered');
    };

    NestedLayer.prototype.onWidgetRefresh = function() {
        var width = this.widget.getSvgWidth(),
            height = this.widget.getSvgHeight();

        this.$outline
            .attr('width', width)
            .attr('height', height);

        this.$leftBtn.$el.attr('transform', `translate(0, ${height/2})`);
        this.$rightBtn.$el
            .attr('transform', `translate(${width}, ${height/2})`);

        this.onRefresh();
    };

    NestedLayer.prototype.destroy = function() {
        this.control.destroy();
        this.widget.destroy();
        this.$el.remove();
    };

    return NestedLayer;
});
