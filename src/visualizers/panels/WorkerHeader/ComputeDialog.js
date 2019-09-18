/* globals define, $ */
define([
    'deepforge/execution/index',
    'q',
    'deepforge/viz/Utils',
    './EmptyDashboard',
    'text!./ComputeModal.html',
    'css!./ComputeModal.css'
], function(
    Execution,
    Q,
    utils,
    EmptyDashboard,
    ComputeHtml,
) {
    'use strict';

    const ComputeDialog = function(logger) {
        this.active = false;
        this.logger = logger.fork('ComputeDialog');
        this.$el = $(ComputeHtml);
        // TODO: Handle this differently if there are multiple dashboards?
        this.$content = this.$el.find('.dashboard-content');
        this.dashboards = Execution.getAvailableBackends().slice(0, 1)  // FIXME
            .map(name => Execution.getBackend(name).getDashboard() || EmptyDashboard.bind(null, name))
            .map(ctor => new ctor(this.$content));
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
