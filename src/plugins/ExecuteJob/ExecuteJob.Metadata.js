/*globals define*/
define([
    'deepforge/Constants'
], function(
    CONSTANTS
) {

    var ExecuteJob = function() {
        this._metadata = {};
        this._markForDeletion = {};  // id -> node
        this._oldMetadataByName = {};  // name -> id
        this.createdMetadataIds = {};
        this.createIdToMetadataId = {};
    };

    // TODO: Add tests
    ExecuteJob.prototype[CONSTANTS.PLOT_UPDATE] = async function (job, state) {
        const jobId = this.core.getPath(job);

        // Check if the graph already exists
        // use the id to look up the graph
        let id = jobId + '/' + state.id;
        let graph = this.getExistingMetadataById(job, 'Graph', id);
        if (!graph) {
            graph = this.core.createNode({
                base: this.META.Graph,
                parent: job
            });
            this.core.setAttribute(graph, 'id', id);
            this._metadata[id] = graph;
        }

        // Apply whatever updates are needed
        // Set the plot title
        // Only support a single axes for now
        const axes = state.axes[0];
        this.core.setAttribute(graph, 'name', axes.title);
        this.core.setAttribute(graph, 'xlabel', axes.xlabel);
        this.core.setAttribute(graph, 'ylabel', axes.ylabel);
        this.logger.info(`Updating graph named ${axes.title}`);

        const children = await this.core.loadChildren(graph);
        children.forEach(node => this.core.deleteNode(node));

        // Update the points for each of the lines 
        axes.lines.forEach((line, index) => {
            let node = this.core.createNode({
                base: this.META.Line,
                parent: graph,
            });

            this.core.setAttribute(node, 'name', line.label || `line ${index+1}`);
            let points = line.points.map(pts => pts.join(',')).join(';');
            this.core.setAttribute(node, 'points', points);
        });
    };

    ExecuteJob.prototype[CONSTANTS.IMAGE.BASIC] =
    ExecuteJob.prototype[CONSTANTS.IMAGE.UPDATE] =
    ExecuteJob.prototype[CONSTANTS.IMAGE.CREATE] = function (job, hash, imgId) {
        var name = Array.prototype.slice.call(arguments, 3).join(' '),
            imageNode = this._getImageNode(job, imgId, name);

        this.core.setAttribute(imageNode, 'data', hash);
    };

    ExecuteJob.prototype[CONSTANTS.IMAGE.NAME] = function (job, imgId) {
        var name = Array.prototype.slice.call(arguments, 2).join(' '),
            imageNode = this._getImageNode(job, imgId, name);

        this.core.setAttribute(imageNode, 'name', name);
    };

    ExecuteJob.prototype._getImageNode = function (job, imgId, name) {
        var jobId = this.core.getPath(job),
            id = jobId + '/IMAGE/' + imgId,
            imageNode = this._metadata[id];  // Look for the metadata imageNode

        if (!imageNode) {

            // Check if the imageNode already exists
            imageNode = this._getExistingMetadata(jobId, 'Image', name);
            if (!imageNode) {
                this.logger.info(`Creating image ${id} named ${name}`);
                imageNode = this.core.createNode({
                    base: this.META.Image,
                    parent: job,
                });
                this.core.setAttribute(imageNode, 'name', name);
            }
            this._metadata[id] = imageNode;
        }
        return imageNode;
    };

    ExecuteJob.prototype.recordOldMetadata = function (job) {
        var nodeId = this.core.getPath(job),
            id,
            idsToDelete = [],
            type,
            base,
            child,
            i;

        // If we are resuming the pipeline, we will not be deleting any metadata
        this.lastAppliedCmd[nodeId] = 0;
        this.createdMetadataIds[nodeId] = [];
        this._oldMetadataByName[nodeId] = {};
        this._markForDeletion[nodeId] = {};
        return this.core.loadChildren(job)
            .then(jobChildren => {
                // Remove any metadata nodes
                for (i = jobChildren.length; i--;) {
                    child = jobChildren[i];
                    if (this.isMetaTypeOf(child, this.META.Metadata)) {
                        id = this.core.getPath(child);
                        base = this.core.getBase(child);
                        type = this.core.getAttribute(base, 'name');

                        this._markForDeletion[nodeId][id] = child;
                        // namespace by metadata type
                        if (!this._oldMetadataByName[nodeId][type]) {
                            this._oldMetadataByName[nodeId][type] = [];
                        }

                        this._oldMetadataByName[nodeId][type].push(child);

                        // children of metadata nodes get deleted
                        idsToDelete = idsToDelete
                            .concat(this.core.getChildrenPaths(child));
                    }
                }

                // make the deletion ids relative to the job node
                this.logger.debug(`About to delete ${idsToDelete.length}: ${idsToDelete.join(', ')}`);
                for (i = idsToDelete.length; i--;) {
                    this.core.deleteNode(idsToDelete[i]);
                }
            });
    };

    ExecuteJob.prototype.clearOldMetadata = async function (job) {
        const nodeId = this.core.getPath(job);
        const node = await this.getOperation(job);

        if (!this.isLocalOperation(node)) {
            // Remove created nodes left over from resumed job
            this.createdMetadataIds[nodeId].forEach(id => delete this._markForDeletion[nodeId][id]);
            const nodeIds = Object.keys(this._markForDeletion[nodeId]);
            this.logger.debug(`About to delete ${nodeIds.length}: ${nodeIds.join(', ')}`);
            for (var i = nodeIds.length; i--;) {
                const node = this._markForDeletion[nodeId][nodeIds[i]];
                this.core.deleteNode(this.core.getPath(node));
            }
            delete this.lastAppliedCmd[nodeId];
            delete this.createdMetadataIds[nodeId];
            delete this._markForDeletion[nodeId];
        }

        this.core.delAttribute(job, 'jobInfo');
    };

    ExecuteJob.prototype.resultMsg = function(msg) {
        this.sendNotification(msg);
        this.createMessage(null, msg);
    };

    ExecuteJob.prototype.getExistingMetadataById = function (job, type, id) {
        if (this._metadata[id]) {
            return this._metadata[id];
        }

        return this._getExistingMetadata(  // exists from prev run
            this.core.getPath(job),
            type,
            node => this.core.getAttribute(node, 'id') === id
        );
    };

    ExecuteJob.prototype._getExistingMetadata = function (jobId, type, fn) {
        let oldMetadata = this._oldMetadataByName[jobId] && this._oldMetadataByName[jobId][type];

        const metadata = (oldMetadata || []).find(fn);
        if (metadata) {
            const id = this.core.getPath(metadata);

            delete this._markForDeletion[jobId][id];
            this.createdMetadataIds[jobId].push(id);  // used for resuming jobs
        }

        return metadata || null;
    };

    ExecuteJob.prototype.parseForMetadataCmds = function (job, lines, skip) {
        var jobId = this.core.getPath(job),
            args,
            result = [],
            cmdCnt = 0,
            ansiRegex = /\[\d+(;\d+)?m/g,
            hasMetadata = false,
            trimStartRegex = new RegExp(CONSTANTS.START_CMD + '.*'),
            matches,
            content,
            cmd;

        for (var i = 0; i < lines.length; i++) {
            // Check for a deepforge command
            if (lines[i].indexOf(CONSTANTS.START_CMD) !== -1) {
                matches = lines[i].replace(ansiRegex, '').match(trimStartRegex);
                for (var m = 0; m < matches.length; m++) {
                    cmdCnt++;
                    args = matches[m].split(/\s+/);
                    args.shift();
                    cmd = args[0];
                    content = matches[m].substring(matches[m].indexOf(cmd) + cmd.length);
                    args = [job, JSON.parse(content)];
                    if (this[cmd] && (!skip || cmdCnt >= this.lastAppliedCmd[jobId])) {
                        this[cmd].apply(this, args);
                        this.lastAppliedCmd[jobId]++;
                        hasMetadata = true;
                    } else if (!this[cmd]) {
                        this.logger.error(`Invoked unimplemented metadata method "${cmd}"`);
                    }
                }
            } else {
                result.push(lines[i]);
            }
        }
        return {
            stdout: result.join('\n'),
            hasMetadata: hasMetadata
        };
    };

    ExecuteJob.prototype.onNodeCreated = async function (tmpId, node) {
        const id = this.createIdToMetadataId[tmpId];
        delete this.createIdToMetadataId[tmpId];
        this._metadata[id] = node;
    };

    return ExecuteJob;
});
