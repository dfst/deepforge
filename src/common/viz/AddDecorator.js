/* globals define */
// This contains decorators for actions such as 'New Operation' so
// the given action can be used as a node in NodePrompter, etc
define([
    'css!./AddDecorator.css'
], function(
) {

    var NewDecorator = function (opts) {
        this.$el = opts.parentEl.append('g')
            .attr('class', 'centering-offset');

        this.$body = this.$el.append('g')
            .attr('class', 'new-node-decorator');

        this.radius = opts.radius || 20;
        this.height = this.radius*2;
        this.width = opts.width || 90;
        this.size = this.radius * 1.00;

        if (opts.circle) {
            this.render = this.renderCircle;
        } else {
            this.render = this.renderRect;
        }
    };

    NewDecorator.prototype.renderRect = function() {
        this.$body.remove();
        this.$body = this.$el.append('g')
            .attr('class', 'new-node-decorator');

        this.$body.append('rect')
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', this.width)
            .attr('height', this.height);

        this.renderPlus()
            .attr('class', 'dark')
            .attr('transform', `translate(${this.width/2-this.size}, 0)`);
        
    };

    NewDecorator.prototype.renderCircle = function() {
        this.$body.remove();
        this.$body = this.$el.append('g')
            .attr('class', 'new-node-decorator');

        this.$body.append('circle')
            .attr('cx', this.radius)
            .attr('cy', this.radius)
            .attr('r', this.radius);

        this.renderPlus();
        this.$el.attr('transform', `translate(${this.width/2-this.size}, ${this.height/2-this.size})`);
    };

    NewDecorator.prototype.renderPlus = function() {
        // Create a large '+' symbol in a rectangle
        var start = this.radius-this.size/2,
            end = start + this.size,
            middle = (start+end)/2,
            plus = this.$body.append('g');

        plus.append('line')
            .attr('x1', start)
            .attr('x2', end)
            .attr('y1', middle)
            .attr('y2', middle)
            .attr('stroke', 'black');

        plus.append('line')
            .attr('x1', middle)
            .attr('x2', middle)
            .attr('y1', start)
            .attr('y2', end)
            .attr('stroke', 'black');

        return plus;
    };

    return NewDecorator;
});
