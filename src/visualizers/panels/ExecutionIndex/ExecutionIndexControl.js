/*globals define, WebGMEGlobal*/
/*jshint browser: true*/

define([
    'js/Constants',
    'deepforge/utils',
    'deepforge/viz/PlotlyDescExtractor'
], function (
    CONSTANTS,
    utils,
    PlotlyDescExtractor
) {

    'use strict';

    var ExecutionIndexControl;

    ExecutionIndexControl = function (options) {

        this._logger = options.logger.fork('Control');

        this._client = options.client;
        this._embedded = options.embedded;

        // Initialize core collections and variables
        this._widget = options.widget;

        this._currentNodeId = null;
        this.displayedExecutions = {};
        this._graphsForExecution = {};
        this._graphToExec = {};
        this._pipelineNames = {};
        this._currentPlotsDataId = null;
        this._plotlyDescExtractor = new PlotlyDescExtractor(this._client);
        this.abbrToId = {};
        this.abbrFor = {};

        this._initWidgetEventHandlers();

        this._logger.debug('ctor finished');
    };

    ExecutionIndexControl.prototype._initWidgetEventHandlers = function () {
        this._widget.setDisplayedExecutions = this.setDisplayedExecutions.bind(this);
    };

    ExecutionIndexControl.prototype.setDisplayedExecutions = function (beforeClickIds, afterClickIds) {
        let addedExecutions = afterClickIds.filter(id => !beforeClickIds.includes(id));
        let removedExecutions = beforeClickIds.filter(id => !afterClickIds.includes(id));
        let added = addedExecutions.length > 0;
        let updatedExecutions = added ? addedExecutions : removedExecutions;
        this._updateGraphData(updatedExecutions, added);
    };

    ExecutionIndexControl.prototype._updateGraphData = function (id, bool) {
        this.displayedExecutions[id] = bool;
        let displayedGraphIds = Object.keys(this.displayedExecutions)
            .filter((id) => !!this.displayedExecutions[id]);
        if (this._currentPlotsDataId) {
            this._widget.removeNode(this._currentPlotsDataId);
        }
        if ( this.displayedExecCount() > 0) {
            this._consolidateGraphData(displayedGraphIds);
        }
    };

    ExecutionIndexControl.prototype._consolidateGraphData = function (graphExecIDs) {
        let graphIds = graphExecIDs.map(execId => this._graphsForExecution[execId]);
        let graphDescs = graphIds.map(id => this._getObjectDescriptor(id));
        let consolidatedDesc = this._combineGraphDesc(graphDescs);
        this._currentPlotsDataId = consolidatedDesc.id;
        let plotlyJSON = this._plotlyDescExtractor.descToPlotlyJSON(consolidatedDesc);
        plotlyJSON.type = 'graph';
        this._widget.addNode(plotlyJSON);
    };

    ExecutionIndexControl.prototype._combineGraphDesc = function (graphDescs) {
        const isMultiGraph = this.displayedExecCount() > 1;
        if (!isMultiGraph) {
            return graphDescs[0];
        } else {
            let consolidatedDesc = null;

            graphDescs.forEach((desc) => {
                if (!consolidatedDesc) {
                    consolidatedDesc = JSON.parse(JSON.stringify(desc));
                    consolidatedDesc.title = consolidatedDesc.title || `Graph`;
                } else {
                    consolidatedDesc.id += desc.id;
                    consolidatedDesc.execId += ` vs ${desc.execId}`;
                    consolidatedDesc.graphId += ` vs ${appendStringWithAbbr(desc.execId, desc.abbr)}`;
                    consolidatedDesc.title +=
                        ` vs ${appendStringWithAbbr(desc.title || 'Graph', desc.abbr)}`;
                    this._combineSubGraphsDesc(consolidatedDesc, desc.subGraphs, desc.abbr);
                }
            });
            return consolidatedDesc;
        }
    };

    ExecutionIndexControl.prototype._combineSubGraphsDesc = function(consolidatedDesc, subGraphs, abbr){
        let currentSubGraph;
        for(let i = 0; i < consolidatedDesc.subGraphs.length; i++){
            if(!subGraphs[i]) break;
            currentSubGraph = consolidatedDesc.subGraphs[i];
            currentSubGraph.title = currentSubGraph.title || `Subgraph${i+1}`;
            currentSubGraph.title += ` vs. ${subGraphs[i].title || `Subgraph${i+1}`}`;
            subGraphs[i].lines.forEach((line) => {
                let lineClone = JSON.parse(JSON.stringify(line));
                lineClone.label = (lineClone.label || `line${index}`) + ` (${abbr})`;
                currentSubGraph.lines.push(lineClone);
            });
        }
        // Check if there are more subgraphs
        let extraSubGraphIdx = consolidatedDesc.subGraphs.length;
        while(extraSubGraphIdx < subGraphs.length){
            consolidatedDesc.subGraphs.push(JSON.parse(JSON.stringify(subGraphs[extraSubGraphIdx])));
            extraSubGraphIdx++;
        }
    };

    const appendStringWithAbbr = function (str, abbr) {
        return `${str} ( ${abbr} )`;
    };

    ExecutionIndexControl.prototype.clearTerritory = function () {
        if (this._territoryId) {
            this._client.removeUI(this._territoryId);
            this._territoryId = null;
        }
    };

    /* * * * * * * * Visualizer content update callbacks * * * * * * * */
    ExecutionIndexControl.prototype.selectedObjectChanged = function (nodeId) {
        var self = this;

        self._logger.debug('activeObject nodeId \'' + nodeId + '\'');

        // Remove current territory patterns
        self.clearTerritory();
        self._currentNodeId = nodeId;

        if (typeof self._currentNodeId === 'string') {
            // Create a territory for the executions
            self._selfPatterns = {};

            self._territoryId = self._client.addUI(self, function (events) {
                self._eventCallback(events);
            });

            // Update the territory
            self._selfPatterns[nodeId] = {children: 5};
            self._client.updateTerritory(self._territoryId, self._selfPatterns);
        }
    };

    ExecutionIndexControl.prototype.getUniqAbbreviation = function (desc) {
        // Get a unique abbreviation for the given execution
        var base = utils.abbr(desc.name).toLowerCase(),
            abbr = base,
            oldAbbr = this.abbrFor[desc.id],
            i = 2;

        // Make sure it is unique!
        while (this.abbrToId[abbr] && this.abbrToId[abbr] !== desc.id) {
            abbr = base + i;
            i++;
        }

        if (oldAbbr !== undefined) {  // updating abbr
            delete this.abbrToId[oldAbbr];
        }

        this.abbrToId[abbr] = desc.id;
        this.abbrFor[desc.id] = abbr;
        return abbr;
    };

    // This next function retrieves the relevant node information for the widget
    ExecutionIndexControl.prototype._getObjectDescriptor = function (nodeId) {
        var node = this._client.getNode(nodeId),
            desc,
            base,
            type;

        if (node) {
            base = this._client.getNode(node.getBaseId());
            type = base.getAttribute('name');
            desc = {
                id: node.getId(),
                type: type,
                name: node.getAttribute('name')
            };

            if (type === 'Execution') {
                desc.status = node.getAttribute('status');
                desc.originTime = node.getAttribute('createdAt');
                desc.originId = node.getPointer('origin').to;
                desc.pipelineName = this._pipelineNames[desc.originId];
                desc.startTime = node.getAttribute('startTime');
                desc.endTime = node.getAttribute('endTime');
                this._logger.debug(`Looking up pipeline name for ${desc.name}: ${desc.pipelineName}`);
                // Add the (unique) abbreviation of the execution!
                desc.abbr = this.getUniqAbbreviation(desc);

                // Create a territory for this origin and update it!
                if (desc.originId) {
                    this._selfPatterns[desc.originId] = {children: 0};
                }
                setTimeout(() => this._client.updateTerritory(this._territoryId, this._selfPatterns), 0);
            } else if (type === 'Pipeline') {
                desc.execs = node.getMemberIds('executions');
                this._pipelineNames[desc.id] = desc.name;
            } else if (type === 'Graph') {
                desc = this.getGraphDesc(node);
            } else if (type === 'SubGraph') {
                const graphNodeId = node.getParentId();
                let graphNode = this._client.getNode(graphNodeId);
                desc = this.getGraphDesc(graphNode);
            } else if (type === 'Line') {
                const graphNodeId = this._client.getNode(node.getParentId()).getParentId();
                let graphNode = this._client.getNode(graphNodeId);
                desc = this.getGraphDesc(graphNode);
            }
        }
        return desc;
    };

    ExecutionIndexControl.prototype.getGraphDesc = function (graphNode) {
        let id = graphNode.getId();
        let desc = this._plotlyDescExtractor.getGraphDesc(graphNode);

        if (!this._graphToExec[id]) {
            this._graphsForExecution[desc.execId] = id;
            this._graphToExec[id] = desc.execId;
        }
        let displayedCnt = this.displayedExecCount(),
            execAbbr;

        if (displayedCnt > 1) {
            execAbbr = this.abbrFor[desc.execId] || this._getObjectDescriptor(desc.execId).abbr;
            desc.name = `${desc.name} (${execAbbr})`;
            desc.abbr = execAbbr;
        }

        return desc;
    };

    /* * * * * * * * Node Event Handling * * * * * * * */
    ExecutionIndexControl.prototype._eventCallback = function (events) {
        var event;

        events = events.filter(event => event.eid !== this._currentNodeId);

        this._logger.debug('received \'' + events.length + '\' events');

        for (var i = events.length; i--;) {
            event = events[i];
            switch (event.etype) {

                case CONSTANTS.TERRITORY_EVENT_LOAD:
                    this._onLoad(event.eid);
                    break;
                case CONSTANTS.TERRITORY_EVENT_UPDATE:
                    this._onUpdate(event.eid);
                    break;
                case CONSTANTS.TERRITORY_EVENT_UNLOAD:
                    this._onUnload(event.eid);
                    break;
                default:
                    break;
            }
        }

        this._logger.debug('finished processing events!');
    };

    ExecutionIndexControl.prototype._onLoad = function (gmeId) {
        var desc = this._getObjectDescriptor(gmeId);
        this._logger.debug(`Loading node of type ${desc.type}`);
        if (desc.type === 'Execution') {
            this._logger.debug('Adding node to widget...');
            this._logger.debug('desc:', desc);
            this._widget.addNode(desc);
        } else if (desc.type === 'Pipeline') {
            this.updatePipelineNames(desc);
        } else if (desc.type === 'graph' && this.isGraphDisplayed(desc)) {
            this._widget.addNode(desc);
        }
    };

    ExecutionIndexControl.prototype._onUpdate = function (gmeId) {
        var desc = this._getObjectDescriptor(gmeId);
        if (desc.type === 'Execution') {
            this._widget.updateNode(desc);
        } else if (desc.type === 'graph' && this.isGraphDisplayed(desc)) {
            this._widget.updateNode(desc);
        } else if (desc.type === 'Pipeline') {
            this.updatePipelineNames(desc);
        }
    };

    ExecutionIndexControl.prototype.updatePipelineNames = function (desc) {
        // Get all associated executions and update their pipeline name
        this._logger.debug('updating pipeline name for ' + desc.execs.join(', '));
        for (var i = desc.execs.length; i--;) {
            this._widget.updatePipelineName(desc.execs[i], desc.name);
        }

        if (desc.execs.length === 0) {
            // Executions have been deleted - no longer relevant
            this._logger.debug('pipeline has 0 executions... removing it', desc.id);
            delete this._selfPatterns[desc.id];
            delete this._pipelineNames[desc.id];
        }
    };

    ExecutionIndexControl.prototype._onUnload = function (id) {
        var execId = this._graphToExec[id],
            abbr;

        if (execId) {  // it is a graph
            delete this._graphToExec[id];
            delete this._graphsForExecution[execId];
        }
        if (this.abbrFor[id]) {
            abbr = this.abbrFor[id];
            delete this.abbrFor[id];
            delete this.abbrToId[abbr];
        }
        this._widget.removeNode(id);
    };

    ExecutionIndexControl.prototype.isGraphDisplayed = function (graph) {
        // lines are only displayed if their execution is checked
        return this.displayedExecutions[graph.execId];
    };

    ExecutionIndexControl.prototype.displayedExecCount = function () {
        return Object.keys(this.displayedExecutions)
            .map(id => this.displayedExecutions[id])
            .filter(shown => shown).length;
    };

    ExecutionIndexControl.prototype._stateActiveObjectChanged = function (model, activeObjectId) {
        if (this._currentNodeId === activeObjectId) {
            // The same node selected as before - do not trigger
        } else {
            this.selectedObjectChanged(activeObjectId);
        }
    };

    /* * * * * * * * Visualizer life cycle callbacks * * * * * * * */
    ExecutionIndexControl.prototype.destroy = function () {
        this._detachClientEventListeners();
        this.clearTerritory();
    };

    ExecutionIndexControl.prototype._attachClientEventListeners = function () {
        this._detachClientEventListeners();
        if (!this._embedded) {
            WebGMEGlobal.State.on('change:' + CONSTANTS.STATE_ACTIVE_OBJECT,
                this._stateActiveObjectChanged, this);
        }
    };

    ExecutionIndexControl.prototype._detachClientEventListeners = function () {
        if (!this._embedded) {
            WebGMEGlobal.State.off('change:' + CONSTANTS.STATE_ACTIVE_OBJECT,
                this._stateActiveObjectChanged);
        }
    };

    ExecutionIndexControl.prototype.onActivate = function () {
        this._attachClientEventListeners();

        if (typeof this._currentNodeId === 'string') {
            WebGMEGlobal.State.registerSuppressVisualizerFromNode(true);
            WebGMEGlobal.State.registerActiveObject(this._currentNodeId);
            WebGMEGlobal.State.registerSuppressVisualizerFromNode(false);
        }
    };

    ExecutionIndexControl.prototype.onDeactivate = function () {
        this._detachClientEventListeners();
    };

    return ExecutionIndexControl;
});
