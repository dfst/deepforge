/* globals define, $, _ */
define([
    'q',
    'superagent',
    'deepforge/viz/Utils',
    'text!./WorkerModal.html',
    'text!./WorkerTemplate.html.ejs',
    'css!./WorkerModal.css'
], function(
    Q,
    superagent,
    utils,
    WorkerHtml,
    WorkerTemplate
) {
    'use strict';

    var WORKER_ENDPOINT = '/rest/executor/worker',
        JOBS_ENDPOINT = '/rest/executor';

    var WorkerDialog = function() {
        // TODO: Poll /rest/executor/worker for the worker status
        // TODO: Poll the current job queue
        this.workerDict = {};
        this.workers = {};
        this.active = false;
    };

    WorkerDialog.prototype.initialize = function() {
        this._dialog = $(WorkerHtml);
        this._table = this._dialog.find('.worker-list');
        this._dialog.modal('show');
        this._dialog.on('hidden.bs.modal', () => this.active = false);
    };

    WorkerDialog.prototype.show = function() {
        this.active = true;
        this.update();
        this.initialize();
        // TODO
    };

    WorkerDialog.prototype.get = function(url) {
        var deferred = Q.defer();

        superagent.get(url)
            .end((err, res) => {
                if (err) {
                    return deferred.reject(err);
                }
                deferred.resolve(JSON.parse(res.text));
            });

        return deferred.promise;
    };

    WorkerDialog.prototype.update = function() {
        console.log('updating...');
        // Poll the workers
        return Q.all([
            this.get(WORKER_ENDPOINT).then(workers => this.updateWorkers(workers)),
            this.get(JOBS_ENDPOINT).then(jobs => this.updateJobs(jobs))
        ]).then(() => {
            if (this.active) {
                setTimeout(this.update.bind(this), 1000);
            }
        })
        .catch(err => console.error('Update failed:', err));
    };

    WorkerDialog.prototype.updateWorkers = function(workerDict) {
        var ids = Object.keys(workerDict),
            oldWorkerIds,
            i;

        for (i = ids.length; i--;) {
            this.updateWorker(workerDict[ids[i]]);
            delete this.workerDict[ids[i]];
        }

        // Clear old workers
        oldWorkerIds = Object.keys(this.workerDict);
        for (i = oldWorkerIds.length; i--;) {
            this.removeWorker(oldWorkerIds[i]);
        }

        this.workerDict = workerDict;
    };

    WorkerDialog.prototype.updateWorker = function(worker) {
        var row = this.workers[worker.clientId] || $(WorkerTemplate);

        worker.lastSeen = utils.getDisplayTime(worker.lastSeen*1000);
        worker.status = worker.jobs.length ? 'RUNNING' : 'READY';

        row.find('.lastSeen').text(worker.lastSeen);
        row.find('.clientId').text(worker.clientId);
        row.find('.status').text(worker.status);
        if (!this.workers[worker.clientId]) {
            this._table.append(row);
            this.workers[worker.clientId] = row;
        }
    };

    WorkerDialog.prototype.removeWorker = function(workerId) {
        this.workers[workerId].remove();
        delete this.workers[workerId];
    };

    WorkerDialog.prototype.updateJobs = function(jobsDict) {
        console.log('jobs:', jobsDict);
    };

    return WorkerDialog;
});
