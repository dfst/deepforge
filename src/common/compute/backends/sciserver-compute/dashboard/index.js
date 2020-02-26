/*globals define, $*/
define([
    '../../ComputeDashboard',
    'text!./dashboard.html',
], function(
    ComputeDashboard,
    DashboardHtml,
) {
    const Dashboard = function(logger, $container) {
        const link = $(DashboardHtml);
        $container.append(link);
    };

    Dashboard.prototype = Object.create(ComputeDashboard.prototype);

    return Dashboard;
});
