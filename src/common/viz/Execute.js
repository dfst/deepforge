/* globals define, WebGMEGlobal */
// Mixin for executing jobs and pipelines
define([
    'q',
    'executor/ExecutorClient',
    'panel/FloatingActionButton/styles/Materialize'
], function(
    Q,
    ExecutorClient,
    Materialize
) {

    var Execute = function(client, logger) {
        this.client = this.client || client;
        this.logger = this.logger || logger;
        this._executor = new ExecutorClient({
            logger: this.logger.fork('ExecutorClient'),
            serverPort: WebGMEGlobal.gmeConfig.server.port,
            httpsecure: window.location.protocol === 'https:'
        });
    };

    Execute.prototype.executeJob = function(node) {
        return this.runExecutionPlugin('ExecuteJob', {node: node});
    };

    Execute.prototype.executePipeline = function(node) {
        return this.runExecutionPlugin('ExecutePipeline', {node: node});
    };

    Execute.prototype.runExecutionPlugin = function(pluginId, opts) {
        var context = this.client.getCurrentPluginContext(pluginId),
            node = opts.node || this.client.getNode(this._currentNodeId),
            name = node.getAttribute('name'),
            method;

        // Set the activeNode
        context.managerConfig.namespace = 'pipeline';
        context.managerConfig.activeNode = node.getId();
        method = opts.useSecondary ? 'runBrowserPlugin' : 'runServerPlugin';
        this.client[method](pluginId, context, (err, result) => {
            var msg = err ? `${name} failed!` : `${name} executed successfully!`,
                duration = err ? 4000 : 2000;

            // Check if it was canceled - if so, show that type of message
            if (result && result.messages.length) {
                msg = result.messages[0].message;
                duration = 4000;
            }

            Materialize.toast(msg, duration);
        });
    };

    Execute.prototype.isRunning = function(node) {
        var baseId,
            base,
            type;

        node = node || this.client.getNode(this._currentNodeId);
        baseId = node.getBaseId();
        base = this.client.getNode(baseId);
        type = base.getAttribute('name');

        if (type === 'Execution') {
            return node.getAttribute('status') === 'running';
        } else if (type === 'Job') {
            return this.isRunningJob(node);
        }
        return false;
    };

    Execute.prototype.isRunningJob = function(job) {
        var status = job.getAttribute('status');

        return (status === 'running' || status === 'pending') &&
            job.getAttribute('secret') && job.getAttribute('jobId');
    };

    Execute.prototype.silentStopJob = function(job) {
        var jobHash,
            secret;

        job = job || this.client.getNode(this._currentNodeId);
        jobHash = job.getAttribute('jobId');
        secret = job.getAttribute('secret');
        if (!jobHash || !secret) {
            this.logger.error('Cannot stop job. Missing jobHash or secret');
            return;
        }

        return this._executor.cancelJob(jobHash, secret)
            .then(() => this.logger.info(`${jobHash} has been cancelled!`))
            .fail(err => this.logger.error(`Job cancel failed: ${err}`));
    };

    Execute.prototype.stopJob = function(job, silent) {
        var jobId;

        job = job || this.client.getNode(this._currentNodeId);
        jobId = job.getId();

        this.silentStopJob(job);

        if (!silent) {
            this.client.startTransaction(`Stopping "${name}" job`);
        }

        this.client.delAttributes(jobId, 'jobId');
        this.client.delAttributes(jobId, 'secret');
        this.client.setAttributes(jobId, 'status', 'canceled');

        if (!silent) {
            this.client.completeTransaction();
        }
    };


    Execute.prototype.loadChildren = function(id) {
        var deferred = Q.defer(),
            execNode = this.client.getNode(id || this._currentNodeId),
            jobIds = execNode.getChildrenIds(),
            jobsLoaded = !jobIds.length || this.client.getNode(jobIds[0]);

        // May need to load the jobs...
        if (!jobsLoaded) {
            // Create a territory and load the nodes
            var territory = {},
                ui;

            territory[id] = {children: 1};
            ui = this.client.addUI(this, () => {
                this.client.removeUI(ui);
                deferred.resolve();
            });
            this.client.updateTerritory(ui, territory);
        } else {
            deferred.resolve();
        }

        return deferred.promise;
    };

    Execute.prototype.stopExecution = function(id, inTransaction) {
        var execNode = this.client.getNode(id || this._currentNodeId);

        return this.loadChildren(id)
            .then(() => this._stopExecution(execNode, inTransaction));
    };

    Execute.prototype.silentStopExecution = function(id) {
        var execNode = this.client.getNode(id || this._currentNodeId);

        // Stop the execution w/o setting any attributes
        return this.loadChildren(id)
            .then(() => this._silentStopExecution(execNode));
    };

    Execute.prototype._stopExecution = function(execNode, inTransaction) {
        var msg = `Canceling ${execNode.getAttribute('name')} execution`;

        if (!inTransaction) {
            this.client.startTransaction(msg);
        }

        this._silentStopExecution(execNode);
        this.client.setAttributes(execNode.getId(), 'status', 'canceled');

        if (!inTransaction) {
            this.client.completeTransaction();
        }
    };

    Execute.prototype._silentStopExecution = function(execNode) {
        var jobIds = execNode.getChildrenIds();

        jobIds.map(id => this.client.getNode(id))
            .filter(job => this.isRunning(job))  // get running jobs
            .forEach(job => this.silentStopJob(job));  // stop them
    };

    return Execute;
});
