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
            return await queuedTask.promise;
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
            const result = await super.runTask(queuedTask.unwrap());
            this.tasks.shift();
            queuedTask.resolve(result);
            this.checkTaskQueue();
        }

        async kill(task) {
            const index = this.tasks
                .findIndex(queuedTask => queuedTask.unwrap() === task);

            if (index > 0) {
                this.tasks.splice(index, 1);
            } else {
                super.kill(task);
            }
        }

        static new(id, config) {
            return Session.new(id, config, SessionWithQueue);
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
