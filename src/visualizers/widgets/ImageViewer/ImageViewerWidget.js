/*globals define, $*/
/*jshint browser: true*/

define([
    'css!./styles/ImageViewerWidget.css'
], function (
) {
    'use strict';

    var ImageViewerWidget,
        NO_IMAGE_URL = 'extlib/src/visualizers/widgets/ImageViewer/no-image.gif',
        WIDGET_CLASS = 'image-viewer';

    ImageViewerWidget = function (logger, container) {
        this._logger = logger.fork('Widget');
        this.$el = container;
        this._initialize();
        this._logger.debug('ctor finished');
    };

    ImageViewerWidget.prototype._initialize = function () {
        // set widget class
        this.$el.addClass(WIDGET_CLASS);
        this.zoom = 1;
        this.left = 0;
        this.top = 0;
        this.width = 0;
        this.height = 0;
        this.img = {
            width: 0,
            height: 0
        };

        this.$image = $('<img>');
        this.$el.append(this.$image);

        this.$image.on('load', () => {
            this.img.width = this.$image.width();
            this.img.height = this.$image.height();
            this.centerImage();
        });

        this.updateImage(NO_IMAGE_URL);

        // Zoom functionality
        this.$el[0].onwheel = event => {
            if (event.ctrlKey || event.metaKey || event.altKey) {
                var dz = -event.deltaY/20;
                this.zoom += dz;
                this.centerImage();
                event.stopPropagation();
                event.preventDefault();
            }
        };
    };

    ImageViewerWidget.prototype.centerImage = function () {
        var left,
            top;

        this.left = this.width/2 - (this.img.width*this.zoom/2);
        this.top = this.height/2 - (this.img.height*this.zoom/2);

        left = this.left/this.zoom;
        top = this.top/this.zoom;
        this.$image.css({
            left: left,
            top: top,
            zoom: this.zoom
        });
    };

    ImageViewerWidget.prototype.onWidgetContainerResize = function (width, height) {
        this.$el.css({
            width: width,
            height: height
        });
        this.width = width;
        this.height = height;
        this.centerImage();
    };

    ImageViewerWidget.prototype.updateImage = function (url) {
        url = url || NO_IMAGE_URL;
        this.$image.attr('src', url);
    };

    ImageViewerWidget.prototype.removeImage = function () {
        // Change to 'no picture' image
        this.updateImage(NO_IMAGE_URL);
    };

    /* * * * * * * * Visualizer life cycle callbacks * * * * * * * */
    ImageViewerWidget.prototype.destroy = function () {
    };

    ImageViewerWidget.prototype.onActivate = function () {
        this._logger.debug('ImageViewerWidget has been activated');
    };

    ImageViewerWidget.prototype.onDeactivate = function () {
        this._logger.debug('ImageViewerWidget has been deactivated');
    };

    return ImageViewerWidget;
});
