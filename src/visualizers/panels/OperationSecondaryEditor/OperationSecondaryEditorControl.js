/*globals define*/

define([
    'panels/TabbedTextEditor/TabbedTextEditorControl',
    'panels/OperationInterfaceEditor/OperationInterfaceEditorPanel',
    'panels/OperationDepEditor/OperationDepEditorPanel',
    'underscore',
], function (
    TabbedEditorControl,
    InterfaceEditor,
    DependencyEditor,
    _,
) {

    'use strict';

    function OperationSecondaryEditorControl(options) {
        TabbedEditorControl.call(this, options);
    }

    OperationSecondaryEditorControl.prototype = Object.create(TabbedEditorControl.prototype);

    OperationSecondaryEditorControl.prototype.selectedObjectChanged = function (nodeId) {
        // Remove current territory patterns
        if (this._currentNodeId) {
            this._client.removeUI(this._territoryId);
        }

        this._currentNodeId = nodeId;

        if (typeof this._currentNodeId === 'string') {
            // Put new node's info into territory rules
            this._selfPatterns = {};
            this._selfPatterns[nodeId] = {children: 0};  // Territory "rule"

            this._territoryId = this._client.addUI(this, events => this._eventCallback(events));

            this._client.updateTerritory(this._territoryId, this._selfPatterns);
        }
    };

    OperationSecondaryEditorControl.prototype._initWidgetEventHandlers = function () {
        this._widget.onTabSelected = id => this.onTabSelected(id);
        this._widget.addNewFile =
        this._widget.onDeleteTab =
        this._widget.setTabName = function nop() {return;};
    };

    OperationSecondaryEditorControl.prototype.onTabSelected = function (tabId) {
        const PanelClass = this.isInterfaceTab(tabId) ? InterfaceEditor : DependencyEditor;
        this.setEditor(PanelClass);
        this.setEditorNode(this._currentNodeId);
    };

    OperationSecondaryEditorControl.prototype.isInterfaceTab = function (tabId) {
        const [interfaceTabId] = this.getTabIds(this._currentNodeId);
        return interfaceTabId === tabId;
    };

    OperationSecondaryEditorControl.prototype._onLoad = function (gmeId) {
        const tabs = this.getTabData(gmeId);
        tabs.forEach(tabData => this._widget.addTab(tabData));
    };

    OperationSecondaryEditorControl.prototype._onUpdate = function (gmeId) {
        const tabs = this.getTabData(gmeId);
        tabs.forEach(tabData => this._widget.updateTab(tabData));
    };

    OperationSecondaryEditorControl.prototype._onUnload = function (gmeId) {
        const tabIds = this.getTabIds(gmeId);
        tabIds.forEach(tabId => this._widget.removeTab(tabId));
    };

    OperationSecondaryEditorControl.prototype.getTabData = function (gmeId) {
        const idsAndNames = _.zip(this.getTabIds(gmeId), this.getTabNames());
        const supportedActions = {
            delete: false,
            rename: false
        };

        return idsAndNames.map(idAndName => {
            const [id, name] = idAndName;
            return {id, name, supportedActions};
        });
    };

    OperationSecondaryEditorControl.prototype.getTabNames = function () {
        return ['Operation Interface', 'Environment'];
    };

    OperationSecondaryEditorControl.prototype.getTabIds = function (gmeId) {
        return this.getTabNames().map(name => `${name.toLowerCase()}:${gmeId}`);
    };

    return OperationSecondaryEditorControl;
});
