/*globals define*/
/*jshint node:true, browser:true*/

define([
    'common/util/assert',
    'common/storage/constants',
    'text!./metadata.json',
    'executor/ExecutorClient',
    'plugin/PluginBase',
    'deepforge/plugin/LocalExecutor',
    'deepforge/plugin/PtrCodeGen',
    'deepforge/JobLogsClient',
    'deepforge/Constants',
    'deepforge/utils',
    './templates/index',
    'q',
    'underscore'
], function (
    assert,
    STORAGE_CONSTANTS,
    pluginMetadata,
    ExecutorClient,
    PluginBase,
    LocalExecutor,  // DeepForge operation primitives
    PtrCodeGen,
    JobLogsClient,
    CONSTANTS,
    utils,
    Templates,
    Q,
    _
) {
    'use strict';

    pluginMetadata = JSON.parse(pluginMetadata);

    var OUTPUT_INTERVAL = 1500,
        STDOUT_FILE = 'job_stdout.txt',
        CREATE_PREFIX = 'created_node_',
        INDEX = 1;

    /**
     * Initializes a new instance of ExecuteJob.
     * @class
     * @augments {PluginBase}
     * @classdesc This class represents the plugin ExecuteJob.
     * @constructor
     */
    var ExecuteJob = function () {
        // Call base class' constructor.
        PluginBase.call(this);
        this.pluginMetadata = pluginMetadata;
        this._metadata = {};

        // Metadata updating
        this._markForDeletion = {};  // id -> node
        this._oldMetadataByName = {};  // name -> id
        this.lastAppliedCmd = {};
        this.canceled = false;
        this.changes = {};
        this.creations = {};
        this.deletions = [];
        this.createIdToMetadataId = {};
        this.logManager = null;
    };

    /**
     * Metadata associated with the plugin. Contains id, name, version, description, icon, configStructue etc.
     * This is also available at the instance at this.pluginMetadata.
     * @type {object}
     */
    ExecuteJob.metadata = pluginMetadata;
    ExecuteJob.UPDATE_INTERVAL = 1500;

    // Prototypical inheritance from PluginBase.
    ExecuteJob.prototype = Object.create(PluginBase.prototype);
    ExecuteJob.prototype.constructor = ExecuteJob;

    /**
     * Main function for the plugin to execute. This will perform the execution.
     * Notes:
     * - Always log with the provided logger.[error,warning,info,debug].
     * - Do NOT put any user interaction logic UI, etc. inside this method.
     * - callback always has to be called even if error happened.
     *
     * @param {function(string, plugin.PluginResult)} callback - the result callback
     */
    ExecuteJob.prototype.main = function (callback) {
        // Check the activeNode to make sure it is a valid node
        var type = this.core.getMetaType(this.activeNode),
            typeName = type && this.getAttribute(type, 'name');

        if (typeName !== 'Job') {
            return callback(`Cannot execute ${typeName} (expected Job)`, this.result);
        }

        // Get the gmeConfig...
        this.logManager = new JobLogsClient({
            logger: this.logger,
            port: this.gmeConfig.server.port,
            branchName: this.branchName,
            projectId: this.projectId
        });
        this._callback = callback;
        this.currentForkName = null;
        this.prepare()
            .then(() => this.executeJob(this.activeNode));
    };

    ExecuteJob.prototype.updateForkName = function (basename) {
        basename = basename + '_fork';
        basename = basename.replace(/[- ]/g, '_');
        return this.project.getBranches().then(branches => {
            var names = Object.keys(branches),
                name = basename,
                i = 2;

            while (names.indexOf(name) !== -1) {
                name = basename + '_' + i;
                i++;
            }

            this.forkName = name;
        });
    };

    //////////////////////////// Safe Save ////////////////////////////
    ExecuteJob.prototype.getCreateId = function () {
        return CREATE_PREFIX + (++INDEX);
    };

    ExecuteJob.prototype.isCreateId = function (id) {
        return (typeof id === 'string') && (id.indexOf(CREATE_PREFIX) === 0);
    };

    ExecuteJob.prototype.createNode = function (baseType, parent) {
        var id = this.getCreateId(),
            parentId;

        if (this.isCreateId(parent)) {
            parentId = parent;
        } else {
            parentId = this.core.getPath(parent);
        }

        this.logger.info(`Creating ${id} of type ${baseType} in ${parentId}`);
        assert(this.META[baseType], `Cannot create node w/ unrecognized type: ${baseType}`);
        this.creations[id] = {
            base: baseType,
            parent: parentId
        };
        return id;
    };

    ExecuteJob.prototype.deleteNode = function (nodeId) {
        this.deletions.push(nodeId);
    };

    ExecuteJob.prototype.delAttribute = function (node, attr) {
        return this.setAttribute(node, attr, null);
    };

    ExecuteJob.prototype.setAttribute = function (node, attr, value) {
        var nodeId;

        if (this.isCreateId(node)) {
            nodeId = node;
        } else {
            nodeId = this.core.getPath(node);
            assert(typeof nodeId === 'string', `Cannot set attribute of ${nodeId}`);
        }

        if (value !== null) {
            this.logger.info(`Setting ${attr} of ${nodeId} to ${value}`);
        } else {
            this.logger.info(`Deleting ${attr} of ${nodeId}`);
        }

        if (!this.changes[nodeId]) {
            this.changes[nodeId] = {};
        }
        this.changes[nodeId][attr] = value;
    };

    ExecuteJob.prototype.getAttribute = function (node, attr) {
        var nodeId,
            base;

        assert(this.deletions.indexOf(nodeId) === -1,
            `Cannot get ${attr} from deleted node ${nodeId}`);

        // Check if it was newly created
        if (this.isCreateId(node)) {
            nodeId = node;
            assert(this.creations[nodeId], `Creation node not updated: ${nodeId}`);

            // Set the node to the base so it falls back to an
            // existing node if the attr info isn't in the diff
            node = this.META[this.creations[nodeId].base];
        } else {
            nodeId = this.core.getPath(node);
        }

        // Check the changes; fallback on actual node
        if (this.changes[nodeId] && this.changes[nodeId][attr] !== undefined) {
            // If deleted the attribute, get the default (inherited) value
            if (this.changes[nodeId][attr] === null) {
                base = this.core.getBase(node);
                return this.getAttribute(base, attr);
            }
            return this.changes[nodeId][attr];
        }

        return this.core.getAttribute(node, attr);
    };

    ExecuteJob.prototype._applyNodeChanges = function (node, changes) {
        var attr,
            value;

        this.logger.info(`About to apply changes for ${this.core.getPath(node)}`);
        for (var i = changes.length; i--;) {
            attr = changes[i][0];
            value = changes[i][1];
            if (value !== null) {
                this.core.setAttribute(node, attr, value);
            } else {
                this.core.delAttribute(node, attr);
            }
        }
        return node;
    };

    ExecuteJob.prototype.applyModelChanges = function () {
        return this.applyCreations()
            .then(() => this.applyChanges())
            .then(() => this.applyDeletions());
    };

    ExecuteJob.prototype.applyChanges = function () {
        var nodeIds = Object.keys(this.changes),
            attrs,
            value,
            changes,
            promises = [],
            changesFor = {},
            id,
            promise;

        this.logger.info('Collecting changes to apply in commit');
        for (var i = nodeIds.length; i--;) {
            changes = [];
            attrs = Object.keys(this.changes[nodeIds[i]]);
            for (var a = attrs.length; a--;) {
                value = this.changes[nodeIds[i]][attrs[a]];
                changes.push([attrs[a], value]);
            }
            changesFor[nodeIds[i]] = changes;

            assert(changes, `changes are invalid for ${nodeIds[i]}: ${changes}`);
            assert(!this.isCreateId(nodeIds[i]),
                `Creation id not resolved to actual id: ${nodeIds[i]}`);
            promise = this.core.loadByPath(this.rootNode, nodeIds[i]);
            promises.push(promise);
        }

        this.changes = {};
        this.logger.info(`About to apply changes for ${promises.length} nodes`);
        return Q.all(promises)
            .then(nodes => {
                for (var i = nodes.length; i--;) {
                    id = this.core.getPath(nodes[i]);
                    assert(nodes[i], `node is ${nodes[i]} (${nodeIds[i]})`);
                    this._applyNodeChanges(nodes[i], changesFor[id]);
                }
            });
    };

    ExecuteJob.prototype.applyCreations = function () {
        var nodeIds = Object.keys(this.creations),
            tiers = this.createCreationTiers(nodeIds),
            creations = this.creations,
            newIds = {},
            promise = Q(),
            tier;

        this.logger.info('Applying node creations');
        for (var i = 0; i < tiers.length; i++) {
            tier = tiers[i];
            // Chain the promises, loading each tier sequentially
            promise = promise.then(this.applyCreationTier.bind(this, creations, newIds, tier));
        }

        this.creations = {};
        return promise;
    };

    ExecuteJob.prototype.applyCreationTier = function (creations, newIds, tier) {
        var promises = [],
            parentId,
            node;

        for (var j = tier.length; j--;) {
            node = creations[tier[j]];
            assert(node, `Could not find create info for ${tier[j]}`);
            parentId = newIds[node.parent] || node.parent;
            promises.push(this.applyCreation(tier[j], node.base, parentId));
        }
        return Q.all(promises).then(nodes => {
            // Record the newIds so they can be used to resolve creation ids
            // in subsequent tiers
            for (var i = tier.length; i--;) {
                newIds[tier[i]] = this.core.getPath(nodes[i]);
            }
        });
    };

    // Figure out the dependencies between nodes to create.
    // eg, if newId1 is to be created in newId2, then newId2 will
    // be in an earlier tier than newId1. Essentially a topo-sort
    // on a tree structure
    ExecuteJob.prototype.createCreationTiers = function (nodeIds) {
        var tiers = [],
            prevTier = {},
            tier = {},
            id,
            prevLen,
            i;

        // Create first tier (created inside existing nodes)
        for (i = nodeIds.length; i--;) {
            id = nodeIds[i];
            if (!this.isCreateId(this.creations[id].parent)) {
                tier[id] = true;
                nodeIds.splice(i, 1);
            }
        }
        prevTier = tier;
        tiers.push(Object.keys(tier));

        // Now, each tier consists of the nodes to be created inside a
        // node from the previous tier
        while (nodeIds.length) {
            prevLen = nodeIds.length;
            tier = {};
            for (i = nodeIds.length; i--;) {
                id = nodeIds[i];
                if (prevTier[this.creations[id].parent]) {
                    tier[id] = true;
                    nodeIds.splice(i, 1);
                }
            }
            prevTier = tier;
            tiers.push(Object.keys(tier));
            // Every iteration should find at least one node
            assert(prevLen > nodeIds.length,
                `Created empty create tier! Remaining: ${nodeIds.join(', ')}`);
        }

        return tiers;
    };

    ExecuteJob.prototype.applyCreation = function (tmpId, baseType, parentId) {
        var base = this.META[baseType],
            nodeId,
            id;

        this.logger.info(`Applying creation of ${tmpId} (${baseType}) in ${parentId}`);

        assert(!this.isCreateId(parentId),
            `Did not resolve parent id: ${parentId} for ${tmpId}`);
        assert(base, `Invalid base type: ${baseType}`);
        return this.core.loadByPath(this.rootNode, parentId)
            .then(parent => this.core.createNode({base, parent}))
            .then(node => {  // Update the _metadata records
                id = this.createIdToMetadataId[tmpId];
                delete this.createIdToMetadataId[tmpId];
                this._metadata[id] = node;

                // Update creations
                nodeId = this.core.getPath(node);
                if (this.changes[tmpId]) {
                    assert(!this.changes[nodeId],
                        `Newly created node cannot already have changes! (${nodeId})`);
                    this.changes[nodeId] = this.changes[tmpId];
                    delete this.changes[tmpId];
                }
                return node;
            });
    };

    ExecuteJob.prototype.applyDeletions = function () {
        var deletions = this.deletions;

        this.deletions = [];
        return Q.all(deletions.map(id => this.core.loadByPath(this.rootNode, id)))
            .then(nodes => {
                for (var i = nodes.length; i--;) {
                    this.core.deleteNode(nodes[i]);
                }
            });
    };

    // Override 'save' to notify the user on fork
    ExecuteJob.prototype.save = function (msg) {
        var name = this.getAttribute(this.activeNode, 'name');

        return this.updateForkName(name)
            .then(() => this.applyModelChanges())
            .then(() => PluginBase.prototype.save.call(this, msg))
            .then(result => {
                this.logger.info(`Save finished w/ status: ${result.status}`);
                if (result.status === STORAGE_CONSTANTS.FORKED) {
                    msg = `"${name}" execution has forked to "${result.forkName}"`;
                    this.currentForkName = result.forkName;
                    this.logManager.fork(result.forkName);
                    this.sendNotification(msg);
                } else if (result.status === STORAGE_CONSTANTS.MERGED) {
                    this.logger.debug('Merged changes. About to update plugin nodes');
                    return this.updateNodes();
                }
            });
    };

    ExecuteJob.prototype.updateNodes = function (hash) {
        var activeId = this.core.getPath(this.activeNode);

        hash = hash || this.currentHash;
        return Q.ninvoke(this.project, 'loadObject', hash)
            .then(commitObject => {
                return this.core.loadRoot(commitObject.root);
            })
            .then(rootObject => {
                this.rootNode = rootObject;
                return this.core.loadByPath(rootObject,activeId);
            })
            .then(activeObject => this.activeNode = activeObject)
            .then(() => {
                var metaNames = Object.keys(this.META);
                return Q.all(metaNames.map(name => this.updateMetaNode(name)));
            });
    };

    ExecuteJob.prototype.updateMetaNode = function (name) {
        var id = this.core.getPath(this.META[name]);
        return this.core.loadByPath(this.rootNode, id).then(node => this.META[name] = node);
    };

    //////////////////////////// END Safe Save ////////////////////////////

    ExecuteJob.prototype.getConnections = function (nodes) {
        var conns = [];
        for (var i = nodes.length; i--;) {
            if (this.core.getPointerPath(nodes[i], 'src') &&
                this.core.getPointerPath(nodes[i], 'dst')) {

                conns.push(nodes[i]);
            }
        }
        return conns;
    };

    ExecuteJob.prototype.prepare = function () {
        var dstPortId,
            srcPortId,
            conns,
            executionNode = this.core.getParent(this.activeNode);

        this.pipelineName = this.getAttribute(executionNode, 'name');
        return this.core.loadSubTree(executionNode)
            .then(nodes => {
                this.inputPortsFor = {};
                this.outputLineCount = {};

                conns = this.getConnections(nodes);

                // Create inputPortsFor for the given input ports
                for (var i = conns.length; i--;) {
                    dstPortId = this.core.getPointerPath(conns[i], 'dst');
                    srcPortId = this.core.getPointerPath(conns[i], 'src');

                    if (!this.inputPortsFor[dstPortId]) {
                        this.inputPortsFor[dstPortId] = [srcPortId];
                    } else {
                        this.inputPortsFor[dstPortId].push(srcPortId);
                    }
                }
            })
            .then(() => this.recordOldMetadata(this.activeNode));
    };

    ExecuteJob.prototype.recordOldMetadata = function (job) {
        var nodeId = this.core.getPath(job),
            name,
            id,
            idsToDelete = [],
            type,
            base,
            child,
            i;

        this.lastAppliedCmd[nodeId] = 0;
        this._oldMetadataByName[nodeId] = {};
        this._markForDeletion[nodeId] = {};
        return this.core.loadChildren(job)
            .then(jobChildren => {
                // Remove any metadata nodes
                for (i = jobChildren.length; i--;) {
                    child = jobChildren[i];
                    if (this.isMetaTypeOf(child, this.META.Metadata)) {
                        id = this.core.getPath(child);
                        name = this.getAttribute(child, 'name');
                        base = this.core.getBase(child);
                        type = this.getAttribute(base, 'name');

                        this._markForDeletion[nodeId][id] = child;
                        // namespace by metadata type
                        if (!this._oldMetadataByName[nodeId][type]) {
                            this._oldMetadataByName[nodeId][type] = {};
                        }

                        this._oldMetadataByName[nodeId][type][name] = id;

                        // children of metadata nodes get deleted
                        idsToDelete = idsToDelete
                            .concat(this.core.getChildrenPaths(child));
                    }
                }

                // make the deletion ids relative to the job node
                this.logger.debug(`About to delete ${idsToDelete.length}: ${idsToDelete.join(', ')}`);
                for (i = idsToDelete.length; i--;) {
                    this.deleteNode(idsToDelete[i]);
                }
            });
    };

    ExecuteJob.prototype.clearOldMetadata = function (job) {
        var nodeId = this.core.getPath(job),
            nodeIds = Object.keys(this._markForDeletion[nodeId]),
            node;

        this.logger.debug(`About to delete ${nodeIds.length}: ${nodeIds.join(', ')}`);
        for (var i = nodeIds.length; i--;) {
            node = this._markForDeletion[nodeId][nodeIds[i]];
            this.deleteNode(this.core.getPath(node));
        }
        delete this.lastAppliedCmd[nodeId];
        delete this._markForDeletion[nodeId];

        this.delAttribute(job, 'jobId');
        this.delAttribute(job, 'secret');
    };

    ExecuteJob.prototype.resultMsg = function(msg) {
        this.sendNotification(msg);
        this.createMessage(null, msg);
    };

    ExecuteJob.prototype.onOperationCanceled = function(op) {
        var job = this.core.getParent(op),
            name = this.getAttribute(op, 'name'),
            msg = `"${name}" canceled!`;

        this.setAttribute(job, 'status', 'canceled');
        this.resultMsg(msg);
        this.onComplete(op, null);
    };

    ExecuteJob.prototype.onOperationFail =
    ExecuteJob.prototype.onOperationComplete =
    ExecuteJob.prototype.onComplete = function (opNode, err) {
        var job = this.core.getParent(opNode),
            exec = this.core.getParent(job),
            name = this.getAttribute(job, 'name'),
            jobId = this.core.getPath(job),
            status = err ? 'fail' : (this.canceled ? 'canceled' : 'success'),
            msg = err ? `${name} execution failed!` :
                `${name} executed successfully!`,
            promise = Q();

        this.setAttribute(job, 'status', status);
        this.logger.info(`Setting ${name} (${jobId}) status to ${status}`);
        this.clearOldMetadata(job);

        if (this.currentForkName) {
            // notify client that the job has completed
            this.sendNotification(`"${name}" execution completed on branch "${this.currentForkName}"`);
        }
        if (err) {
            this.logger.warn(`${name} failed: ${err}`);
            this.setAttribute(exec, 'status', 'failed');
        } else if (this.canceled) {
            // Should I set this to 'canceled'?
            this.setAttribute(exec, 'status', 'canceled');
        } else {
            // Check if all the other jobs are successful. If so, set the
            // execution status to 'success'
            promise = this.core.loadChildren(exec)
                .then(nodes => {
                    var execSuccess = true,
                        type,
                        typeName;

                    for (var i = nodes.length; i--;) {
                        type = this.core.getMetaType(nodes[i]);
                        typeName = this.getAttribute(type, 'name');

                        if (typeName === 'Job' &&
                            this.getAttribute(nodes[i], 'status') !== 'success') {
                            execSuccess = false;
                        }
                    }

                    if (execSuccess) {
                        this.setAttribute(exec, 'status', 'success');
                    }
                });
        }

        this.createMessage(null, msg);
        promise
            .then(() => this.save(msg))
            .then(() => {
                this.result.setSuccess(!err);
                this._callback(err, this.result);
            })
            .catch(err => {
                // Result success is false at invocation.
                this._callback(err, this.result);
            });
    };

    ExecuteJob.prototype.getOperation = function (job) {
        return this.core.loadChildren(job).then(children =>
            children.find(child => this.isMetaTypeOf(child, this.META.Operation)));
    };

    ExecuteJob.prototype.onBlobRetrievalFail = function (node, input, err) {
        var job = this.core.getParent(node),
            e = `Failed to retrieve "${input}" (${err})`,
            consoleErr = `[0;31mFailed to execute operation: ${e}[0m`;

        consoleErr += [
            '\n\nA couple things to check out:\n',
            '- Has the location of DeepForge\'s blob changed?',
            '    (Configurable using "blob.dir" in the deepforge config' +
            ' or setting the DEEPFORGE_BLOB_DIR environment variable)\n',

            '- Was this project created using a different blob location?'
        ].join('\n    ');

        this.setAttribute(job, 'stdout', consoleErr);
        this.onOperationFail(node, `Blob retrieval failed for "${name}": ${e}`);
    };

    ExecuteJob.prototype.executeJob = function (job) {
        return this.getOperation(job).then(node => {
            var jobId = this.core.getPath(job),
                name = this.getAttribute(node, 'name'),
                localTypeId = this.getLocalOperationType(node),
                artifact,
                artifactName,
                files,
                data = {},
                inputs;

            // Execute any special operation types here - not on an executor
            this.logger.debug(`Executing operation "${name}"`);
            if (localTypeId !== null) {
                return this.executeLocalOperation(localTypeId, node);
            } else {
                // Generate all execution files
                return this.createOperationFiles(node).then(results => {
                    this.logger.info('Created operation files!');
                    files = results;
                    artifactName = `${name}_${jobId.replace(/\//g, '_')}-execution-files`;
                    artifact = this.blobClient.createArtifact(artifactName);

                    // Add the input assets
                    //   - get the metadata (name)
                    //   - add the given inputs
                    inputs = Object.keys(files.inputAssets);

                    return Q.all(
                        inputs.map(input => {  // Get the metadata for each input
                            var hash = files.inputAssets[input];

                            // data asset for "input"
                            return this.blobClient.getMetadata(hash)
                                .fail(err => this.onBlobRetrievalFail(job, input, err));
                        })
                    );
                })
                .then(mds => {
                    // Record the large files
                    var inputData = {};
                    mds.forEach((metadata, i) => {
                        // add the hashes for each input
                        var input = inputs[i], 
                            hash = files.inputAssets[input];

                        inputData['inputs/' + input + '/data'] = {
                            req: hash,
                            cache: metadata.content
                        };
                    });

                    delete files.inputAssets;
                    files['input-data.json'] = JSON.stringify(inputData, null, 2);

                    // Add pointer assets
                    Object.keys(files.ptrAssets)
                        .forEach(path => data[path] = files.ptrAssets[path]);

                    // Add the executor config
                    return this.getOutputs(node);
                })
                .then(outputArgs => {
                    var config,
                        outputs,
                        fileList,
                        ptrFiles = Object.keys(files.ptrAssets),
                        file;

                    files['start.js'] = _.template(Templates.START)(CONSTANTS);
                    delete files.ptrAssets;
                    fileList = Object.keys(files).concat(ptrFiles);

                    outputs = outputArgs.map(pair => pair[0])
                        .map(name => {
                            return {
                                name: name,
                                resultPatterns: [`outputs/${name}`]
                            };
                        });

                    outputs.push(
                        {
                            name: 'stdout',
                            resultPatterns: [STDOUT_FILE]
                        },
                        {
                            name: name + '-all-files',
                            resultPatterns: fileList
                        }
                    );

                    config = {
                        cmd: 'node',
                        args: ['start.js'],
                        outputInterval: OUTPUT_INTERVAL,
                        resultArtifacts: outputs
                    };
                    files['executor_config.json'] = JSON.stringify(config, null, 4);

                    // Save the artifact
                    // Remove empty hashes
                    for (file in data) {
                        if (!data[file]) {
                            this.logger.warn(`Empty data hash has been found for file "${file}". Removing it...`);
                            delete data[file];
                        }
                    }
                    return artifact.addObjectHashes(data);
                })
                .then(() => {
                    this.logger.info(`Added ptr/input data hashes for "${artifactName}"`);
                    return artifact.addFiles(files);
                })
                .then(() => {
                    this.logger.info(`Added execution files for "${artifactName}"`);
                    return artifact.save();
                })
                .then(hash => {
                    this.logger.info(`Saved execution files "${artifactName}"`);
                    this.result.addArtifact(hash);  // Probably only need this for debugging...
                    this.executeDistOperation(job, node, hash);
                })
                .fail(e => {
                    this.onOperationFail(node, `Distributed operation "${name}" failed ${e}`);
                });
            }
        });
    };

    ExecuteJob.prototype.executeDistOperation = function (job, opNode, hash) {
        var name = this.getAttribute(opNode, 'name'),
            jobId = this.core.getPath(job),
            isHttps = typeof window === 'undefined' ? false :
                window.location.protocol !== 'http:',
            executor = new ExecutorClient({
                logger: this.logger,
                serverPort: this.gmeConfig.server.port,
                httpsecure: isHttps
            });

        this.logger.info(`Executing operation "${name}"`);

        this.outputLineCount[jobId] = 0;
        // Set the job status to 'running'
        this.setAttribute(job, 'status', 'queued');
        this.delAttribute(job, 'stdout');
        this.logManager.deleteLog(jobId);
        this.logger.info(`Setting ${jobId} status to "queued" (${this.currentHash})`);
        this.logger.debug(`Making a commit from ${this.currentHash}`);
        this.save(`Queued "${name}" operation in ${this.pipelineName}`)
            .then(() => executor.createJob({hash}))
            .then(info => {
                this.setAttribute(job, 'jobId', info.hash);
                if (info.secret) {  // o.w. it is a cached job!
                    this.setAttribute(job, 'secret', info.secret);
                }
                return this.watchOperation(executor, hash, opNode, job);
            })
            .catch(err => this.logger.error(`Could not execute "${name}": ${err}`));

    };

    ExecuteJob.prototype.createOperationFiles = function (node) {
        var files = {};
        // For each operation, generate the output files:
        //   inputs/<arg-name>/init.lua  (respective data deserializer)
        //   pointers/<name>/init.lua  (result of running the main plugin on pointer target - may need a rename)
        //   outputs/<name>/  (make dirs for each of the outputs)
        //   outputs/init.lua  (serializers for data outputs)
        //
        //   attributes.lua (returns lua table of operation attributes)
        //   init.lua (main file -> calls main and serializes outputs)
        //   <name>.lua (entry point -> calls main operation code)

        // add the given files
        this.logger.info('About to create dist execution files');
        return this.createEntryFile(node, files)
            .then(() => this.createClasses(node, files))
            .then(() => this.createCustomLayers(node, files))
            .then(() => this.createInputs(node, files))
            .then(() => this.createOutputs(node, files))
            .then(() => this.createMainFile(node, files))
            .then(() => {
                this.createAttributeFile(node, files);
                return Q.ninvoke(this, 'createPointers', node, files);
            });
    };

    ExecuteJob.prototype.createEntryFile = function (node, files) {
        this.logger.info('Creating entry files...');
        return this.getOutputs(node)
            .then(outputs => {
                var name = this.getAttribute(node, 'name'),
                    content = {};

                // inputs and outputs
                content.name = name;
                content.outputs = outputs;

                files['init.lua'] = _.template(Templates.ENTRY)(content);

                // Create the deepforge file
                files['deepforge.lua'] = _.template(Templates.DEEPFORGE)(CONSTANTS);
            });
    };

    ExecuteJob.prototype.createClasses = function (node, files) {
        var metaDict = this.core.getAllMetaNodes(this.rootNode),
            isClass,
            metanodes,
            classNodes,
            inheritanceLvl = {},
            code;

        this.logger.info('Creating custom layer file...');
        metanodes = Object.keys(metaDict).map(id => metaDict[id]);
        isClass = this.getTypeDictFor('Complex', metanodes);

        classNodes = metanodes.filter(node => {
            var base = this.core.getBase(node),
                baseId = this.core.getPath(base),
                count = 1;

            // Count the sets back to a class node
            while (base) {
                if (isClass[baseId]) {
                    inheritanceLvl[this.core.getPath(node)] = count;
                    return true;
                }
                base = this.core.getBase(base);
                baseId = this.core.getPath(base);
                count++;
            }

            return false;
        });

        // Get the code definitions for each
        // Sort by levels of inheritance...
        code = classNodes.sort((a, b) => {
            var aId = this.core.getPath(a),
                bId = this.core.getPath(b);

            return inheritanceLvl[aId] > inheritanceLvl[bId];
        }).map(node =>
            `require './${this.getAttribute(node, 'name')}.lua'`
        ).join('\n');

        // Create the class files
        classNodes.forEach(node => {
            var name = this.getAttribute(node, 'name');
            files[`classes/${name}.lua`] = this.getAttribute(node, 'code');
        });

        // Create the custom layers file
        files['classes/init.lua'] = code;
    };

    ExecuteJob.prototype.getTypeDictFor = function (name, metanodes) {
        var isType = {};
        // Get all the custom layers
        for (var i = metanodes.length; i--;) {
            if (this.getAttribute(metanodes[i], 'name') === name) {
                isType[this.core.getPath(metanodes[i])] = true;
            }
        }
        return isType;
    };

    ExecuteJob.prototype.createCustomLayers = function (node, files) {
        var metaDict = this.core.getAllMetaNodes(this.rootNode),
            isCustomLayer,
            metanodes,
            customLayers,
            code;

        this.logger.info('Creating custom layer file...');
        metanodes = Object.keys(metaDict).map(id => metaDict[id]);
        isCustomLayer = this.getTypeDictFor('CustomLayer', metanodes);

        customLayers = metanodes.filter(node =>
            this.core.getMixinPaths(node).some(id => isCustomLayer[id]));

        // Get the code definitions for each
        code = 'require \'nn\'\n\n' + customLayers
            .map(node => this.getAttribute(node, 'code')).join('\n');

        // Create the custom layers file
        files['custom-layers.lua'] = code;
    };

    ExecuteJob.prototype.createInputs = function (node, files) {
        var tplContents,
            inputs;

        this.logger.info('Retrieving inputs and deserialize fns...');
        return this.getInputs(node)
            .then(allInputs => {
                // For each input, match the connection with the input name
                //   [ name, type ] => [ name, type, node ]
                //
                // For each input,
                //  - create the deserializer
                //  - put it in inputs/<name>/init.lua
                //  - copy the data asset to /inputs/<name>/init.lua
                inputs = allInputs
                    .filter(pair => !!this.getAttribute(pair[2], 'data'));  // remove empty inputs

                files.inputAssets = {};  // data assets
                return Q.all(inputs.map(pair => {
                    var name = pair[0],
                        node = pair[2],
                        nodeId = this.core.getPath(node),
                        fromNodeId;

                    // Get the deserialize function. First, try to get it from
                    // the source method (this guarantees that the correct
                    // deserialize method is used despite any auto-upcasting
                    fromNodeId = this.inputPortsFor[nodeId][0] || nodeId;

                    return this.core.loadByPath(this.rootNode, fromNodeId)
                        .then(fromNode => {
                            var deserFn,
                                base,
                                className;

                            deserFn = this.getAttribute(fromNode, 'deserialize');

                            if (this.isMetaTypeOf(node, this.META.Complex)) {
                                // Complex objects are expected to define their own
                                // (static) deserialize factory method
                                base = this.core.getMetaType(node);
                                className = this.getAttribute(base, 'name');
                                deserFn = `return ${className}.deserialize(path)`;
                            }

                            return {
                                name: name,
                                code: deserFn
                            };
                        });
                }));
            })
            .then(_tplContents => {
                tplContents = _tplContents;
                var hashes = inputs.map(pair => {
                    var hash = this.getAttribute(pair[2], 'data');
                    files.inputAssets[pair[0]] = hash;
                    return {
                        hash: hash,
                        name: pair[0]
                    };
                });

                return Q.all(hashes.map(pair => 
                    this.blobClient.getMetadata(pair.hash)
                        .fail(err => this.onBlobRetrievalFail(node, pair.name, err))));
            })
            .then(metadatas => {
                // Create the deserializer
                tplContents.forEach((ctnt, i) => {
                    // Get the name of the given asset
                    ctnt.filename = metadatas[i].name;
                    files['inputs/' + ctnt.name + '/init.lua'] = _.template(Templates.DESERIALIZE)(ctnt);
                });
                return files;
            });
    };

    ExecuteJob.prototype.createOutputs = function (node, files) {
        // For each of the output types, grab their serialization functions and
        // create the `outputs/init.lua` file
        this.logger.info('Creating outputs/init.lua...');
        return this.getOutputs(node)
            .then(outputs => {
                var outputTypes = outputs
                // Get the serialize functions for each
                    .map(tuple => {
                        var node = tuple[2],
                            serFn = this.getAttribute(node, 'serialize');

                        if (this.isMetaTypeOf(node, this.META.Complex)) {
                            // Complex objects are expected to define their own
                            // serialize methods
                            serFn = 'if data ~= nil then data:serialize(path) end';
                        }

                        return [tuple[1], serFn];
                    });

                files['outputs/init.lua'] = _.template(Templates.SERIALIZE)({types: outputTypes});
            });
    };

    ExecuteJob.prototype.createMainFile = function (node, files) {
        this.logger.info('Creating main file...');
        return this.getInputs(node)
            .then(inputs => {
                var name = this.getAttribute(node, 'name'),
                    code = this.getAttribute(node, 'code'),
                    pointers = this.core.getPointerNames(node).filter(ptr => ptr !== 'base'),
                    content = {
                        name: name
                    };

                // Get input data arguments
                content.inputs = inputs
                    .map(pair => [pair[0], !this.getAttribute(pair[2], 'data')]);  // remove empty inputs

                // Defined variables for each pointers
                content.pointers = pointers
                    .map(id => [id, this.core.getPointerPath(node, id) === null]);

                // Add remaining code
                content.code = code;

                files['main.lua'] = _.template(Templates.MAIN)(content);

                // Set the line offset
                var lineOffset = this.getLineOffset(files['main.lua'], code);
                this.setAttribute(node, CONSTANTS.LINE_OFFSET, lineOffset);
            });
    };

    ExecuteJob.prototype.getLineOffset = function (main, snippet) {
        var i = main.indexOf(snippet),
            lines = main.substring(0, i).match(/\n/g);

        return lines ? lines.length : 0;
    };

    ExecuteJob.prototype.createAttributeFile = function (node, files) {
        var skip = ['code'],
            numRegex = /^\d+\.?\d*((e|e-)\d+)?$/,
            table;

        this.logger.info('Creating attributes file...');
        table = '{\n\t' + this.core.getAttributeNames(node)
            .filter(attr => skip.indexOf(attr) === -1)
            .map(name => {
                var value = this.getAttribute(node, name);
                if (!numRegex.test(value)) {
                    value = `"${value}"`;
                }
                return [name, value];
            })
            .map(pair => pair.join(' = '))
            .join(',\n\t') + '\n}';

        files['attributes.lua'] = `-- attributes of ${this.getAttribute(node, 'name')}\nreturn ${table}`;
    };

    ExecuteJob.prototype.createPointers = function (node, files, cb) {
        var pointers,
            nIds;

        this.logger.info('Creating pointers file...');
        pointers = this.core.getPointerNames(node)
            .filter(name => name !== 'base')
            .filter(id => this.core.getPointerPath(node, id) !== null);

        nIds = pointers.map(p => this.core.getPointerPath(node, p));
        files.ptrAssets = {};
        Q.all(
            nIds.map(nId => this.getPtrCodeHash(nId))
        )
        .then(resultHashes => {
            var name = this.getAttribute(node, 'name');
            this.logger.info(`Pointer generation for ${name} FINISHED!`);
            resultHashes.forEach((hash, index) => {
                files.ptrAssets[`pointers/${pointers[index]}/init.lua`] = hash;
            });
            return cb(null, files);
        })
        .fail(e => {
            this.logger.error(`Could not generate pointer files for ${this.getAttribute(node, 'name')}: ${e.toString()}`);
            return cb(e);
        });
    };

    ExecuteJob.prototype.notifyStdoutUpdate = function (nodeId) {
        this.sendNotification({
            message: `${CONSTANTS.STDOUT_UPDATE}/${nodeId}`,
            toBranch: true
        });
    };

    ExecuteJob.prototype.watchOperation = function (executor, hash, op, job) {
        var jobId = this.core.getPath(job),
            opId = this.core.getPath(op),
            info,
            secret,
            name = this.getAttribute(job, 'name');

        // If canceled, stop the operation
        if (this.canceled) {
            secret = this.getAttribute(job, 'secret');
            if (secret) {
                executor.cancelJob(hash, secret);
                this.delAttribute(job, 'secret');
                this.canceled = true;
                return this.onOperationCanceled(op);
            }
        }

        return executor.getInfo(hash)
            .then(_info => {  // Update the job's stdout
                var actualLine,  // on executing job
                    currentLine = this.outputLineCount[jobId];

                info = _info;
                actualLine = info.outputNumber;
                if (actualLine !== null && actualLine >= currentLine) {
                    this.outputLineCount[jobId] = actualLine + 1;
                    return executor.getOutput(hash, currentLine, actualLine+1)
                        .then(outputLines => {
                            var stdout = this.getAttribute(job, 'stdout'),
                                output = outputLines.map(o => o.output).join(''),
                                last = stdout.lastIndexOf('\n'),
                                result,
                                lastLine,
                                msg;

                            // parse deepforge commands
                            if (last !== -1) {
                                stdout = stdout.substring(0, last+1);
                                lastLine = stdout.substring(last+1);
                                output = lastLine + output;
                            }
                            result = this.processStdout(job, output, true);
                            output = result.stdout;

                            if (output) {
                                // Send notification to all clients watching the branch
                                this.logManager.appendTo(jobId, output)
                                    .then(() => this.notifyStdoutUpdate(jobId));
                            }
                            if (result.hasMetadata) {
                                msg = `Updated graph/image output for ${name}`;
                                return this.save(msg);
                            }
                        });
                }
            })
            .then(() => {
                if (info.status === 'CREATED' || info.status === 'RUNNING') {
                    var time = Date.now(),
                        next = Q();

                    if (info.status === 'RUNNING' &&
                        this.getAttribute(job, 'status') !== 'running') {

                        this.setAttribute(job, 'status', 'running');
                        next = this.save(`Started "${name}" operation in ${this.pipelineName}`);
                    }

                    return next.then(() => {
                        var delta = Date.now() - time;
                            
                        if (delta > ExecuteJob.UPDATE_INTERVAL) {
                            return this.watchOperation(executor, hash, op, job);
                        }

                        setTimeout(
                            this.watchOperation.bind(this, executor, hash, op, job),
                            ExecuteJob.UPDATE_INTERVAL - delta
                        );
                    });
                }

                if (info.status === 'CANCELED') {
                    // If it was cancelled, the pipeline has been stopped
                    this.logger.debug(`"${name}" has been CANCELED!`);
                    this.canceled = true;
                    return this.logManager.getLog(jobId)
                        .then(stdout => {
                            this.setAttribute(job, 'stdout', stdout);
                            return this.onOperationCanceled(op);
                        });
                }

                if (info.status === 'SUCCESS' || info.status === 'FAILED_TO_EXECUTE') {
                    this.setAttribute(job, 'execFiles', info.resultHashes[name + '-all-files']);
                    return this.blobClient.getArtifact(info.resultHashes.stdout)
                        .then(artifact => {
                            var stdoutHash = artifact.descriptor.content[STDOUT_FILE].content;
                            return this.blobClient.getObjectAsString(stdoutHash);
                        })
                        .then(stdout => {
                            // Parse the remaining code
                            var result = this.processStdout(job, stdout);
                            this.setAttribute(job, 'stdout', result.stdout);
                            this.logManager.deleteLog(jobId);
                            if (info.status !== 'SUCCESS') {
                                // Download all files
                                this.result.addArtifact(info.resultHashes[name + '-all-files']);
                                // Set the job to failed! Store the error
                                this.onOperationFail(op, `Operation "${opId}" failed! ${JSON.stringify(info)}`); 
                            } else {
                                this.onDistOperationComplete(op, info);
                            }
                        });
                } else {  // something bad happened...
                    var err = `Failed to execute operation "${opId}": ${info.status}`,
                        consoleErr = `[0;31mFailed to execute operation: ${info.status}[0m`;
                    this.setAttribute(job, 'stdout', consoleErr);
                    this.logger.error(err);
                    this.onOperationFail(op, err);
                }
            })
            .catch(err => this.logger.error(`Could not get op info for ${opId}: ${err}`));
    };

    ExecuteJob.prototype.onDistOperationComplete = function (node, result) {
        var nodeId = this.core.getPath(node),
            outputMap = {},
            outputs;

        // Match the output names to the actual nodes
        // Create an array of [name, node]
        // For now, just match by type. Later we may use ports for input/outputs
        // Store the results in the outgoing ports
        this.getOutputs(node)
            .then(outputPorts => {
                outputs = outputPorts.map(tuple => [tuple[0], tuple[2]]);
                outputs.forEach(output => outputMap[output[0]] = output[1]);

                // this should not be in directories -> flatten the data!
                return Q.all(outputs.map(tuple =>  // [ name, node ]
                    this.blobClient.getArtifact(result.resultHashes[tuple[0]])
                ));
            })
            .then(artifacts => {
                this.logger.info(`preparing outputs -> retrieved ${artifacts.length} objects`);
                // Create new metadata for each
                artifacts.forEach((artifact, i) => {
                    var name = outputs[i][0],
                        outputData = artifact.descriptor.content[`outputs/${name}`],
                        hash = outputData && outputData.content;

                    if (hash) {
                        this.setAttribute(outputMap[name], 'data', hash);
                        this.logger.info(`Setting ${nodeId} data to ${hash}`);
                    }
                });

                return this.onOperationComplete(node);
            })
            .fail(e => this.onOperationFail(node, `Operation ${nodeId} failed: ${e}`));
    };

    ExecuteJob.prototype.getOutputs = function (node) {
        return this.getOperationData(node, this.META.Outputs);
    };

    ExecuteJob.prototype.getInputs = function (node) {
        return this.getOperationData(node, this.META.Inputs);
    };

    ExecuteJob.prototype.getOperationData = function (node, metaType) {
        // Load the children and the output's children
        return this.core.loadChildren(node)
            .then(containers => {
                var outputs = containers.find(c => this.core.isTypeOf(c, metaType));
                return outputs ? this.core.loadChildren(outputs) : [];
            })
            .then(outputs => {
                var bases = outputs.map(node => this.core.getMetaType(node));
                // return [[arg1, Type1, node1], [arg2, Type2, node2]]
                return outputs.map((node, i) => [
                    this.getAttribute(node, 'name'),
                    this.getAttribute(bases[i], 'name'),
                    node
                ]);
            });
    };

    //////////////////////////// Special Operations ////////////////////////////
    ExecuteJob.prototype.executeLocalOperation = function (type, node) {
        // Retrieve the given LOCAL_OP type
        if (!this[type]) {
            this.logger.error(`No local operation handler for ${type}`);
        }
        this.logger.info(`Running local operation ${type}`);

        return this[type](node);
    };

    _.extend(
        ExecuteJob.prototype,
        PtrCodeGen.prototype,
        LocalExecutor.prototype
    );

    ExecuteJob.prototype.processStdout = function (job, text, continued) {
        var lines = text.replace(/\u0000/g, '').split('\n'),
            result = this.parseForMetadataCmds(job, lines, !continued);

        result.stdout = utils.resolveCarriageReturns(result.stdout).join('\n');
        return result;
    };

    //////////////////////////// Metadata ////////////////////////////
    ExecuteJob.prototype.parseForMetadataCmds = function (job, lines, skip) {
        var jobId = this.core.getPath(job),
            args,
            result = [],
            cmdCnt = 0,
            ansiRegex = /\[\d+(;\d+)?m/g,
            hasMetadata = false,
            trimStartRegex = new RegExp(CONSTANTS.START_CMD + '.*'),
            matches,
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
                    args[0] = job;
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
        var oldMetadata = this._oldMetadataByName[jobId] &&
            this._oldMetadataByName[jobId][type],
            node,
            id;

        if (oldMetadata && oldMetadata[name]) {
            id = oldMetadata[name];
            node = this._markForDeletion[jobId][id];
            delete this._markForDeletion[jobId][id];
        }

        return node || null;
    };

    return ExecuteJob;
});
