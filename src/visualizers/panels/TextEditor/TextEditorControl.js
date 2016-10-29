/*globals define, WebGMEGlobal*/
/*jshint browser: true*/

define([
    'js/Constants',
    'js/Utils/GMEConcepts',
    'js/NodePropertyNames'
], function (
    CONSTANTS,
    GMEConcepts,
    nodePropertyNames
) {

    'use strict';

    var TextEditorControl;

    TextEditorControl = function (options) {

        this._logger = options.logger.fork('Control');

        this._client = options.client;

        // Initialize core collections and variables
        this._widget = options.widget;
        this.ATTRIBUTE_NAME = options.attributeName || 'code';  // TODO: load from config

        this._currentNodeId = null;
        this._currentNodeParentId = undefined;
        this._currentNodeHasAttr = false;
        this._embedded = options.embedded;

        this._initWidgetEventHandlers();

        this._logger.debug('ctor finished');
    };

    TextEditorControl.prototype._initWidgetEventHandlers = function () {
        this._widget.saveTextFor = (id, text) => {
            if (this._currentNodeHasAttr) {
                this.saveTextFor(id, text);
            } else {
                this._logger.warn(`Cannot save attribute ${this.ATTRIBUTE_NAME} ` +
                   `for ${id} - node doesn't have the given attribute!`);
            }
        };
        this._widget.setName = this.setName.bind(this);
    };

    TextEditorControl.prototype.saveTextFor = function (id, text, inTransaction) {
        var node = this._client.getNode(this._currentNodeId),
            name = node.getAttribute('name'),
            msg = `Updating ${this.ATTRIBUTE_NAME} of ${name} (${id})`;

        if (!inTransaction) {
            this._client.startTransaction(msg);
        }
        this._client.setAttribute(id, this.ATTRIBUTE_NAME, text);
        if (!inTransaction) {
            this._client.completeTransaction();
        }
    };

    TextEditorControl.prototype.setName = function (name) {
        var node = this._client.getNode(this._currentNodeId),
            oldName = node.getAttribute('name'),
            msg = `Renaming ${oldName} -> ${name}`;

        this._client.startTransaction(msg);
        this._client.setAttribute(this._currentNodeId, 'name', name);
        this._client.completeTransaction();
    };

    TextEditorControl.prototype.TERRITORY_RULE = {children: 0};
    TextEditorControl.prototype.selectedObjectChanged = function (nodeId) {
        var self = this;

        self._logger.debug('activeObject nodeId \'' + nodeId + '\'');

        // Remove current territory patterns
        if (self._currentNodeId) {
            self._client.removeUI(self._territoryId);
        }

        self._currentNodeId = nodeId;
        self._currentNodeParentId = undefined;
        self._currentNodeHasAttr = false;

        if (typeof self._currentNodeId === 'string') {
            var parentId = this._getParentId(nodeId);
            // Put new node's info into territory rules
            self._selfPatterns = {};

            self._currentNodeHasAttr = self._client.getNode(self._currentNodeId)
                .getValidAttributeNames().indexOf(self.ATTRIBUTE_NAME) > -1;

            if (typeof parentId === 'string') {
                self.$btnModelHierarchyUp.show();
            } else {
                self.$btnModelHierarchyUp.hide();
            }

            self._currentNodeParentId = parentId;

            self._territoryId = self._client.addUI(self, function (events) {
                self._eventCallback(events);
            });
            self._logger.debug(`TextEditor territory id is ${this._territoryId}`);

            // Update the territory
            self._selfPatterns[nodeId] = this.TERRITORY_RULE;
            self._client.updateTerritory(self._territoryId, self._selfPatterns);
        }
    };

    TextEditorControl.prototype._getParentId = function (nodeId) {
        var node = this._client.getNode(nodeId);
        return node ? node.getParentId() : null;
    };

    // This next function retrieves the relevant node information for the widget
    TextEditorControl.prototype._getObjectDescriptor = function (nodeId) {
        var nodeObj = this._client.getNode(nodeId),
            desc;

        if (nodeObj) {
            desc = {
                id: undefined,
                name: undefined,
                parentId: undefined,
                text: ''
            };

            desc.id = nodeObj.getId();
            desc.name = nodeObj.getAttribute(nodePropertyNames.Attributes.name);
            desc.parentId = nodeObj.getParentId();  // used by the 'up' button in the toolbar
            desc.text = nodeObj.getAttribute(this.ATTRIBUTE_NAME);
            desc.ownText = nodeObj.getOwnAttribute(this.ATTRIBUTE_NAME);
        }

        return desc;
    };

    /* * * * * * * * Node Event Handling * * * * * * * */
    TextEditorControl.prototype._eventCallback = function (events) {
        var i = events ? events.length : 0,
            event;

        this._logger.debug('_eventCallback \'' + i + '\' items');

        while (i--) {
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

        this._logger.debug('_eventCallback \'' + events.length + '\' items - DONE');
    };

    TextEditorControl.prototype._onLoad = function (gmeId) {
        if (this._currentNodeId === gmeId) {  // Only load the text for the current node
            var description = this._getObjectDescriptor(gmeId);
            this._widget.addNode(description);
        }
    };

    TextEditorControl.prototype._onUpdate = function (gmeId) {
        var description = this._getObjectDescriptor(gmeId);
        this._widget.updateNode(description);
    };

    TextEditorControl.prototype._onUnload = function (gmeId) {
        this._widget.removeNode(gmeId);
    };

    TextEditorControl.prototype._stateActiveObjectChanged = function (model, activeObjectId) {
        if (this._currentNodeId === activeObjectId) {
            // The same node selected as before - do not trigger
        } else {
            this.selectedObjectChanged(activeObjectId);
        }
    };

    /* * * * * * * * Visualizer life cycle callbacks * * * * * * * */
    TextEditorControl.prototype.destroy = function () {
        this._detachClientEventListeners();
        this._removeToolbarItems();

        if (this._territoryId) {
            this._client.removeUI(this._territoryId);
        }
    };

    TextEditorControl.prototype._attachClientEventListeners = function () {
        if (!this._embedded) {
            this._detachClientEventListeners();
            WebGMEGlobal.State.on('change:' + CONSTANTS.STATE_ACTIVE_OBJECT, this._stateActiveObjectChanged, this);
        }
    };

    TextEditorControl.prototype._detachClientEventListeners = function () {
        if (!this._embedded) {
            WebGMEGlobal.State.off('change:' + CONSTANTS.STATE_ACTIVE_OBJECT, this._stateActiveObjectChanged);
        }
    };

    TextEditorControl.prototype.onActivate = function () {
        this._attachClientEventListeners();
        this._displayToolbarItems();

        if (typeof this._currentNodeId === 'string') {
            WebGMEGlobal.State.registerSuppressVisualizerFromNode(true);
            WebGMEGlobal.State.registerActiveObject(this._currentNodeId);
            WebGMEGlobal.State.registerSuppressVisualizerFromNode(false);
        }
    };

    TextEditorControl.prototype.onDeactivate = function () {
        this._detachClientEventListeners();
        // TODO: Destroy the ace instance!
        this._hideToolbarItems();
    };

    /* * * * * * * * * * Updating the toolbar * * * * * * * * * */
    TextEditorControl.prototype._displayToolbarItems = function () {

        if (this._toolbarInitialized === true) {
            for (var i = this._toolbarItems.length; i--;) {
                this._toolbarItems[i].show();
            }
        } else {
            this._initializeToolbar();
        }
    };

    TextEditorControl.prototype._hideToolbarItems = function () {

        if (this._toolbarInitialized === true) {
            for (var i = this._toolbarItems.length; i--;) {
                this._toolbarItems[i].hide();
            }
        }
    };

    TextEditorControl.prototype._removeToolbarItems = function () {

        if (this._toolbarInitialized === true) {
            for (var i = this._toolbarItems.length; i--;) {
                this._toolbarItems[i].destroy();
            }
        }
    };

    TextEditorControl.prototype._initializeToolbar = function () {
        var self = this,
            toolBar = WebGMEGlobal.Toolbar;

        this._toolbarItems = [];

        this._toolbarItems.push(toolBar.addSeparator());

        /************** Go to hierarchical parent button ****************/
        this.$btnModelHierarchyUp = toolBar.addButton({
            title: 'Go to parent',
            icon: 'glyphicon glyphicon-circle-arrow-up',
            clickFn: function (/*data*/) {
                WebGMEGlobal.State.registerActiveObject(self._currentNodeParentId);
            }
        });
        this._toolbarItems.push(this.$btnModelHierarchyUp);
        this.$btnModelHierarchyUp.hide();

        /************** Checkbox example *******************/

        this._toolbarInitialized = true;
    };

    return TextEditorControl;
});
