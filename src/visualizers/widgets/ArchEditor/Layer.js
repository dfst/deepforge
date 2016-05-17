define([
    'widgets/EasyDAG/DAGItem'
], function(
    DAGItem
) {
    var Layer = function(parentEl, desc) {
        this.id = desc.id;
        this.name = desc.name;
        this.desc = desc;


        this.$container = parentEl
            .append('svg');

        this.$el = this.$container
            .append('g')
            .attr('id', this.id)
            .attr('class', 'position-offset');

        this.decorator = new this.desc.Decorator({
            color: desc.color,
            node: desc,
            parentEl: this.$el
        });

        this.width = this.decorator.width;
        this.height = this.decorator.height;

        // Set up decorator callbacks
        this.setupDecoratorCallbacks();
    };

    _.extend(Layer.prototype, DAGItem.prototype);

    return Layer;
});
