/*globals define, _, $*/
define(['./lib/plotly.min',], function (Plotly) {
    'use strict';

    const WIDGET_CLASS = 'plotly-graph';

    function PlotlyGraphWidget(logger, container) {
        this.logger = logger.fork('widget');
        this.$el = container;
        this.$defaultTextDiv = $('<div>', {
            class: 'h2 center'
        }).text('No Data Available.')
            .css({
                'margin-top': this.$el.height() / 2
            });

        this.$el.css('overflow', 'auto');
        this.$el.addClass(WIDGET_CLASS);
        this.nodes = {};
        this.plotlyJSON = null;
        this.layout = {};
        this.created = false;
        this.logger.debug('ctor finished');
        this.toggleText();
    }

    PlotlyGraphWidget.prototype.onWidgetContainerResize = function (width, height) {
        // Nothing needs to be done here since the chart is already responsive
        this.$el.css({
            width: width,
            height: height
        });
        this.$defaultTextDiv.css({
            'margin-top': height / 2
        });
        this.logger.debug('Widget is resizing...');
    };

    // Adding/Removing/Updating items
    PlotlyGraphWidget.prototype.addNode = function (desc) {
        if (desc) {
            this.plotlyJSON = desc;
            this.refreshChart();
        }
    };

    PlotlyGraphWidget.prototype.removeNode = function () {
        this.plotlyJSON = null;
        this.refreshChart();
    };

    PlotlyGraphWidget.prototype.updateNode = function (desc) {
        if (desc) {
            this.plotlyJSON = desc;
            this.refreshChart();
        }
    };

    PlotlyGraphWidget.prototype.createOrUpdateChart = function () {
        if (!this.plotlyJSON) {
            this.deleteChart();
        } else {
            if (!this.created && !_.isEmpty(this.plotlyJSON)) {
                this.toggleText(false);
                Plotly.newPlot(this.$el[0], this.plotlyJSON);
                this.created = true;
            } else if (!_.isEmpty(this.plotlyJSON)) {
                Plotly.react(this.$el[0], this.plotlyJSON);
            }
        }
    };

    PlotlyGraphWidget.prototype.refreshChart = _.debounce(PlotlyGraphWidget.prototype.createOrUpdateChart, 50);

    PlotlyGraphWidget.prototype.deleteChart = function () {
        this.plotlyJSON = null;
        if (this.created) {
            Plotly.purge(this.$el[0]);
            this.toggleText();
        }
        this.created = false;
    };

    PlotlyGraphWidget.prototype.toggleText = function (append = true) {
        if (append) this.$el.append(this.$defaultTextDiv);
        else this.$defaultTextDiv.remove();
    };
    /* * * * * * * * Visualizer life cycle callbacks * * * * * * * */
    PlotlyGraphWidget.prototype.destroy = function () {
        Plotly.purge(this.$el[0]);
    };

    PlotlyGraphWidget.prototype.onActivate = function () {
        this.logger.debug('PlotlyGraphWidget has been activated');
    };

    PlotlyGraphWidget.prototype.onDeactivate = function () {
        this.logger.debug('PlotlyGraphWidget has been deactivated');
    };

    return PlotlyGraphWidget;
});
