/* globals define, $ */
define([
    'deepforge/execution/index',
    'q',
    'deepforge/viz/Utils',
    './EmptyDashboard',
    'underscore',
    'text!./ComputeModal.html.ejs',
    'css!./ComputeModal.css'
], function(
    Execution,
    Q,
    utils,
    EmptyDashboard,
    _,
    ComputeHtml,
) {
    'use strict';

    const ComputeHtmlTpl = _.template(ComputeHtml);
    const ComputeDialog = function(logger) {
        this.active = false;
        this.logger = logger.fork('ComputeDialog');

        const backendNames = Execution.getAvailableBackends();
        this.$el = $(ComputeHtmlTpl({tabs: backendNames}));
        this.dashboards = backendNames
            .map(name => {
                const backend = Execution.getBackend(name);
                const Dashboard = backend.getDashboard() || EmptyDashboard.bind(null, name);
                const $container = this.$el.find(`#${name}-dashboard-container`);

                return new Dashboard(this.logger, $container);
            });
    };

    ComputeDialog.prototype.initialize = function() {
        this.$el.modal('show');
        this.$el.on('hidden.bs.modal', () => this.onHide());
    };

    ComputeDialog.prototype.show = function() {
        this.initialize();
        this.dashboards.forEach(dashboard => dashboard.onShow());
    };

    ComputeDialog.prototype.onHide = function() {
        this.dashboards.forEach(dashboard => dashboard.onHide());
    };

    return ComputeDialog;
});
