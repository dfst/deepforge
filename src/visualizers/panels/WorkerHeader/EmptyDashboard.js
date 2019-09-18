/* globals define, $ */
define([
    'deepforge/compute/backends/ComputeDashboard',
    'css!./EmptyDashboard.css',
], function(
    ComputeDashboard
) {

    const EmptyDashboard = function(name, logger, $container) {
        this.$el = $('<div>', {class: 'empty-dashboard'});
        this.$el.text(`No dashboard available for ${name} backend`);
        this.logger = logger.fork(name);
        $container.append(this.$el);
    };

    EmptyDashboard.prototype = Object.create(ComputeDashboard.prototype);

    return EmptyDashboard;
});
