/*globals define, WebGMEGlobal*/
/*jshint browser: true*/

define([
    'panels/EasyDAG/EasyDAGControl',
    'deepforge/viz/PipelineControl',
    'common/core/coreQ',
    'common/storage/constants',
    'q',
    'underscore'
], function (
    EasyDAGControl,
    PipelineControl,
    Core,
    STORAGE_CONSTANTS,
    Q,
    _
) {

    'use strict';

    var PipelineEditorControl;

    PipelineEditorControl = function (options) {
        EasyDAGControl.call(this, options);
        this.addedIds = {};
    };

    _.extend(
        PipelineEditorControl.prototype,
        EasyDAGControl.prototype,
        PipelineControl.prototype
    );

    PipelineEditorControl.prototype.TERRITORY_RULE = {children: 3};
    PipelineEditorControl.prototype.selectedObjectChanged = function (nodeId) {
        var desc = this._getObjectDescriptor(nodeId);

        this._logger.debug('activeObject nodeId \'' + nodeId + '\'');

        // Remove current territory patterns
        if (this._currentNodeId) {
            this._client.removeUI(this._territoryId);
        }

        this._currentNodeId = nodeId;
        this._currentNodeParentId = undefined;

        if (typeof this._currentNodeId === 'string') {
            this._widget.setTitle(desc.name.toUpperCase());

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

    PipelineEditorControl.prototype.updateTerritory = function() {
        var nodeId = this._currentNodeId;

        // activeNode rules
        this._territories = {};

        this._territoryId = this._client.addUI(this, events => {
            this._eventCallback(events);
        });

        this._territories[nodeId] = {children: 0};  // Territory "rule"
        this._client.updateTerritory(this._territoryId, this._territories);

        this._territories[nodeId] = this.TERRITORY_RULE;

        // Add the operation definitions to the territory
        var metanodes = this._client.getAllMetaNodes(),
            operation = metanodes.find(n => n.getAttribute('name') === 'Operation');

        // Get all the meta nodes that are instances of Operations
        metanodes.map(n => n.getId())
            .filter(nId => this._client.isTypeOf(nId, operation.getId()))
            // Add a rule for them
            .forEach(opId => this._territories[opId] = this.TERRITORY_RULE);

        this._client.updateTerritory(this._territoryId, this._territories);
    };

    PipelineEditorControl.prototype.formatIO = function(id) {
        var node = this._client.getNode(id);
        // This might not be necessary...
        //return [
            //node.getAttribute('name'),
            //node.getBaseId()
        //];
        return node.getAttribute('name');
    };

    PipelineEditorControl.prototype.getSiblingContaining = function(containedId) {
        var n = this._client.getNode(containedId);
        while (n && n.getParentId() !== this._currentNodeId) {
            n = this._client.getNode(n.getParentId());
        }
        return n && n.getId();
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
            return EasyDAGControl.prototype._onLoad.call(this, gmeId);
        } else if (this.isContainedInActive(desc.parentId) && desc.isDataPort) {
            // port added!
            this.addedIds[desc.id] = true;
            this._widget.addPort(desc);
        }
    };

    PipelineEditorControl.prototype._onUnload = function (gmeId) {
        // Check if it has been added
        if(this.addedIds[gmeId]) {
            delete this.addedIds[gmeId];
            return EasyDAGControl.prototype._onUnload.call(this, gmeId);
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
        var inputType = this._client.getNode(inputId).getMetaTypeId();
        return outputs.filter(type => this._client.isTypeOf(type, inputType)).length;
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

    PipelineEditorControl.prototype._getValidInitialNodes = function () {
        // Get all nodes that have no inputs
        return this._getAllValidChildren(this._currentNodeId)
            .map(id => this._client.getNode(id))
            .filter(node => !node.isAbstract() && !node.isConnection())
            // Checking the name (below) is simply convenience so we can
            // still create operation prototypes from Operation (which we
            // wouldn't be able to do if it was abstract - which it probably
            // should be)
            .filter(node => node.getAttribute('name') !== 'Operation' &&
                this.getOperationInputs(node).length === 0)
            .map(node => this._getObjectDescriptor(node.getId()));
    };

    PipelineEditorControl.prototype._getPortPairs = function (outputs, inputs) {
        // Given a set of outputs and (potential) inputs, return valid pairs
        // <outputId, inputId> where `outputId` is the id of an outgoing port
        // in the src operation and `inputId` is the id of an incoming port in
        // the dst operation
        var result = [],
            ipairs = inputs.map(id => [id, this._client.getNode(id).getMetaTypeId()]),
            oType;

        // For each output, get all possible (valid) input destinations
        outputs.forEach(outputId => {
            oType = this._client.getNode(outputId).getMetaTypeId();
            result = result.concat(ipairs.filter(pair =>
                    // output type should be valid input type
                    this._client.isTypeOf(oType, pair[1])
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

            // FIXME: This should use the core...
            // For now, I am going to try to load the core and use it here...
            var core = new Core(project, {
                globConf: WebGMEGlobal.gmeConfig,
                logger: this._logger.fork('core')
            });
            //this._client.startTransaction();
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
        }
    };

    return PipelineEditorControl;
});
