/* globals define, $ */
define([
    'text!./WorkerModal.html',
    'css!./WorkerModal.css'
], function(
    WorkerHtml
) {
    'use strict';

    var WorkerDialog = function() {
        // TODO: Poll /rest/executor/worker for the worker status
        // TODO: Poll the current job queue
    };

    WorkerDialog.prototype.initialize = function() {
        this._dialog = $(WorkerHtml);
        this._dialog.modal('show');
    };

    WorkerDialog.prototype.show = function() {
        this.update();
        this.initialize();
        // TODO
    };

    WorkerDialog.prototype.update = function() {
        // Poll the workers
        // TODO

        // Poll the job queue
        // TODO

        // update the ui
        // TODO
    };

    return WorkerDialog;
});
