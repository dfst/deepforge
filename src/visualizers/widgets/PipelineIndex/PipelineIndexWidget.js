/*globals define, $, WebGMEGlobal */
/*jshint browser: true*/

define([
    'js/DragDrop/DropTarget',
    'text!./cards/Pipeline.ejs',
    'text!./cards/Architecture.ejs',
    'underscore',
    'css!./styles/PipelineIndexWidget.css'
], function (
    DropTarget,
    PipelineHtml,
    ResourceHtml,
    _
) {
    'use strict';

    var PipelineIndexWidget,
        PipelineTemplate = _.template(PipelineHtml),
        ResourceTemplate = _.template(ResourceHtml),
        EMPTY_MSG = 'No Existing Pipelines... yet!',
        WIDGET_CLASS = 'pipeline-index';

    PipelineIndexWidget = function (logger, container) {
        this.logger = logger.fork('Widget');

        this.$el = $('<div>', {
            class: 'row'
        });
        container.append(this.$el);
        container.addClass(`${WIDGET_CLASS} container`);

        this.cards = {};
        this.nodes = {};

        this.$backgroundText = null;
        this.updateBackgroundText();

        this._initializeEventHandlers(container);
        this.logger.debug('ctor finished');
    };

    PipelineIndexWidget.prototype._initializeEventHandlers = function (container) {
        this.$el.on('click', '.open-pipeline', this.openPipeline);
        this.$el.on('click', '.preview.card-image', this.openPipeline);

        this.$el.on('click', '.delete-pipeline', event => {
            var id = event.target.getAttribute('data-id');
            this.deletePipeline(id);
        });

        this.$el.on('click', '.pipeline-name', event => {
            var html = $(event.target),
                id = html.data('id');

            html.editInPlace({
                css: {
                    'z-index': 1000
                },
                onChange: (oldVal, newVal) => {
                    this.setName(id, newVal);
                }
            });
        });

        DropTarget.makeDroppable(container, {
            drop: (event, dragInfo) => {
                this.onBackgroundDrop(event, dragInfo);
            }
        });
    };

    PipelineIndexWidget.prototype.getEmptyMsg = function() {
        return EMPTY_MSG;
    };

    PipelineIndexWidget.prototype.updateBackgroundText = function() {
        if (this.$backgroundText) {
            this.$backgroundText.remove();
        }

        // Add background text if empty
        if (Object.keys(this.cards).length === 0) {
            this.$backgroundText = $('<div>', {class: 'background-text'});
            this.$backgroundText.text(this.getEmptyMsg());
            this.$el.append(this.$backgroundText);
        }
    };

    PipelineIndexWidget.prototype.openPipeline = function (event) {
        var target = event.target,
            indexOf = Array.prototype.indexOf,
            id;

        while (!target.classList || indexOf.call(target.classList, 'pipeline') === -1) {
            target = target.parentNode;
        }

        id = target.getAttribute('data-id');
        WebGMEGlobal.State.registerActiveObject(id);
    };

    // Adding/Removing/Updating items
    PipelineIndexWidget.prototype.getCardTemplate = function (desc) {
        if (desc.type === 'Pipeline') {
            return PipelineTemplate;
        }
        return ResourceTemplate;
    };

    PipelineIndexWidget.prototype.addNode = function (desc) {
        var node,
            Template;

        if (desc) {
            // Add node to a table of cards
            Template = this.getCardTemplate(desc);
            this.nodes[desc.id] = desc;
            node = $(Template(desc));
            this.cards[desc.id] = node;

            // Add click listeners
            this.$el.append(node);

            // Add the thumbnail
            if (desc.thumbnail) {
                this.addThumbnail(desc.thumbnail, node);
            }
            this.updateBackgroundText();
        }
    };

    PipelineIndexWidget.prototype.addThumbnail = function (thumbnail, node) {
        var container = node.find('.preview'),
            svg = $(thumbnail);

        // scale and shift the thumbnail
        svg.attr('width', 150)
            .attr('height', 150);

        container.empty();
        container.append(svg);
    };

    PipelineIndexWidget.prototype.removeNode = function (gmeId) {
        var html = this.cards[gmeId];
        if (html) {
            html.remove();
            delete this.cards[gmeId];
            this.updateBackgroundText();
        }
    };

    PipelineIndexWidget.prototype.updateNode = function (desc) {
        if (desc && this.cards[desc.id]) {
            var Template = this.getCardTemplate(desc);

            this.cards[desc.id].outerHTML = Template(desc);
            // Check if the preview changed
            if (desc.thumbnail !== this.nodes[desc.id].thumbnail) {
                this.addThumbnail(desc.thumbnail, this.cards[desc.id]);
            }
            this.nodes[desc.id] = desc;
        }
    };

    /* * * * * * * * Visualizer life cycle callbacks * * * * * * * */
    PipelineIndexWidget.prototype.destroy = function () {
    };

    PipelineIndexWidget.prototype.onActivate = function () {
        this.logger.debug('PipelineIndexWidget has been activated');
    };

    PipelineIndexWidget.prototype.onDeactivate = function () {
        this.logger.debug('PipelineIndexWidget has been deactivated');
    };

    return PipelineIndexWidget;
});
