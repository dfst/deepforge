/*globals define, d3 */
// Given a container and a set of nodes, this will prompt the user
// to select one of the set of nodes. This will also need to support
// adding a "plus" button for creating new objects in line

define([
    'q'
], function(
    Q
) {

    var MARGIN = 15,
        CLOSING_GRACE = 400,
        TRANSITION_DURATION = 400;

    var NodePrompter = function(rect, opts) {
        opts = opts || {};
        // default options
        opts.padding = opts.padding || 0;

        this.left = rect.left-opts.padding;
        this.top = rect.top-opts.padding;
        this.width = rect.width + 2*opts.padding;
        this.height = rect.height + 2*opts.padding;
        this.cx = opts.cx || rect.left + rect.width/2;
        this.cy = opts.cy || rect.top + rect.height/2;
        this.active = true;
        this.onNode = false;

        var container = document.createElement('div');
        this.container = container;
        container.style.width = this.width + 'px';
        container.style.height = this.height+'px';
        container.style.position = 'absolute';

    };

    NodePrompter.prototype.prompt = function(nodes, selectFn) {
        var deferred = Q.defer(),
            size,
            cornerRadius = 10;

        this.selectHandler = selectFn;
        this.svg = d3.select(this.container).append('svg')
            .attr('width', this.width)
            .attr('height', this.height)
            .attr('overflow', 'hidden');

        document.body.appendChild(this.container);

        // Expand the panel
        this.panel = this.svg.append('rect');
        size = this.initNodes(nodes);
        this.resize(size.width, size.height);

        // Create the panel
        this.panel
            .attr('x', this.cx)
            .attr('y', this.cy)
            .attr('rx', 1)
            .attr('ry', 1)
            .attr('height', 1)
            .attr('width', 1)
            .attr('fill', 'red');


        this.panel.transition()
            .delay(50)
            .duration(TRANSITION_DURATION)
            .attr('x', 0)
            .attr('y', 0)
            .attr('rx', cornerRadius)
            .attr('ry', cornerRadius)
            .attr('height', this.height)
            .attr('width', this.width)
            .attr('fill', '#e0e0e0')
            .each('end', () => {
                // Add the given nodes to the panel
                this.showNodes(nodes, deferred.resolve);
                //setTimeout(this.destroyIfInactive.bind(this), CLOSING_GRACE);
            });

        // Event handling
        this.svg.on('mouseout', () => {
            this.active = false;
            setTimeout(this.destroyIfInactive.bind(this), CLOSING_GRACE);
        });
        this.svg.on('mouseover', () => this.active = true);

        // Return a promise called on 'selected'
        return deferred.promise;
    };

    NodePrompter.prototype.resize = function(width, height) {
        var dx = this.width - width,
            dy = this.height - height;

        this.nodes.forEach(node => node.moveBy(-dx/2, 0));
        this.left += dx;
        this.top += dy;
        this.cx -= dx;
        this.cy -= dy;

        this.container.style.left = this.left + 'px';
        this.container.style.top = this.top + 'px';

        this.width = width;
        this.height = height;
    };

    NodePrompter.prototype.destroyIfInactive = function() {
        // Verify that is not over any of the displayed nodes
        if (!this.active && !this.onNode) {
            this.destroy();
        }
    };

    NodePrompter.prototype.destroy = function() {
        this.hideNodes();
        this.panel.transition()
            .duration(TRANSITION_DURATION)
            .attr('x', this.cx)
            .attr('y', this.cy)
            .attr('rx', 1)
            .attr('ry', 1)
            .attr('height', 1)
            .attr('width', 1)
            .attr('fill', '#f44336')
            .each('end', () => {
                this.container.remove();
            });
    };

    NodePrompter.prototype.onSelected = function(container, callback) {
        // Return the id
        if (this.selectHandler) {
            this.selectHandler(container.node, this);
        } else {
            this.destroy();
            return callback(container.node);
        }
    };

    NodePrompter.prototype.initNodes = function(nodes) {
        // For each node, create the containers and position them
        var decorators = nodes.map(node => new Container(this.svg, node)),
            lineGroup,
            maxLineWidth = this.width - 2*MARGIN,
            totalWidth = 0,
            lineWidth,
            lineStartHeight = MARGIN,
            lineHeight,
            cntr,
            x,y,
            i = 0;

        // Position the nodes. while we can fit the node on the given line, add it
        decorators.forEach(d => {
            d.computeSize(0.25);
        });

        while (i < decorators.length) {
            lineGroup = [decorators[i]];
            lineWidth = decorators[i].width() + MARGIN;
            lineHeight = decorators[i].height();
            i++;
            while (i < decorators.length &&
                lineWidth + decorators[i].width() + MARGIN < maxLineWidth) {

                lineGroup.push(decorators[i]);
                lineWidth += decorators[i].width() + MARGIN;
                lineHeight = Math.max(lineHeight, decorators[i].height());
                i++;
            }

            // Get the positions for each
            lineWidth += MARGIN;
            totalWidth = Math.max(lineWidth, totalWidth);
            x = (this.width-lineWidth)/2 + MARGIN;
            for (var g = 0; g < lineGroup.length; g++) {
                cntr = lineGroup[g];
                y = (lineHeight - cntr.height())/2 + lineStartHeight;
                cntr.goTo(x, y);
                x += cntr.width() + MARGIN;
            }

            lineStartHeight += lineHeight + MARGIN;
        }
        
        this.nodes = decorators;
        return {
            height: lineStartHeight,
            width: totalWidth
        };
    };

    NodePrompter.prototype.showNodes = function(nodes, callback) {
        this.nodes.forEach(d => {
            d.render(0.25);
            d.$el.on('mouseover', () => this.onNode = true);
            d.$el.on('mouseout', () => this.onNode = false);
            d.$el.on('click', () => this.onSelected(d, callback));
        });
    };

    NodePrompter.prototype.hideNodes = function() {
        this.nodes.forEach(node => node.$el.remove());
    };

    var Container = function(svg, node) {  // used for positioning
        this.$el = svg.append('g');
        this.x = 0;
        this.y = 0;
        this.node = node;
        this.decorator = new node.Decorator({
            node: node,
            parentEl: this.$el
        });
    };

    Container.prototype.moveBy = function(dx, dy) {
        dx = dx || 0;
        dy = dy || 0;
        this.x += dx;
        this.y += dy;
    };

    Container.prototype.goTo = function(x, y) {
        this.x = x;
        this.y = y;
    };

    Container.prototype.computeSize = function(zoom) {
        this.$el.attr('opacity', 0);
        this.decorator.render(zoom);
    };

    Container.prototype.render = function(zoom) {
        this.$el.attr('transform', `translate(${this.x}, ${this.y})`);
        this.$el
            .transition()
            .attr('opacity', 1);
        this.decorator.render(zoom);
    };

    Container.prototype.width = function() {
        return this.decorator.width;
    };

    Container.prototype.height = function() {
        return this.decorator.height;
    };

    return NodePrompter;
});
