/*globals define, WebGMEGlobal*/
/*jshint browser: true*/

define([
    'js/DragDrop/DragHelper',
    'deepforge/Constants',
    'js/Constants',
    'deepforge/viz/panels/ThumbnailControl',
    'deepforge/viz/PipelineControl',
    'deepforge/viz/Execute',
    'deepforge/globals',
    'common/core/coreQ',
    'common/storage/constants',
    'q',
    'underscore'
], function (
    DragHelper,
    CONSTANTS,
    GME_CONSTANTS,
    ThumbnailControl,
    PipelineControl,
    Execute,
    DeepForge,
    Core,
    STORAGE_CONSTANTS,
    Q,
    _
) {

    'use strict';

    var PipelineEditorControl,
        CONN = {
            SRC: 'src',
            DST: 'dst'
        },
        DECORATORS = {},
        WIDGET_NAME = 'EasyDAG';

    DECORATORS[CONSTANTS.OP.INPUT] = 'ArtifactOpDecorator';

    PipelineEditorControl = function (options) {
        ThumbnailControl.call(this, options);
        Execute.call(this, this._client, this._logger);
        this.addedIds = {};
        this.executionTerritory = {};
        this.executionUI = null;
        this.invalidated = {};
        this._widget.deleteExecution = this.deleteExecution.bind(this);
        this._widget.isArchitecturePtr = this.isArchitecturePtr.bind(this);
    };

    _.extend(
        PipelineEditorControl.prototype,
        ThumbnailControl.prototype,
        PipelineControl.prototype,
        Execute.prototype
    );

    PipelineEditorControl.prototype._getValidInitialNodes =
        PipelineControl.prototype.getValidInitialNodes;

    PipelineEditorControl.prototype.TERRITORY_RULE = {children: 3};
    PipelineEditorControl.prototype.selectedObjectChanged = function (nodeId) {
        DeepForge.last.Pipeline = nodeId;
        this._logger.debug('activeObject nodeId \'' + nodeId + '\'');

        // Remove current territory patterns
        if (this._currentNodeId) {
            this._client.removeUI(this._territoryId);
        }

        this._currentNodeId = nodeId;
        this._currentNodeParentId = undefined;

        if (typeof this._currentNodeId === 'string') {
            var desc = this._getObjectDescriptor(nodeId);
            this._widget.setTitle(desc.name);

            if (typeof desc.parentId === 'string') {
                this.$btnModelHierarchyUp.show();
            } else {
                this.$btnModelHierarchyUp.hide();
            }

            this._currentNodeParentId = desc.parentId;

            // Put new node's info into territory rules
            this.updateTerritory();
        }
    };

    PipelineEditorControl.prototype.hasCurrentNode = function () {
        return typeof this._currentNodeId === 'string';
    };

    PipelineEditorControl.prototype.onNodeNameChanged = function (from, to) {
        var msg = `Renaming pipeline "${from}" -> "${to}"`;
        if (from !== to && !/^\s*$/.test(to)) {
            this._client.startTransaction(msg);
            this._client.setAttribute(this._currentNodeId, 'name', to);
            this._client.completeTransaction();
        }
    };

    PipelineEditorControl.prototype.updateTerritory = function() {
        var nodeId = this._currentNodeId;

        // activeNode rules
        this._territories = {};

        this._territoryId = this._client.addUI(this, events => {
            this._eventCallback(events);
        });
        this._logger.debug(`PipelineEditor territory id is ${this._territoryId}`);

        this._territories[nodeId] = {children: 0};  // Territory "rule"
        this._client.updateTerritory(this._territoryId, this._territories);

        this._territories[nodeId] = this.TERRITORY_RULE;

        // Add the operation definitions to the territory
        var metanodes = this._client.getAllMetaNodes(),
            operation = metanodes.find(n => n.getAttribute('name') === 'Operation');

        // Get all the meta nodes that are instances of Operations
        metanodes
            .filter(n => n.isTypeOf(operation.getId()))
            // Add a rule for them
            .forEach(op => this._territories[op.getId()] = this.TERRITORY_RULE);

        // Add arch/artifact dir to the territory
        // loading more than necessary.... can restrict it in the future
        // if perf is a problem
        this._territories[GME_CONSTANTS.PROJECT_ROOT_ID] = {children: 2};

        this._client.updateTerritory(this._territoryId, this._territories);
    };

    PipelineEditorControl.prototype._initWidgetEventHandlers = function () {
        ThumbnailControl.prototype._initWidgetEventHandlers.call(this);
        this._widget.getExistingPortMatches = this.getExistingPortMatches.bind(this);
        this._widget.createConnection = this.createConnection.bind(this);
        this._widget.removeConnection = this.removeConnection.bind(this);
        this._widget.getDecorator = this.getDecorator.bind(this);
        
        this._widget.onBackgroundDrop = (event, dragInfo) => {
            if (!this._currentNodeId) {  // no active node. Cannot add pipeline
                return;
            }
            const effects = DragHelper.getDragEffects(dragInfo);
            const items = DragHelper.getDragItems(dragInfo);

            if (effects.includes(DragHelper.DRAG_EFFECTS.DRAG_CREATE_INSTANCE)) {
                const parentId = this._currentNodeId;
                const msg = `Creating ${items.length} new operation(s)`;
                this._client.startTransaction(msg);
                items.forEach(baseId => this._client.createNode({parentId, baseId}));
                this._client.completeTransaction();
            }
        };
    };

    PipelineEditorControl.prototype.isContainedInActive = function (gmeId) {
        // Check if the given id is contained in the active node
        return gmeId.indexOf(this._currentNodeId) === 0;
    };

    ////////////////////// Node Load/Update/Unload Overrides //////////////////////
    // Filter out the child nodes (bc of the larger territory)
    PipelineEditorControl.prototype._onLoad = function (gmeId) {
        var desc = this._getObjectDescriptor(gmeId);
        if (desc.parentId === this._currentNodeId) {
            this.addedIds[desc.id] = true;
            // Validate any connections
            if (this.isValid(desc)) {
                return ThumbnailControl.prototype._onLoad.call(this, gmeId);
            }
        } else if (desc.parentId !== null &&
            this.isContainedInActive(desc.parentId) && desc.isDataPort) {
            // port added!
            this.addedIds[desc.id] = true;
            this._widget.addPort(desc);
        }
    };

    PipelineEditorControl.prototype.isValid = function (desc) {
        // If it is a "dangling connection", remove it!
        const isConnection = desc.pointers.hasOwnProperty('src') &&
            desc.pointers.hasOwnProperty('dst');

        if (isConnection) {
            if (!(desc.src && desc.dst)) {
                var node = this._client.getNode(this._currentNodeId),
                    name = node.getAttribute('name'),
                    msg = `Removing invalid connection ${desc.id} in "${name}"`;

                this.invalidated[desc.id] = true;
                this._client.startTransaction(msg);
                this._client.deleteNode(desc.id);
                this._client.completeTransaction();
                return false;
            }
        }
        return true;
    };

    PipelineEditorControl.prototype._onUnload = function (gmeId) {
        // Check if it has been added
        if (this.invalidated[gmeId]) {
            // No need to notify the widget; this was filtered bc it was
            // an invalid connection
            delete this.invalidated[gmeId];
            return;
        }

        if(this.addedIds[gmeId]) {
            delete this.addedIds[gmeId];
            return ThumbnailControl.prototype._onUnload.call(this, gmeId);
        }
    };

    PipelineEditorControl.prototype._onUpdate = function (gmeId) {
        var desc = this._getObjectDescriptor(gmeId);
        if (desc.isDataPort && this.isContainedInActive(desc.parentId)) {  // port added!
            this._widget.updatePort(desc);
        } else if (desc.isConnection) {
            this._widget.updateConnection(desc);
        } else if (desc.parentId === this._currentNodeId) {
            this._widget.updateNode(desc);
        }  // Ignore any other updates - ie, Inputs/Outputs containers
    };

    PipelineEditorControl.prototype._getNodeDecorator = function (nodeObj) {
        var decoratorManager = this._client.decoratorManager,
            decorator,
            decoratorClass;

        var base = this._client.getNode(nodeObj.getMetaTypeId()),
            baseName = base && base.getAttribute('name');

        decorator = DECORATORS[baseName] || this.DEFAULT_DECORATOR;
        decoratorClass = decoratorManager.getDecoratorForWidget(decorator, WIDGET_NAME);
        return decoratorClass;
    };

    // Override the getSuccessors method to look up successors by operations
    // with input nodes of the selected node's output type (prioritize the 
    // valid nodes that are using an unused output type, if one exists, ow
    // prioritize based on current outgoing connections count).
    // TODO

    PipelineEditorControl.prototype.hasValidOutputs = function (inputId, outputs) {
        return this.getValidOutputs(inputId, outputs);
    };

    PipelineEditorControl.prototype.getValidOutputs = function (inputId, outputs) {
        // Valid input if one of the isTypeOf(<output>, inputId)
        // for at least one output
        var inputType = this._client.getNode(inputId).getMetaTypeId(),
            node;

        return outputs.filter(type => {
            node = this._client.getNode(type);
            return node.isTypeOf(inputType);
        }).length;
    };

    PipelineEditorControl.prototype._getValidSuccessorNodes = function (nodeId) {
        // Get all valid children
        var node = this._client.getNode(nodeId),
            children,
            outputs;

        children = this._getAllValidChildren(node.getParentId())
            .map(id => this._client.getNode(id));

        // Get all valid data output types of 'nodeId'
        outputs = this.getOperationOutputs(node)
            .map(id => this._client.getNode(id).getMetaTypeId());

        // For all valid children, return all that have at least one
        // (unoccupied) input that is a superclass (or same class) as
        // one of the outputs
        return children
            .filter(node => this.getOperationInputs(node)
            .filter(id => this.hasValidOutputs(id, outputs)).length)
            .map(node => {
                return {
                    node: this._getObjectDescriptor(node.getId())
                };
            });
    };

    PipelineEditorControl.prototype.removeConnection = function (id) {
        var conn = this._client.getNode(id),
            names,
            msg;

        names = ['src', 'dst']  // srcPort, srcOp, dstPort, dstOp
            .map(type => conn.getPointer(type).to)
            .map(portId => [portId, this.getSiblingContaining(portId)])
            .reduce((l1, l2) => l1.concat(l2))
            .map(id => this._client.getNode(id));

        msg = `Disconnecting ${names[0]} of ${names[1]} from ${names[2]} of ${names[3]}`;

        this._client.startTransaction(msg);
        this._client.deleteNode(id);
        this._client.completeTransaction();
    };

    PipelineEditorControl.prototype.getExistingPortMatches = function (portId, isOutput) {
        // Get the children nodeIds
        var srcOpId = this.getSiblingContaining(portId),
            childrenIds,
            skipIds,  // Either ancestors or predecessors -> no cycles allowed!
            skipType = isOutput ? 'Predecessors' : 'Successors',
            method = 'get' + skipType,
            matches;

        childrenIds = this._client.getNode(this._currentNodeId).getChildrenIds();

        // Remove either ancestors or descendents
        skipIds = this[method](childrenIds.map(id => this._client.getNode(id)), srcOpId);
        childrenIds = _.difference(childrenIds, skipIds);

        matches = this._getPortMatchFor(portId, childrenIds, isOutput);

        // Get the port matches in the children
        return matches.map(tuple => {
            return {
                nodeId: tuple[0],
                portIds: tuple[1]
            };
        });
    };

    PipelineEditorControl.prototype._getPortMatchFor = function (portId, opIds, isOutput) {
        //opIds = opIds || this._getAllValidChildren(node.getParentId());
        var opNodes = opIds.map(id => this._client.getNode(id)),
            portType = this._client.getNode(portId).getMetaTypeId(),
            getNodes = node => {
                var searchType = isOutput ? 'Inputs' : 'Outputs',
                    searchFn = 'getOperation' + searchType,
                    dstPorts = this[searchFn](node);

                return [
                    node.getId(),
                    dstPorts.filter(id => {
                        var typeId = this._client.getNode(id).getMetaTypeId(),
                            portTypeNode = this._client.getNode(portType),
                            typeNode = this._client.getNode(typeId);

                        return isOutput ?
                            portTypeNode.isTypeOf(typeId) :
                            typeNode.isTypeOf(portType);
                    })
                ];
            };

        return opNodes
            .map(getNodes)  // Get all valid src/dst ports
            .filter(tuple => tuple[1].length);
    };

    PipelineEditorControl.prototype.createConnection = function (srcId, dstId) {
        var connId,
            names,
            msg;

        names = [srcId, dstId]  // srcPort, srcOp, dstPort, dstOp
            .map(id => [id, this.getSiblingContaining(srcId)])
            .reduce((l1, l2) => l1.concat(l2))
            .map(id => this._client.getNode(id));

        msg = `Connecting ${names[0]} of ${names[1]} to ${names[2]} of ${names[4]}`;

        this._client.startTransaction(msg);

        connId = this._client.createNode({
            parentId: this._currentNodeId,
            baseId: this.getConnectionId()
        });
        this._client.setPointer(connId, CONN.SRC, srcId);
        this._client.setPointer(connId, CONN.DST, dstId);

        this._client.completeTransaction();
    };

    PipelineEditorControl.prototype._getPortPairs = function (outputs, inputs) {
        // Given a set of outputs and (potential) inputs, return valid pairs
        // <outputId, inputId> where `outputId` is the id of an outgoing port
        // in the src operation and `inputId` is the id of an incoming port in
        // the dst operation
        var result = [],
            ipairs = inputs.map(id => [id, this._client.getNode(id).getMetaTypeId()]),
            oType,
            oTypeId;

        // For each output, get all possible (valid) input destinations
        outputs.forEach(outputId => {
            oTypeId = this._client.getNode(outputId).getMetaTypeId();
            oType = this._client.getNode(oTypeId);
            result = result.concat(ipairs.filter(pair =>
                    // output type should be valid input type
                    oType.isTypeOf(pair[1])
                )
                .map(pair => [outputId, pair[0]])  // Get the input data id
            );
        });
        return result;
    }; 

    PipelineEditorControl.prototype.getConnectionId = function () {
        return this._client.getAllMetaNodes()
            .find(node => node.getAttribute('name') === 'Transporter')
            .getId();
    };

    PipelineEditorControl.prototype._createConnectedNode = function (nodeId, typeId) {
        // Create a node of type "typeId" after "nodeId"
        // Figure out which ports need to be connected
        var parentId = this._currentNodeId,
            outputs = this.getOperationOutputs(this._client.getNode(nodeId)),
            inputs = this.getOperationInputs(this._client.getNode(typeId)),
            pairs = this._getPortPairs(outputs, inputs),
            srcOpName = this._client.getNode(nodeId).getAttribute('name');

        this._logger.info(`Valid ports for ${nodeId} -> ${typeId} are ${pairs}`);

        // If none, => error!
        // For now, I am assuming that they used '_getValidSuccessorNodes' to
        // get the pairs. ie, it is valid.
        // TODO

        if (pairs.length === 1) {  // If one, continue
            var pair = pairs[0],
                srcPortId = pair[0],
                srcPort,
                dstPortBaseId = pair[1],
                dstPortBase,
                rootGuid = this._client.getActiveRootHash(),
                branchName = this._client.getActiveBranchName(),
                startCommit = this._client.getActiveCommitHash(),
                connTypeId = this.getConnectionId(),
                project = this._client.getProjectObject(),
                conn,
                connBase,
                parentNode,
                commitMsg,
                root;

            // This next portion uses the core bc it requires async loading and batching
            // into a single commit
            var core = new Core(project, {
                globConf: WebGMEGlobal.gmeConfig,
                logger: this._logger.fork('core')
            });
            // Load the first node/commit...
            core.loadRoot(rootGuid)
            .then(_root => {
                root = _root;
                return Q.all(
                    [parentId, typeId, connTypeId, dstPortBaseId, srcPortId].map(id => core.loadByPath(root, id))
                );
            })
            .then(nodes => {
                // Create the given dst operation
                var opBase = nodes[1],
                    dstOp;

                parentNode = nodes[0];
                connBase = nodes[2];
                dstPortBase = nodes[3];
                srcPort = nodes[4];
                // Create the given dst operation
                dstOp = core.createNode({
                    parent: parentNode,
                    base: opBase
                });
                commitMsg = `Adding ${core.getAttribute(dstOp, 'name')} after ${srcOpName}`;
                return core.loadChildren(dstOp);
            })
            .then(containers => {
                var inputContainer;

                // Get the operation inputs (can't use the earlier fn - different node types)
                inputContainer = containers
                .find(cntr => core.isInstanceOf(cntr, 'Inputs'));

                return core.loadChildren(inputContainer);
            })
            .then(inputDataPorts => {
                // Get the matching input node
                var dstPort = inputDataPorts.find(port => core.isTypeOf(port, dstPortBase));
                // Create the connection
                conn = core.createNode({
                    parent: parentNode,
                    base: connBase
                });

                // Connect srcPortId and the node from above
                core.setPointer(conn, 'src', srcPort);
                core.setPointer(conn, 'dst', dstPort);
                var persisted = core.persist(root);
                return project.makeCommit(
                    branchName,
                    [ startCommit ],
                    persisted.rootHash,
                    persisted.objects,
                    commitMsg
                );
            })
            .then(result => {
                if (result.status === STORAGE_CONSTANTS.SYNCED) {
                    // Throw out the changes... warn the user?
                    this._logger.info('SYNCED!');
                } else {
                    // Throw out the changes... warn the user?
                    this._logger.warn(`Could not create operation after ${srcOpName}`);
                }
            })
            .fail(err => this._logger.error(`Could not create operation after ${srcOpName}: ${err}`));

        } else if (pairs.length > 1) {
            // Else, prompt!
            // TODO
            this._logger.error('multiple port combinations... This is currently unsupported');
        }
    };

    PipelineEditorControl.prototype._getTargetDirs = function (typeIds) {
        // Find the directories containing these types
        return this._client.getNode(GME_CONSTANTS.PROJECT_ROOT_ID).getChildrenIds()
            // No referencing data meta types
            .filter(id => {
                var cMeta = this._client.getChildrenMeta(id),
                    validChildIds;

                if (!cMeta) {
                    return false;
                }

                validChildIds = cMeta.items.map(item => item.id);
                for (var i = typeIds.length; i--;) {
                    if (validChildIds.indexOf(typeIds[i]) !== -1) {
                        return true;
                    }
                }
                return false;
            });
    };

    ////////////////////// Execution Support //////////////////////
    PipelineEditorControl.prototype.onActiveNodeUpdate =
    PipelineEditorControl.prototype.onActiveNodeLoad = function (gmeId) {
        var node = this._client.getNode(gmeId),
            executionIds = node.getMemberIds('executions'),
            executionRule = {children: 0};

        if (this.executionUI) {
            this._client.removeUI(this, this.executionEvents.bind(this));
        }

        this.executionTerritory = {};
        // Create a territory for the executions
        executionIds.forEach(id => this.executionTerritory[id] = executionRule);

        this.executionUI = this._client.addUI(this, this.executionEvents.bind(this));
        this._client.updateTerritory(this.executionUI, this.executionTerritory);
    };

    PipelineEditorControl.prototype.executionEvents = function (events) {
        var event;

        // Handle events related to the associated executions
        for (var i = events.length; i--;) {
            event = events[i];
            if (event.etype === GME_CONSTANTS.TERRITORY_EVENT_LOAD) {
                this.onExecLoad(event.eid);
            } else if (event.etype === GME_CONSTANTS.TERRITORY_EVENT_UPDATE) {
                this.onExecUpdate(event.eid);
            } else if (event.etype === GME_CONSTANTS.TERRITORY_EVENT_UNLOAD) {
                this.onExecUnload(event.eid);
            }
        }
    };

    PipelineEditorControl.prototype.getExecDesc = function (id) {
        var node = this._client.getNode(id);
        return {
            id: id,
            createdAt: node.getAttribute('createdAt'),
            status: node.getAttribute('status'),
            name: node.getAttribute('name')
        };
    };

    PipelineEditorControl.prototype.onExecLoad = function (id) {
        var desc = this.getExecDesc(id);
        this._widget.addExecution(desc);
    };

    PipelineEditorControl.prototype.onExecUnload = function (id) {
        this._widget.removeExecution(id);
    };

    PipelineEditorControl.prototype.onExecUpdate = function (id) {
        var desc = this.getExecDesc(id);
        this._widget.updateExecution(desc);
    };

    PipelineEditorControl.prototype._detachClientEventListeners = function () {
        if (this.executionUI) {
            this._client.removeUI(this, this.executionEvents.bind(this));
        }
        ThumbnailControl.prototype._detachClientEventListeners.call(this);
    };

    ////////////////////// Execution Support END //////////////////////
    PipelineEditorControl.prototype.getDecorator = function (nodeId) {
        var node = this._client.getNode(nodeId);
        if (node) {
            return this._getNodeDecorator(node);
        } else {
            return this._client.decoratorManager.getDecoratorForWidget(
                this.DEFAULT_DECORATOR, WIDGET_NAME);
        }
    };

    PipelineEditorControl.prototype._deleteTag = function (tagName) {
        // Check if the tag exists and delete it if so!
        var projectId = this._client.getActiveProjectId();

        this._client.deleteTag(projectId, tagName, err => {
            if (err) {
                this.logger.error(`Tag deletion failed: ${err}`);
            }
        });
    };

    PipelineEditorControl.prototype.deleteExecution = function (id) {
        var node = this._client.getNode(id),
            name = '',
            msg;

        if (node) {
            name = node && node.getAttribute('name');
        }

        msg = `Deleted ${name} (${id}) execution`;

        // Stop the execution w/o setting any attributes on the execution
        this._client.startTransaction(msg);
        this._deleteTag(name);  // Remove execution tag
        if (this.isRunning(node)) {
            this.stopExecution(id);
            this._client.deleteNode(id);
            this._client.completeTransaction();
        } else {
            this._client.deleteNode(id);
            this._client.completeTransaction();
        }
    };

    ////////////////////// Criterion Support //////////////////////
    PipelineEditorControl.prototype._getValidTargetsFor = function (id, ptr) {
        // Check if the pointer is a Criterion pointer -> if so, only show the meta types
        // and the ones in the custom layer dir
        var typeIds = this._client.getPointerMeta(id, ptr).items.map(item => item.id),
            types = typeIds.map(id => this._client.getNode(id)),
            criterion = types.find(node => node.getAttribute('name') === 'Criterion'),
            items,
            criterionId;

        if (criterion) {
            // Get all criterion types
            criterionId = criterion.getId();
            items = this._client.getAllMetaNodes()
                .filter(node => node.isTypeOf(criterionId));

            return items.map(node => {
                return {
                    node: this._getObjectDescriptor(node.getId())
                };
            });
        } else {
            return ThumbnailControl.prototype._getValidTargetsFor.apply(this, arguments);
        }
    };

    PipelineEditorControl.prototype.isArchitecturePtr = function (id, ptr) {
        var ptrMeta = this._client.getPointerMeta(id, ptr),
            targets;

        // Check if ptr of the given id is referencing an architecture
        if (ptrMeta.items) {
            targets = ptrMeta.items.map(item => this._client.getNode(item.id));
            return !!targets.find(node => node.getAttribute('name') === 'Architecture');
        }

        return false;
    };

    return PipelineEditorControl;
});
