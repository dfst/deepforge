/*globals define, _ */
/*jshint browser: true*/

// This editor will be a split screen view w/ the operation code on the left
// and the terminal on the right.
//
// However, if the job is contained in a "snapshotted" execution, then it will
// be considered read only and only show the terminal output
define([
    'panels/TilingViz/TilingVizPanel',
    'panels/OutputViewer/OutputViewerPanel',
    'panels/OperationCodeEditor/OperationCodeEditorPanel',
    'deepforge/viz/Execute',
    'deepforge/Constants',
    'js/Constants',
], function (
    TilingViz,
    OutputViewer,
    OperationCodeEditor,
    Execute,
    CONSTANTS,
    GME_CONSTANTS,
) {
    'use strict';

    var JobEditorPanel;

    JobEditorPanel = function (layoutManager, params) {
        TilingViz.call(this, layoutManager, params);
        Execute.call(this, this._client, this.logger);
        this.readOnly = false;
    };

    //inherit from PanelBaseWithHeader
    _.extend(
        JobEditorPanel.prototype,
        Execute.prototype,
        TilingViz.prototype
    );

    JobEditorPanel.prototype.getPanels = function () {
        if (this.readOnly) {
            return [OutputViewer];
        } else {
            return [OperationCodeEditor, OutputViewer];
        }
    };

    JobEditorPanel.prototype.selectedObjectChanged = function (nodeId) {
        const node = this._client.getNode(nodeId);

        if (typeof nodeId === 'string') {
            const typeId = node.getMetaTypeId();
            const type = this._client.getNode(typeId);
            const typeName = type.getAttribute('name');

            if (typeName !== 'Job') {
                this.logger.error(`Invalid node type for JobEditor: ${typeName}`);
                return;
            }

            const executionId = node.getParentId();
            const execution = this._client.getNode(executionId);

            // If the current node is in a snapshotted execution, only show the log
            // viewer
            const isReadOnly = execution.getAttribute('snapshot') || 
                node.getAttribute('name') === CONSTANTS.OP.INPUT ||
                node.getAttribute('name') === CONSTANTS.OP.OUTPUT;

            if (this.readOnly !== isReadOnly) {
                this.readOnly = isReadOnly;
                this.logger.info(`readonly set to ${this.readOnly}`);
                this.updatePanels();
            }

            // The OperationCodeEditor should receive the
            if (!this.readOnly) {
                // Pass a reference to the panel
                this._panels[0].control.currentJobId = nodeId;

                // Get the operation base node id and pass it to OpCodeEditor selObjChanged
                if (this._territoryId) {
                    this._client.removeUI(this._territoryId);
                }
                this._territoryId = this._client.addUI(this,
                    this.onOperationEvents.bind(this));

                // Update the territory
                this._territory = {};
                this._territory[nodeId] = {children: 1};

                this._client.updateTerritory(this._territoryId, this._territory);
            }

            // update the OutputViewer controller
            var i = this._panels.length;
            this._panels[i-1].control.selectedObjectChanged(nodeId);
            // Check if the job needs to be reconnected
            if (!this.isReadOnly()) {
                this.checkJobExecution(node);
            }
        }
    };

    JobEditorPanel.prototype.onOperationEvents = function (events) {
        var event = events.find(event => {
            if (event.etype === GME_CONSTANTS.TERRITORY_EVENT_LOAD) {
                // Check if the eid is an Operation
                var typeId = this._client.getNode(event.eid).getMetaTypeId(),
                    type = this._client.getNode(typeId),
                    metaBaseId = type && type.getBaseId(),
                    typeName;

                if (metaBaseId) {
                    typeName = this._client.getNode(metaBaseId).getAttribute('name');
                }

                return typeName === 'Operation';
            }
        });

        if (event && !this.readOnly) {
            var opNode = this._client.getNode(event.eid),
                opDefId = opNode.getMetaTypeId();

            this._panels[0].control.selectedObjectChanged(opDefId);
            this._panels[0].control.offsetNodeChanged(event.eid);
        }
    };

    return JobEditorPanel;
});
