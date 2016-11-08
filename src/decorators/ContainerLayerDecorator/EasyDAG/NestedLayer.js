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

        this._nodeId = opts.id;
        this._parent = opts.parent;
        this.logger = opts.logger;

        this.widget = new ArchEditorWidget({
            logger: this.logger.fork('ArchWidget'),
            autoCenter: false,
            svg: this.$el
        });
        this.widget.setTitle =
        this.widget.updateEmptyMsg = nop;
        this.widget.refreshExtras = opts.onRefresh;

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
        this.control.selectedObjectChanged(this._nodeId);
    };

    return NestedLayer;
});
