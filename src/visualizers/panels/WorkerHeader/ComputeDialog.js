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

        this.$el = null;
        this.backends = null;
        this.dashboards = null;
    };

    ComputeDialog.prototype.loadDashboards = async function() {
    };

    ComputeDialog.prototype.initialize = async function() {
        const backends = Compute.getAvailableBackends()
            .map(name => Compute.getBackend(name));

        this.$el = $(ComputeHtmlTpl({tabs: backends}));
        const fetchDashboards = backends
            .map(async backend => {
                const Dashboard = await backend.getDashboard() || EmptyDashboard.bind(null, backend.name);
                const $container = this.$el.find(`#${backend.id}-dashboard-container`);

                return new Dashboard(this.logger, $container);
            });

        this.dashboards = await Promise.all(fetchDashboards);

        this.$el.modal('show');
        this.$el.on('hidden.bs.modal', () => this.onHide());
    };

    ComputeDialog.prototype.show = async function() {
        await this.initialize();
        this.dashboards.forEach(dashboard => dashboard.onShow());
    };

    ComputeDialog.prototype.onHide = function() {
        this.dashboards.forEach(dashboard => dashboard.onHide());
    };

    return ComputeDialog;
});
