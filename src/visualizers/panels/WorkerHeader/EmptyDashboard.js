/* globals define, $ */
define([
    'css!./EmptyDashboard.css'
], function(
) {

    const EmptyDashboard = function(name, logger, $container) {
        this.$el = $('<div>', {class: 'empty-dashboard'});
        this.$el.text(`No dashboard available for ${name} backend`);
        this.logger = logger.fork(name);
        $container.append(this.$el);
    };

    EmptyDashboard.prototype.onShow =
    EmptyDashboard.prototype.onHide =
    EmptyDashboard.prototype.onActivate =
    EmptyDashboard.prototype.onDeactivate = () => {};

    return EmptyDashboard;
});
