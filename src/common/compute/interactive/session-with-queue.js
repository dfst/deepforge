/* globals define*/
define([
    'deepforge/compute/interactive/session',
    'deepforge/compute/interactive/task',
    'deepforge/compute/interactive/message',
    'deepforge/compute/interactive/errors',
    'deepforge/utils',
], function(
    Session,
    Task,
    Message,
    Errors,
    utils,
) {
    const {defer} = utils;
    class SessionWithQueue extends Session {
        constructor(computeID, config, size=20) {
            super(computeID, config);
            this.size = size;
            this.tasks = [];
        }

        async runTask(task) {
            const queuedTask = this.queueTask(task);
            await queuedTask.promise;
        }

        queueTask(task) {
            const queuedTask = new QueuedTask(task);
            this.tasks.push(queuedTask);
            this.checkTaskQueue();
            return queuedTask;
        }

        async checkTaskQueue() {
            if (this.isIdle() && this.tasks.length) {
                this.runNextTask();
            }
        }

        ensureIdle(action) {
            if (action === 'run task') {
                super.ensureIdle(action);
            }
        }

        async runNextTask() {
            const queuedTask = this.tasks[0];
            await super.runTask(queuedTask.unwrap());
            this.tasks.shift();
            queuedTask.resolve();
            this.checkTaskQueue();
        }

        static async new(id, config) {
            return await Session.new(id, config, SessionWithQueue);
        }
    }

    class QueuedTask {
        constructor(task) {
            this.innerTask = task;
            const deferred = defer();
            this.promise = deferred.promise;
            this.resolve = deferred.resolve;
            this.reject = deferred.reject;
        }

        unwrap() {
            return this.innerTask;
        }
    }

    return SessionWithQueue;
});
