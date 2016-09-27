/* globals define, $, _ */
define([
    'q',
    'superagent',
    'deepforge/viz/Utils',
    'deepforge/api/JobOriginClient',
    'text!./WorkerModal.html',
    'text!./WorkerTemplate.html.ejs',
    'text!./WorkerJobItem.html',
    'css!./WorkerModal.css'
], function(
    Q,
    superagent,
    utils,
    JobOriginClient,
    WorkerHtml,
    WorkerTemplate,
    WorkerJobItem
) {
    'use strict';

    var WORKER_ENDPOINT = '/rest/executor/worker',
        JOBS_ENDPOINT = '/rest/executor';

    var WorkerDialog = function(logger) {
        this.workerDict = {};
        this.workers = {};
        this.jobsDict = {};
        this.jobs = {};
        this.active = false;
        this.originManager = new JobOriginClient({
            logger: logger
        });
    };

    WorkerDialog.prototype.initialize = function() {
        this._dialog = $(WorkerHtml);
        this._table = this._dialog.find('.worker-list');
        this._jobContainer = this._dialog.find('.job-queue');
        this._isShowingJobs = true;
        this._queue = this._jobContainer.find('.job-queue-list');
        this._dialog.modal('show');
        this._dialog.on('hidden.bs.modal', () => this.active = false);
    };

    WorkerDialog.prototype.show = function() {
        this.active = true;
        this.update();
        this.initialize();
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
        var allJobIds = Object.keys(jobsDict),
            isVisible = false,
            id;

        this.jobsDict = jobsDict;
        for (var i = allJobIds.length; i--;) {
            id = allJobIds[i];
            if (this.jobs[id] || !this.isFinished(id)) {
                isVisible = this.updateJobItem(id) || isVisible;
            }
        }
        this.setJobQueueVisibility(isVisible);  // hide if no queue
    };

    WorkerDialog.prototype.setJobQueueVisibility = function(visible) {
        var visibility = visible ? 'inherit' : 'none';

        if (visible !== this._isShowingJobs) {
            this._jobContainer.css('display', visibility);
            this._isShowingJobs = visible;
        }
    };

    WorkerDialog.prototype.isFinished = function(jobId) {
        return this.jobsDict[jobId].status === 'FAILED_TO_EXECUTE' ||
            this.jobsDict[jobId].status === 'SUCCESS' ||
            this.jobsDict[jobId].status === 'CANCELED';
    };

    WorkerDialog.prototype.updateJobItemName = function(jobId) {
        return this.originManager.getOrigin(jobId)
            .then(info => {
                var job = this.jobs[jobId];
                if (job && this.active) {
                    var name = [
                        info.project.replace(/^guest\+/, ''),
                        info.execution,
                        info.job
                    ].join('/');

                    if (info.branch !== 'master') {
                        name += ' (' + info.branch + ')';
                    }
                    job.find('.job-id').text(name);
                    
                }
            });
    };

    WorkerDialog.prototype.updateJobItem = function(jobId) {
        var job = this.jobs[jobId] || $(WorkerJobItem),
            info = this.jobsDict[jobId],
            clazz = utils.ClassForJobStatus[info.status.toLowerCase()] || 'default';

        if (clazz.indexOf('job') === -1) {
            clazz = 'label-' + clazz;
        }

        job[0].className = `job-tag label ${clazz}`;

        if (!this.jobs[jobId]) {
            job.find('.job-id').text('Loading');
            this.updateJobItemName(jobId);
            this._queue.append(job);
            this.jobs[jobId] = job;
        }

        if (this.isFinished(jobId)) {
            job.remove();
            delete this.jobs[jobId];
            return false;
        }
        return true;
    };

    return WorkerDialog;
});
