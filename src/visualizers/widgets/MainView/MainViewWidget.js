/*globals $, WebGMEGlobal,define */
/*jshint browser: true*/

define([
    'deepforge/globals',
    'text!./NavBar.html',
    'text!./ListItem.ejs',
    'underscore',
    'css!./styles/MainViewWidget.css'
], function (
    DeepForge,
    NavBarHTML,
    ListItem,
    _
) {
    'use strict';

    var MainViewWidget,
        WIDGET_CLASS = 'main-view',
        CreateListItem = _.template(ListItem);

    MainViewWidget = function (logger, container) {
        this._logger = logger.fork('Widget');
        this.$el = container;
        this.$el.addClass(WIDGET_CLASS);
        this.initialize();
        this._logger.debug('ctor finished');
    };

    MainViewWidget.prototype.initialize = function () {
        // Create the nav bar
        this.$nav = $(NavBarHTML);
        this.$el.append(this.$nav);

        this.$archlist = this.$nav.find('#arch-list-content');
        this.$artifacts = this.$nav.find('#artifact-list-content');

        // opening, closing
        this._closed = true;
        this.$nav.find('.side-nav-control').on('click', this.controlClicked.bind(this));
        this.$nav.on('transitionend', this.onChanged.bind(this));

        // action buttons
        this.$nav.on('click', '#create-artifact', DeepForge.create.Artifact);
        this.$nav.on('click', '#create-arch', DeepForge.create.Architecture);
        this.$nav.on('click', '.select-node', this.onNodeClick.bind(this));
        this.$nav.on('click', '.del-node', this.onDelNodeClick.bind(this));
        this.$nav.on('click', '.dl-node', this.onDownloadNodeClick.bind(this));

        this.htmlFor = {};
    };

    MainViewWidget.prototype.width = function () {
        return this._closedWidth;
    };

    MainViewWidget.prototype.onChanged = function () {
        if (!this._closed) {  // add the text back
            this.$nav.removeClass('hide-list');
        } else {
            this._closedWidth = this.$nav.width();
        }
    };

    MainViewWidget.prototype.controlClicked = function () {
        this._closed = !this._closed;
        if (this._closed) {
            this.$nav.addClass('hide-list');
            this.$nav.addClass('closed');
        } else {  // remove the 'closed' class
            this.$nav.removeClass('closed');
        }
    };

    MainViewWidget.prototype.onWidgetContainerResize = function () {
        var rect = this.$el[0].getBoundingClientRect(),
            top = rect.top;

        this.$nav.css({
            top: top + 'px'
        });

        if (this._closed) {
            this._closedWidth = this.$nav.width();
        }
    };

    MainViewWidget.prototype.createNode = function(desc) {
        // Create the architecture list item
        var li;

        desc.download = false;
        li = $(CreateListItem(desc));
        this.htmlFor[desc.id] = li;
        return li;
    };

    MainViewWidget.prototype.addArch = function(desc) {
        var html = this.createNode(desc);
        this.$archlist.append(html);
    };

    MainViewWidget.prototype.addArtifact = function(desc) {
        var html = this.createNode(desc);
        this.$artifacts.append(html);
    };

    MainViewWidget.prototype.onDelNodeClick = function(event) {
        var id = this.getElementId(event.target);
        event.stopPropagation();
        if (id) {
            this.deleteNode(id);
        }
    };

    MainViewWidget.prototype.onDownloadNodeClick = function(event) {
        var id = this.getElementId(event.target),
            url;

        event.stopPropagation();
        if (id) {
            url = this.dataUrlFor(id);
            if (url) {
                this._download(url);
            }
        }
    };

    MainViewWidget.prototype._download = function(url) {
        var anchor = document.createElement('a');
        anchor.setAttribute('href', url);
        anchor.setAttribute('target', '_self');
        anchor.click();
    };

    MainViewWidget.prototype.onNodeClick = function(event) {
        var id = this.getElementId(event.target);
        event.stopPropagation();
        if (id) {
            WebGMEGlobal.State.registerActiveObject(id);
        }
    };

    MainViewWidget.prototype.getElementId = function(element) {
        while(!element.getAttribute('data-id') && element.parentNode) {
            element = element.parentNode;
        }
        return element.getAttribute('data-id');
    };

    MainViewWidget.prototype.removeNode = function(id) {
        if (this.htmlFor[id]) {
            this.htmlFor[id].remove();
            delete this.htmlFor[id];
        }
    };

    MainViewWidget.prototype.updateNode = function (desc) {
        if (this.htmlFor[desc.id]) {
            this.htmlFor[desc.id].text(desc.name);
        }
    };

    /* * * * * * * * Visualizer life cycle callbacks * * * * * * * */
    MainViewWidget.prototype.destroy = function () {
    };

    MainViewWidget.prototype.onActivate = function () {
        this._logger.debug('MainViewWidget has been activated');
    };

    MainViewWidget.prototype.onDeactivate = function () {
        this._logger.debug('MainViewWidget has been deactivated');
    };

    return MainViewWidget;
});
