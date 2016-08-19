/*globals define*/
/*jshint node:true, browser:true*/

define([
    'q',
    'deepforge/plugin/LocalExecutor',
    'text!./metadata.json',
    'underscore',
    'plugin/PluginBase'
], function (
    Q,
    LocalExecutor,
    pluginMetadata,
    _,
    PluginBase
) {
    'use strict';

    pluginMetadata = JSON.parse(pluginMetadata);

    /**
     * Initializes a new instance of CreateExecution.
     * @class
     * @augments {PluginBase}
     * @classdesc This class represents the plugin CreateExecution.
     * @constructor
     */
    var CreateExecution = function () {
        // Call base class' constructor.
        PluginBase.call(this);
        this.pluginMetadata = pluginMetadata;
    };

    /**
     * Metadata associated with the plugin. Contains id, name, version, description, icon, configStructue etc.
     * This is also available at the instance at this.pluginMetadata.
     * @type {object}
     */
    CreateExecution.metadata = pluginMetadata;

    // Prototypical inheritance from PluginBase.
    CreateExecution.prototype = Object.create(PluginBase.prototype);
    CreateExecution.prototype.constructor = CreateExecution;

    /**
     * Main function for the plugin to execute. This will perform the execution.
     * Notes:
     * - Always log with the provided logger.[error,warning,info,debug].
     * - Do NOT put any user interaction logic UI, etc. inside this method.
     * - callback always has to be called even if error happened.
     *
     * @param {function(string, plugin.PluginResult)} callback - the result callback
     */
    CreateExecution.prototype.main = function (callback) {
        // Verify that the node is a pipeline
        if (!this.core.isTypeOf(this.activeNode, this.META.Pipeline)) {
            return callback('Current node is not a Pipeline!', this.result);
        }

        return this.createExecution(this.activeNode)
            .then(() => {
                this.result.setSuccess(true);
                callback(null, this.result);
            })
            .catch(err => callback(err, this.result));
    };

    CreateExecution.prototype.getExecutionDir = function () {
        return this.core.loadChildren(this.rootNode)
            .then(children => {
                var execPath = this.core.getPath(this.META.Execution);

                // Find a node in the root that can contain only executions
                return children.find(child => {
                    var metarule = this.core.getChildrenMeta(child);
                    return metarule && metarule[execPath];
                }) || this.rootNode;  // default to rootNode
            });
    };

    CreateExecution.prototype.createExecution = function (node) {
        // Get the user supplied name
        var name = this.core.getAttribute(node, 'name'),
            config = this.getCurrentConfig(),
            basename = config.name || (name + '_execution');
            

        // Given a pipeline, copy all the operations to a custom job
        //   - Copy the operations 
        //   - Wrap the operations in "Job" boxes which contain running info
        //     - eg,
        //       - 'debug' the given run (download all execution files)
        //       - 'console' show console output (future feature)
        //   - Update the references
        var tgtNode,
            execName,
            copies,
            opTuples,  // [[op, index], [op, index], ...]
            dataMapping = {};

        return this.getExecutionDir()
            .then(execDir => {
                var execDirId = this.core.getPath(execDir),
                    execTypeId = this.core.getPath(this.META.Execution);

                this.logger.debug(`Creating execution node in ${execDirId} (type is ${execTypeId})`);
                tgtNode = this.core.createNode({
                    base: this.META.Execution,
                    parent: execDir
                });

                // Get a unique name
                this.logger.debug(`About to get a unique name starting w/ ${basename}`);
                return this.getUniqueExecName(basename);
            })
            .then(_execName => {
                var isSnapshot = !this.getCurrentConfig().debug,
                    originName = this.core.getAttribute(this.activeNode, 'name'),
                    oId = this.core.getPath(this.activeNode),
                    tgtId = this.core.getPath(tgtNode);

                execName = _execName;
                this.logger.debug(`Configuring execution attributes (${execName})`);

                // Set all the metadata for the new execution
                this.core.setAttribute(tgtNode, 'name', execName);
                this.core.setAttribute(tgtNode, 'snapshot', isSnapshot);
                this.core.setAttribute(tgtNode, 'tagname', execName);
                this.core.setAttribute(tgtNode, 'createdAt', Date.now());
                this.logger.debug(`Setting origin pipeline to ${originName} (${oId})`);
                this.core.setPointer(tgtNode, 'origin', this.activeNode);
                this.logger.debug(`Adding ${tgtId} to execution list of ${originName} (${oId})`);
                this.core.addMember(this.activeNode, 'executions', tgtNode);

                this.logger.debug(`Creating tag "${execName}"`);
            })
            .then(() => this.core.loadChildren(node))
            .then(children => {
                if (!children.length) {
                    this.logger.warn('No children in pipeline. Will proceed anyway');
                }

                this.logger.debug(`Copying operations to "${execName}"`);
                return this.copyOperations(children, tgtNode);
            })
            .then(copiedPairs => {
                var originals = copiedPairs.map(pair => pair[0]);
                copies = copiedPairs.map(pair => pair[1]);
                opTuples = copies
                    .map((copy, i) => [copy, i])  // zip w/ index
                    .filter(pair => this.core.isTypeOf(pair[0], this.META.Operation));

                // Create a mapping of old names to new names
                this.logger.debug('Creating mapping of old->new');
                return Q.all(opTuples.map(pair =>
                        // Add the input/output mappings to the dataMapping
                        this.addDataToMap(originals[pair[1]], pair[0], dataMapping)
                    )
                );
            })
            .then(() => {  // datamapping is set!
                this.logger.debug('Updating references...');
                this.updateReferences(copies, dataMapping);
                this.logger.debug('Placing operations in Job containers');
                this.boxOperations(opTuples.map(o => o[0]), tgtNode);
                this.logger.debug('Finished! Saving...');
                return this.save(`Created execution from ${name}`);
            })
            .then(() => this.project.createTag(execName, this.currentHash))
            .then(() => tgtNode);  // return tgtNode
    };

    CreateExecution.prototype.getUniqueExecName = function (basename) {
        var taken = {},
            name,
            i = 2;

        basename = basename.replace(/[^\da-zA-Z_]/g, '_');
        name = basename;

        // Get a unique name wrt the tags and the other executions
        return this.project.getTags()
            .then(tags => {
                Object.keys(tags).forEach(name => taken[name] = true);
                this.logger.debug(`Existing tags are ${Object.keys(tags).join(',')}`);

                // Get the other executions
                return this.getExecutionDir();
            })
            .then(execDir => {
                var cIds = this.core.getChildrenPaths(execDir);
                return Q.all(cIds.map(id => this.core.loadByPath(this.rootNode, id)));
            })
            .then(execs => {
                var names = execs.map(exec => this.core.getAttribute(exec, 'name'));
                this.logger.debug(`Existing names are ${names.join(',')}`);
                names.forEach(name => taken[name] = true);

                while (taken[name]) {
                    name = basename + '_' + (i++);
                }
                this.logger.debug(`Unique name is "${name}"`);
                return name;
            });
    };

    CreateExecution.prototype.copyOperations = function (nodes, dst) {
        var snapshot = !this.getCurrentConfig().debug;

        if (snapshot) {
            this.logger.debug('Execution is a snapshot -> severing the inheritance');
            return Q.all(nodes.map(node => {
                if (this.isLocalOperation(node) ||
                    this.isMetaTypeOf(node, this.META.Transporter)) {

                    return [[node, this.core.copyNode(node, dst)]];
                } else if (this.isMetaTypeOf(node, this.META.Operation)) {
                    return this.snapshotNode(node, dst);
                }
            }))
            .then(pairs => pairs.filter(pair => !!pair)
                .reduce((l1, l2) => l1.concat(l2))
            );

        } else if (nodes.length) {
            this.logger.debug('Execution is not a snapshot -> doing a simple copy');
            var copies = this.core.copyNodes(nodes, dst);
            return nodes.map((node, i) => [node, copies[i]]);
        }
        return [];
    };

    CreateExecution.prototype.snapshotNode = function (op, dst) {
        // If we are making a snapshot, we should copy the base operation
        // and set the attributes, add the child nodes, etc
        var base = this.core.getBase(this.core.getBase(op)),
            names,
            values,
            snapshot = this.core.createNode({
                base: base,
                parent: dst
            });

        // Copy over the attributes
        names = this.core.getValidAttributeNames(op);
        values = names.map(name => this.core.getAttribute(op, name));
        names.forEach((name, i) =>
            this.core.setAttribute(snapshot, name, values[i]));

        // Copy the pointers
        names = this.core.getValidPointerNames(op);
        return Q.all(names
            .map(name => this.core.getPointerPath(op, name))
            .map(id => this.core.loadByPath(this.rootNode, id)))
        .then(values => {

            names.forEach((name, i) =>
                this.core.setPointer(snapshot, name, values[i]));

            // Copy the data I/O
            var srcCntrs = this.core.getChildrenPaths(op),
                dstCntrs = this.core.getChildrenPaths(snapshot);

            return Q.all([srcCntrs, dstCntrs].map(ids =>
                Q.all(ids.map(id => this.core.loadByPath(this.rootNode, id)))));
        })
        .then(cntrs => {
            var srcCntrs,
                dstCntrs;

            // Sort all containers by metatype id
            cntrs.map(l => l.sort((a, b) => {
                var aId = this.core.getPath(this.core.getMetaType(a)),
                    bId = this.core.getPath(this.core.getMetaType(b));

                return aId < bId ? -1 : 1;
            }));

            srcCntrs = cntrs[0];
            dstCntrs = cntrs[1];
            return Q.all(srcCntrs.map(ctr => Q.all(this.core.getChildrenPaths(ctr)
                    .map(id => this.core.loadByPath(this.rootNode, id)))))
                .then(cntrs =>
                    cntrs.map((nodes, i) =>
                        nodes.map(n => [n, this.copyDataNode(n, dstCntrs[i])]))
                );
        })
        .then(nodes => {
            nodes = nodes.reduce((l1, l2) => l1.concat(l2), []);
            nodes.push([op, snapshot]);
            return nodes;
        });
    };

    CreateExecution.prototype.copyDataNode = function (original, dst) {
        // Create new node of the given type
        var attrNames = this.core.getAttributeNames(original),
            values,
            copy = this.core.createNode({
                base: this.core.getMetaType(original),
                parent: dst
            });

        // Set the 'name', 'data' attributes
        values = attrNames.map(name => this.core.getAttribute(original, name));
        attrNames.forEach((name, i) =>
            this.core.setAttribute(copy, name, values[i]));

        return copy;
    };

    CreateExecution.prototype.addDataToMap = function (srcOp, dstOp, map) {
        return Q.all(
            [srcOp, dstOp]
                .map(op => {
                    // Get the inputs and outputs for both
                    return this.core.loadChildren(op)
                        .then(containers => {
                            var names = containers.map(c => this.core.getAttribute(c, 'name')),
                                inputs = containers
                                    .find((c, i) => names[i] === 'Inputs'),
                                outputs = containers
                                    .find((c, i) => names[i] === 'Outputs');

                            return Q.all(
                                [inputs, outputs].map(c => c ? this.core.loadChildren(c) : [])
                            );
                        });
                })
            )
            .then(ios => {
                var srcIO,
                    dstIO;

                srcIO = ios[0].map(c => this.sortIOByName(c));
                dstIO = ios[1].map(c => this.sortIOByName(c));

                // match the nodes by same name!
                srcIO.forEach((srcContainer, c) => srcContainer.forEach((node, n) => 
                    map[this.core.getPath(node)] = dstIO[c][n]  // old id -> new node
                    )
                );
                return true;
            });
    };

    CreateExecution.prototype.sortIOByName = function (container) {
        return container.sort((a, b) =>
            // sort by name
            this.core.getAttribute(a, 'name') < this.core.getAttribute(b, 'name') ? 1 : -1
        );
    };

    // Wrap each Operation with a Job 'box'
    CreateExecution.prototype.boxOperations = function (operations, container) {
        operations.forEach(copy => {
            var name = this.core.getAttribute(copy, 'name'),
                job;

            // Create job
            job = this.core.createNode({
                base: this.META.Job,
                parent: container
            });
            this.core.setAttribute(job, 'name', name);

            // Move the given copy into the Job node
            this.core.moveNode(copy, job);
        });
    };

    CreateExecution.prototype.updateReferences = function (nodes, map) {
        // For each new node, update the references (other than base)
        // to the correct nodeId
        nodes.forEach(copy => {
            this.core.getPointerNames(copy)
                .filter(name => name !== 'base')
                .forEach(name => {
                    var tgt = this.core.getPointerPath(copy, name);
                    if (map[tgt]) {
                        this.logger.info(`Updating ptr ${name}`);
                        this.core.setPointer(copy, name, map[tgt]);
                    }
                });
        });
    };

    _.extend(
        CreateExecution.prototype,
        LocalExecutor.prototype
    );

    return CreateExecution;
});
