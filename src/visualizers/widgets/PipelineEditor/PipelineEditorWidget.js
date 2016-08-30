/*globals WebGMEGlobal, $, define*/
/*jshint browser: true*/

define([
    'widgets/EasyDAG/AddNodeDialog',
    'widgets/EasyDAG/EasyDAGWidget',
    'deepforge/viz/PipelineControl',
    'deepforge/viz/Utils',
    'deepforge/globals',
    './OperationNode',
    './Connection',
    './SelectionManager',
    'underscore',
    'css!./styles/PipelineEditorWidget.css'
], function (
    AddNodeDialog,
    EasyDAGWidget,
    PipelineControl,
    Utils,
    DeepForge,
    OperationNode,
    Connection,
    SelectionManager,
    _
) {
    'use strict';

    var REMOVE_ICON = '<td><div class="input-group"><i class="glyphicon ' +
            'glyphicon-remove"></i></div></td>',
        PipelineEditorWidget,
        WIDGET_CLASS = 'pipeline-editor',
        STATE = {
            DEFAULT: 'default',
            CONNECTING: 'connecting'
        };

    PipelineEditorWidget = function (logger, container, execCntr) {
        EasyDAGWidget.call(this, logger, container);
        this.$el.addClass(WIDGET_CLASS);
        this.portIdToNode = {};
        this.PORT_STATE = STATE.DEFAULT;
        this.srcPortToConnectArgs = null;
        this._connForPort = {};
        this._itemsShowingPorts = [];

        this.updateExecutions = _.debounce(this._updateExecutions, 50);
        this.initExecs(execCntr);
    };

    _.extend(PipelineEditorWidget.prototype, EasyDAGWidget.prototype);
    PipelineEditorWidget.prototype.ItemClass = OperationNode;
    PipelineEditorWidget.prototype.SelectionManager = SelectionManager;
    PipelineEditorWidget.prototype.Connection = Connection;

    PipelineEditorWidget.prototype.onCreateInitialNode =
        PipelineControl.prototype.onCreateInitialNode;

    PipelineEditorWidget.prototype.setupItemCallbacks = function() {
        EasyDAGWidget.prototype.setupItemCallbacks.call(this);
        this.ItemClass.prototype.connectPort =
            PipelineEditorWidget.prototype.connectPort.bind(this);
        this.ItemClass.prototype.disconnectPort =
            PipelineEditorWidget.prototype.disconnectPort.bind(this);
    };

    //////////////////// Port Support ////////////////////
    PipelineEditorWidget.prototype.addConnection = function(desc) {
        EasyDAGWidget.prototype.addConnection.call(this, desc);
        // Record the connection with the input (dst) port
        var dstItem = this.items[desc.dst],
            dstPort;

        this._connForPort[desc.dstPort] = desc.id;
        if (dstItem) {
            dstPort = dstItem.inputs.find(port => port.id === desc.dstPort);

            if (!dstPort) {
                this._logger.error(`Could not find port ${desc.dstPort}`);
                return;
            }

            dstPort.connection = desc.id;
            // Update the given port...
            dstItem.refreshPorts();
        }
        this.refreshThumbnail();
    };

    PipelineEditorWidget.prototype.addNode = function(desc) {
        EasyDAGWidget.prototype.addNode.call(this, desc);
        // Update the input port connections (if not connection)
        var item = this.items[desc.id];
        if (item) {
            item.inputs.forEach(port => 
                port.connection = this._connForPort[port.id]
            );
            // Update the item's ports
            item.refreshPorts();
        }

        // If in a "connecting-port" state, refresh the port
        if (this.PORT_STATE === STATE.CONNECTING) {
            this.PORT_STATE = STATE.DEFAULT;
            this.connectPort.apply(this, this.srcPortToConnectArgs);
        }
        this.refreshThumbnail();
    };

    PipelineEditorWidget.prototype._removeConnection = function(id) {
        // Update the input node (dstPort)
        var conn = this.connections[id].desc,
            dst = this.items[conn.dst],
            port;

        if (dst) {
            port = dst.inputs.find(port => port.id === conn.dstPort);
            port.connection = null;
            dst.refreshPorts();
        }
        EasyDAGWidget.prototype._removeConnection.call(this, id);
        this.refreshThumbnail();
    };

    // May not actually need these port methods
    PipelineEditorWidget.prototype.addPort = function(desc) {
        this.items[desc.nodeId].addPort(desc);
        this.portIdToNode[desc.id] = desc.nodeId;
        this.refreshUI();
    };

    PipelineEditorWidget.prototype.updatePort = function(desc) {
        this.items[desc.nodeId].updatePort(desc);
        this.refreshUI();
    };

    PipelineEditorWidget.prototype.removeNode = function(gmeId) {
        if (this.portIdToNode.hasOwnProperty(gmeId)) {
            this.removePort(gmeId);
        } else {
            EasyDAGWidget.prototype.removeNode.call(this, gmeId);
            this.refreshThumbnail();
        }
    };

    PipelineEditorWidget.prototype.removePort = function(portId) {
        var nodeId = this.portIdToNode[portId];
        if (this.items[nodeId]) {
            this.items[nodeId].removePort(portId);
            this.refreshUI();
        }
    };

    PipelineEditorWidget.prototype.disconnectPort = function(portId, connId) {
        this.removeConnection(connId);
    };

    PipelineEditorWidget.prototype.connectPort = function(nodeId, id, isOutput) {
        this._logger.info('port ' + id + ' has been clicked! (', isOutput, ')');
        if (this.PORT_STATE === STATE.DEFAULT) {
            this.srcPortToConnectArgs = arguments;
            this.startPortConnection(nodeId, id, isOutput);
        } else if (this._selectedPort !== id) {
            this._logger.info('connecting ' + this._selectedPort + ' to ' + id);
            var src = !isOutput ? this._selectedPort : id,
                dst = isOutput ? this._selectedPort : id;

            this.createConnection(src, dst);
        } else if (!this._selectedPort) {
            this._logger.error(`Invalid connection state: ${this.PORT_STATE} w/ ${this._selectedPort}`);
            this.resetPortState();
        }
    };

    PipelineEditorWidget.prototype.startPortConnection = function(nodeId, id, isOutput) {
        var existingMatches = this.getExistingPortMatches(id, isOutput),
            item = this.items[nodeId];
        
        // Hide all ports except 'id' on 'nodeId'
        this._selectedPort = id;
        item.showPorts(id, !isOutput);

        // Get all existing potential port destinations for the id
        existingMatches.forEach(match =>
            this.showPorts(match.nodeId, match.portIds, isOutput)
        );

        // Show the 'add' button
        // TODO

        this.PORT_STATE = STATE.CONNECTING;
    };

    PipelineEditorWidget.prototype.onDeselect =
    PipelineEditorWidget.prototype.resetPortState = function() {
        // Reset connecting state
        this._itemsShowingPorts.forEach(item => item.hidePorts());
        this.PORT_STATE = STATE.DEFAULT;
    };

    PipelineEditorWidget.prototype.showPorts = function(nodeId, portIds, areInputs) {
        var item = this.items[nodeId];
        item.showPorts(portIds, areInputs);
        this._itemsShowingPorts.push(item);
    };

    // No extra buttons - just the empty message!
    PipelineEditorWidget.prototype.refreshExtras =
        PipelineEditorWidget.prototype.updateEmptyMsg;

    PipelineEditorWidget.prototype.refreshConnections = function() {
        // Update the connections to they first update their start/end points
        var connIds = Object.keys(this.connections),
            src,
            dst,
            conn;

        for (var i = connIds.length; i--;) {
            conn = this.connections[connIds[i]];

            // Update the start/end point
            src = this.items[conn.src];
            conn.setStartPoint(src.getPortLocation(conn.srcPort));

            dst = this.items[conn.dst];
            conn.setEndPoint(dst.getPortLocation(conn.dstPort, true));
            
            conn.redraw();
        }
    };

    //////////////////// Action Overrides ////////////////////

    PipelineEditorWidget.prototype.onAddItemSelected = function(item, selected) {
        this.createConnectedNode(item.id, selected.node.id);
    };

    //////////////////// Execution Support ////////////////////

    PipelineEditorWidget.prototype.initExecs = function(execCntr) {
        this.execTabOpen = false;
        this.executions = {};
        // Add the container for the execution info
        this.$execCntr = execCntr;
        this.$execCntr.addClass('panel panel-success');

        // Add click to expand
        this.$execHeader = $('<div>', {class: 'execution-header panel-header'});
        this.$execCntr.append(this.$execHeader);

        this.$execBody = $('<table>', {class: 'table'});
        var thead = $('<thead>'),
            tr = $('<tr>'),
            td = $('<td>');

        // Create the table header
        td.text('Name');
        tr.append(td);
        td = td.clone();
        td.text('Creation Date');
        tr.append(td);
        tr.append($('<td>'));
        thead.append(tr);
        this.$execBody.append(thead);

        // Create the table header
        this.$execContent = $('<tbody>');
        this.$execBody.append(this.$execContent);

        this.$execCntr.append(this.$execBody);

        this.$execHeader.on('click', this.toggleExecutionTab.bind(this));
        this.updateExecutions();
    };

    PipelineEditorWidget.prototype.addExecution =
    PipelineEditorWidget.prototype.updateExecution = function(desc) {
        this.executions[desc.id] = desc;
        this.updateExecutions();
    };

    PipelineEditorWidget.prototype.removeExecution = function(id) {
        delete this.executions[id];
        this.updateExecutions();
    };

    PipelineEditorWidget.prototype._updateExecutions = function() {
        var keys = Object.keys(this.executions),
            hasExecutions = !!keys.length,
            msg = `${keys.length || 'No'} Associated Execution` +
                (keys.length === 1 ? '' : 's');

        // Update the appearance
        if (this.execTabOpen && hasExecutions) {
            var execs = keys.map(id => this.executions[id])
                    .sort((a, b) => a.createdAt < b.createdAt ? -1 : 1)
                    .map(exec => this.createExecutionRow(exec));

            // Create the body of the tab
            this.$execContent.empty();
            execs.forEach(html => this.$execContent.append(html));

            this.$execContent.height(200);
            this.$execBody.show();
        } else {
            // Set the height to 0
            this.$execBody.hide();
            this.$execContent.height(0);
            this.execTabOpen = false;
        }
        this.$execHeader.text(msg);
    };

    PipelineEditorWidget.prototype.createExecutionRow = function(exec) {
        var row = $('<tr>'),
            title = $('<td>', {class: 'execution-name'}),
            timestamp = $('<td>'),
            className = Utils.ClassForJobStatus[exec.status] || '',
            date = Utils.getDisplayTime(exec.createdAt),
            rmIcon = $(REMOVE_ICON);

        timestamp.text(date);

        title.append($('<a>').text(exec.name));
        title.on('click',
            () => WebGMEGlobal.State.registerActiveObject(exec.id));

        // Add the remove icon
        rmIcon.on('click', () => this.deleteExecution(exec.id));
        row.append(title, timestamp, rmIcon);
        row[0].className = className;
        return row;
    };

    PipelineEditorWidget.prototype.toggleExecutionTab = function() {
        this.execTabOpen = !this.execTabOpen;
        this.updateExecutions();
    };

    ////////////////////////// Action Overrides //////////////////////////
    PipelineEditorWidget.prototype.selectTargetFor = function(itemId) {
        // If it is an 'ArtifactLoader', then we will need to add 'upload artifact'
        // options
        if (this.items[itemId].desc.baseName === 'ArtifactLoader') {
            return this.selectTargetForLoader.apply(this, arguments);
        } else if (this.isArchitecturePtr.apply(this, arguments)) {
            // Create new architecture from the "set ptr" dialog
            return this.selectArchitectureTarget.apply(this, arguments);
        } else {
            return EasyDAGWidget.prototype.selectTargetFor.apply(this, arguments);
        }
    };

    PipelineEditorWidget.prototype.addCreationNode = function(name, targets) {
        var nodeId = targets.length ? targets[0].node.id : null,
            creationNode;

        creationNode = {
            node: {
                id: `creation-node-${name}`,
                name: name,
                class: 'create-node',
                attributes: {},
                Decorator: this.getDecorator(nodeId)
            }
        };

        targets.push(creationNode);
        return creationNode.node.id;
    };

    PipelineEditorWidget.prototype.selectArchitectureTarget = function(itemId, ptr, filter) {
        return this.selectTargetWithCreationNode('New Architecture',
            DeepForge.create.Architecture, itemId, ptr, filter);
    };

    PipelineEditorWidget.prototype.selectTargetForLoader = function(itemId, ptr, filter) {
        return this.selectTargetWithCreationNode('Upload Artifact',
            DeepForge.create.Artifact, itemId, ptr, filter);
    };

    PipelineEditorWidget.prototype.selectTargetWithCreationNode = function(name, fn, itemId, ptr, filter) {
        var validTargets = this.getValidTargetsFor(itemId, ptr, filter),
            creationNodeId = this.addCreationNode(name, validTargets);

        // Add the 'Upload Artifact' option
        AddNodeDialog.prompt(validTargets)
            .then(selected => {
                if (selected.node.id === creationNodeId) {
                    fn();
                } else {
                    var item = this.items[itemId];
                    if (item.decorator.savePointer) {
                        return item.decorator.savePointer(ptr, selected.node.id);
                    } else {
                        this.setPointerForNode(itemId, ptr, selected.node.id);
                    }
                }
            });
    };

    ////////////////////////// Action Overrides END //////////////////////////

    ////////////////////////// Thumbnail updates //////////////////////////
    PipelineEditorWidget.prototype.getSvgDistanceDim = function(dim) {
        var maxValue = this._getMaxAlongAxis(dim),
            nodes,
            minValue;

        nodes = this.graph.nodes().map(id => this.graph.node(id));
        minValue = Math.min.apply(null, nodes.map(node => node[dim]));
        return maxValue-minValue;
    };

    PipelineEditorWidget.prototype.getSvgWidth = function() {
        return this.getSvgDistanceDim('x');
    };

    PipelineEditorWidget.prototype.getSvgHeight = function() {
        return this.getSvgDistanceDim('y');
    };

    PipelineEditorWidget.prototype.getViewBox = function() {
        var maxX = this.getSvgWidth('x'),
            maxY = this.getSvgHeight('y');

        return `0 0 ${maxX} ${maxY}`;
    };

    PipelineEditorWidget.prototype.refreshThumbnail = _.debounce(function() {
        // Get the svg...
        var svg = document.createElement('svg'),
            group = this.$svg.node(),
            child;

        svg.setAttribute('viewBox', this.getViewBox());
        for (var i = 0; i < group.children.length; i++) {
            child = $(group.children[i]);
            svg.appendChild(child.clone()[0]);
        }

        this.updateThumbnail(svg.outerHTML);
    }, 1000);

    return PipelineEditorWidget;
});
