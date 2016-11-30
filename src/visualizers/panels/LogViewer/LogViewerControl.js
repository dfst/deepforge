/*globals define, _*/
/*jshint browser: true*/

// This is a read-only view of the 'stdout' attribute for a Job node
// if the job is running, get the logs from the log-storage
define([
    'q',
    'deepforge/api/JobLogsClient',
    'js/Constants',
    'deepforge/Constants',
    'panels/TextEditor/TextEditorControl'
], function (
    Q,
    JobLogsClient,
    GME_CONSTANTS,
    CONSTANTS,
    TextEditorControl
) {

    'use strict';

    var LogViewerControl;

    LogViewerControl = function (options) {
        options.attributeName = 'stdout';
        TextEditorControl.call(this, options);
    };

    _.extend(LogViewerControl.prototype, TextEditorControl.prototype);

    LogViewerControl.prototype.getFullDescriptor = function (id) {
        var desc = LogViewerControl.prototype._getObjectDescriptor.call(this, id);

        return this._getRunningLogs(id).then(text => {
            // Use attribute or running log if none
            desc.text = desc.text || text;
            return desc;
        });
    };

    LogViewerControl.prototype.getUpdatedJobId = function (msg) {
        // verify that it is the given notification type
        if (msg.indexOf(CONSTANTS.STDOUT_UPDATE) !== -1) {
            return msg.replace(/^[^\/]*\//, '');
        }
    };

    LogViewerControl.prototype.selectedObjectChanged = function (id) {
        TextEditorControl.prototype.selectedObjectChanged.call(this, id);
        // Listen for notifications about updated logs
        this.removeNotificationHandler();
        this.notificationHandler = (sender, data) => {
            var nodeId = this.getUpdatedJobId(data.message);
            if (nodeId === id) {
                this._onUpdate(id);
            }
        };
        this._client.addEventListener(GME_CONSTANTS.CLIENT.NOTIFICATION, this.notificationHandler);
    };

    LogViewerControl.prototype.removeNotificationHandler = function () {
        // Remove the notifications listener
        if (this.notificationHandler) {
            this._client.removeEventListener();
            this.notificationHandler = null;
        }
    };

    LogViewerControl.prototype.destroy = function () {
        TextEditorControl.prototype.destroy.call(this);
        this.removeNotificationHandler();
    };

    LogViewerControl.prototype._onLoad = function (id) {
        this.getFullDescriptor(id).then(desc => this._widget.addNode(desc));
    };

    LogViewerControl.prototype._onUpdate = function (id) {
        if (id === this._currentNodeId) {
            this.getFullDescriptor(id).then(desc => this._widget.updateNode(desc));
        }
    };

    LogViewerControl.prototype._getRunningLogs = function (id) {
        var logManager;

        if (!this._client.getActiveBranchName() || !this._client.getActiveProjectId()) {
            // Logs are only stored for a given branch
            return Q().then(() => '');
        }

        logManager = new JobLogsClient({
            logger: this._logger,
            projectId: this._client.getActiveProjectId(),
            branchName: this._client.getActiveBranchName()
        });

        return logManager.getLog(id);
    };

    return LogViewerControl;
});
