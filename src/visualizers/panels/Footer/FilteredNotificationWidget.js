/* globals define */
// A notification widget which filters out stdout update notifications
define([
    'deepforge/Constants',
    'js/Widgets/Notification/NotificationWidget'
], function(
    CONSTANTS,
    GmeNotificationWidget
) {
    var NotificationWidget = function() {
        GmeNotificationWidget.apply(this, arguments);
    };

    NotificationWidget.prototype = Object.create(GmeNotificationWidget.prototype);

    NotificationWidget.prototype.isUserNotication = function(data) {
        return data.message.indexOf(CONSTANTS.STDOUT_UPDATE) === -1;
    };

    NotificationWidget.prototype._refreshNotifications = function(eventData) {

        if (this.isUserNotication(eventData)) {
            GmeNotificationWidget.prototype._refreshNotifications.call(this, eventData);
        }
    };

    return NotificationWidget;
});
