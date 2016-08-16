/* globals define, WebGMEGlobal */
// Mixin for executing jobs and pipelines
define([
    'executor/ExecutorClient',
    'panel/FloatingActionButton/styles/Materialize'
], function(
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
            if (result) {
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

    Execute.prototype.stopJob = function(job) {
        var jobHash,
            jobId,
            secret;

        job = job || this.client.getNode(this._currentNodeId);
        jobId = job.getId();
        jobHash = job.getAttribute('jobId');
        secret = job.getAttribute('secret');
        if (!jobHash || !secret) {
            this.logger.error('Cannot stop job. Missing jobHash or secret');
            return;
        }

        this.client.delAttributes(jobId, 'jobId');
        this.client.delAttributes(jobId, 'secret');
        this.client.setAttributes(jobId, 'status', 'canceled');

        return this._executor.cancelJob(jobHash, secret)
            .then(() => this.logger.info(`${jobHash} has been cancelled!`))
            .fail(err => this.logger.error(`Job cancel failed: ${err}`));
    };

    return Execute;
});
