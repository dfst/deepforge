/* globals define, $ */
define([
    'deepforge/compute/index',
    'q',
    'deepforge/viz/Utils',
    './EmptyDashboard',
    'underscore',
    'text!./ComputeModal.html.ejs',
    'css!./ComputeModal.css'
], function(
    Compute,
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

        const backendNames = Compute.getAvailableBackends();
        this.$el = $(ComputeHtmlTpl({tabs: backendNames}));
        this.backends = backendNames;
        this.dashboards = null;
    };

    ComputeDialog.prototype.loadDashboards = async function() {
        const fetchDashboards = this.backends
            .map(async name => {
                const backend = Compute.getBackend(name);
                console.log('loading dashboard for', name);
                const Dashboard = await backend.getDashboard() || EmptyDashboard.bind(null, name);
                const $container = this.$el.find(`#${name}-dashboard-container`);

                return new Dashboard(this.logger, $container);
            });

        this.dashboards = await Promise.all(fetchDashboards);
    };

    ComputeDialog.prototype.initialize = function() {
        this.$el.modal('show');
        this.$el.on('hidden.bs.modal', () => this.onHide());
    };

    ComputeDialog.prototype.show = async function() {
        this.initialize();
        await this.loadDashboards();
        this.dashboards.forEach(dashboard => dashboard.onShow());
    };

    ComputeDialog.prototype.onHide = function() {
        this.dashboards.forEach(dashboard => dashboard.onHide());
    };

    return ComputeDialog;
});
