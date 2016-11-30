/*globals define*/
define([
    'deepforge/Constants'
], function(
    CONSTANTS
) {

    var ExecuteJob = function() {
    };

    ExecuteJob.prototype[CONSTANTS.GRAPH_CREATE] = function (job, id) {
        var graph,
            name = Array.prototype.slice.call(arguments, 2).join(' '),
            jobId = this.core.getPath(job);

        id = jobId + '/' + id;
        this.logger.info(`Creating graph ${id} named ${name}`);

        // Check if the graph already exists
        graph = this._getExistingMetadata(jobId, 'Graph', name);
        if (!graph) {
            graph = this.createNode('Graph', job);

            if (name) {
                this.setAttribute(graph, 'name', name);
            }
            this.createIdToMetadataId[graph] = id;
        }

        this._metadata[id] = graph;
    };

    ExecuteJob.prototype[CONSTANTS.GRAPH_PLOT] = function (job, id, x, y) {
        var jobId = this.core.getPath(job),
            nonNum = /[^\d-\.]*/g,
            line,
            points;
            

        id = jobId + '/' + id;
        this.logger.info(`Adding point ${x}, ${y} to ${id}`);
        line = this._metadata[id];
        if (!line) {
            this.logger.warn(`Can't add point to non-existent line: ${id}`);
            return;
        }

        // Clean the points by removing and special characters
        x = x.replace(nonNum, '');
        y = y.replace(nonNum, '');
        points = this.getAttribute(line, 'points');
        points += `${x},${y};`;
        this.setAttribute(line, 'points', points);
    };

    ExecuteJob.prototype[CONSTANTS.GRAPH_CREATE_LINE] = function (job, graphId, id) {
        var jobId = this.core.getPath(job),
            graph = this._metadata[jobId + '/' + graphId],
            name = Array.prototype.slice.call(arguments, 3).join(' '),
            line;

        // Create a 'line' node in the given Graph metadata node
        name = name.replace(/\s+$/, '');
        line = this.createNode('Line', graph);
        this.setAttribute(line, 'name', name);
        this._metadata[jobId + '/' + id] = line;
        this.createIdToMetadataId[line] = jobId + '/' + id;
    };

    ExecuteJob.prototype[CONSTANTS.IMAGE.BASIC] =
    ExecuteJob.prototype[CONSTANTS.IMAGE.UPDATE] =
    ExecuteJob.prototype[CONSTANTS.IMAGE.CREATE] = function (job, hash, imgId) {
        var name = Array.prototype.slice.call(arguments, 3).join(' '),
            imageNode = this._getImageNode(job, imgId, name);

        this.setAttribute(imageNode, 'data', hash);
    };

    ExecuteJob.prototype[CONSTANTS.IMAGE.NAME] = function (job, imgId) {
        var name = Array.prototype.slice.call(arguments, 2).join(' '),
            imageNode = this._getImageNode(job, imgId, name);

        this.setAttribute(imageNode, 'name', name);
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
                imageNode = this.createNode('Image', job);
                this.setAttribute(imageNode, 'name', name);
                this.createIdToMetadataId[imageNode] = id;
            }
            this._metadata[id] = imageNode;
        }
        return imageNode;
    };

    ExecuteJob.prototype._getExistingMetadata = function (jobId, type, name) {
        var oldMetadata = this._oldMetadataByName[jobId] && this._oldMetadataByName[jobId][type],
            node,
            id;

        if (oldMetadata && oldMetadata[name]) {
            id = oldMetadata[name];
            node = this._markForDeletion[jobId][id];
            delete this._markForDeletion[jobId][id];
            this.createdMetadataIds[jobId].push(id);  // used for resuming jobs
        }

        return node || null;
    };

    return ExecuteJob;
});
