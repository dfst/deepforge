/*globals define, $*/
/*jshint browser: true*/

define([
    './ModelItem',
    'text!./Table.html',
    'css!./styles/ArtifactIndexWidget.css'
], function (
    ModelItem,
    TABLE_HTML
) {
    'use strict';

    var ArtifactIndexWidget,
        WIDGET_CLASS = 'artifact-index',
        nop = function(){};

    ArtifactIndexWidget = function (logger, container) {
        this._logger = logger.fork('Widget');

        this.$el = container;

        this.nodes = {};
        this.currentNode = null;
        this._initialize();

        this._logger.debug('ctor finished');
    };

    ArtifactIndexWidget.prototype._initialize = function () {
        // set widget class
        this.$el.addClass(WIDGET_CLASS);

        this.$content = $(TABLE_HTML);
        this.$el.append(this.$content);
        this.$list = this.$content.find('.list-content');
    };

    ArtifactIndexWidget.prototype.onWidgetContainerResize = nop;

    // Adding/Removing/Updating items
    ArtifactIndexWidget.prototype.addNode = function (desc) {
        if (desc && desc.parentId === this.currentNode) {
            var node = new ModelItem(this.$list, desc);
            this.nodes[desc.id] = node;
            node.$delete.on('click', event => {
                this.onNodeDeleteClicked(desc.id);
                event.stopPropagation();
                event.preventDefault();
            });
            node.$download.on('click', async event => {
                const url = await this.getDownloadURL(desc.id);
                this.download(desc.name, url);
                event.stopPropagation();
                event.preventDefault();
            });
            node.$el.on('click', event => {
                this.onNodeClick(desc.id);
                event.stopPropagation();
                event.preventDefault();
            });
            node.$name.on('dblclick', event => {
                const name = $(event.target);
                name.editInPlace({
                    css: {
                        'z-index': 1000
                    },
                    onChange: (oldVal, newVal) => {
                        if (newVal && newVal !== oldVal) {
                            this.onNameChange(desc.id, newVal);
                        }
                    }
                });
            });
        }
    };

    ArtifactIndexWidget.prototype.removeNode = function (gmeId) {
        var node = this.nodes[gmeId];
        if (node) {
            node.remove();
            delete this.nodes[gmeId];
        }
    };

    ArtifactIndexWidget.prototype.updateNode = function (desc) {
        if (desc && desc.parentId === this.currentNode) {
            this.nodes[desc.id].update(desc);
        }
    };

    /* * * * * * * * Visualizer event handlers * * * * * * * */


    /* * * * * * * * Visualizer life cycle callbacks * * * * * * * */
    ArtifactIndexWidget.prototype.destroy = function () {
    };

    ArtifactIndexWidget.prototype.onActivate = function () {
    };

    ArtifactIndexWidget.prototype.onDeactivate = function () {
    };

    ArtifactIndexWidget.prototype.download = function (filename, url) {
        const element = document.createElement('a');
        element.style.display = 'none';
        document.body.appendChild(element);
        element.href = url;
        element.target = '_self';
        element.setAttribute('download', filename);
        element.click();
        document.body.removeChild(element);
    };

    return ArtifactIndexWidget;
});
