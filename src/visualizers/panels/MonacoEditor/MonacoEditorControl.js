/*globals define, _*/

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

    function MonacoEditorControl(options) {

        this._logger = options.logger.fork('Control');

        this._client = options.client;

        // Initialize core collections and variables
        this._widget = options.widget;

        this.ATTRIBUTE_NAME = options.attributeName || 'code';

        this.defaultTemplate = _.template(options.defaultTemplate || '');

        this._currentNodeId = null;
        this._currentNodeParentId = undefined;
        this._currentNodeHasAttr = false;
        this._embedded = options.embedded;

        this._initWidgetEventHandlers();

        this._logger.debug('ctor finished');
    }

    MonacoEditorControl.prototype._initWidgetEventHandlers = function () {
        this._widget.saveTextFor = (id, text) => {
            if(this._currentNodeHasAttr) {
                this.saveTextFor(id, text);
            } else {
                this._logger.warn(`Cannot save attribute ${this.ATTRIBUTE_NAME} ` +
                    `for ${id} - node doesn't have the given attribute!`);
            }
        };

        this._widget.setName = this.setName.bind(this);
    };

    MonacoEditorControl.prototype.saveTextFor = function (id, text, inTransaction) {
        const node = this._client.getNode(this._currentNodeId),
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

    MonacoEditorControl.prototype.setName = function (name) {
        var node = this._client.getNode(this._currentNodeId),
            oldName = node.getAttribute('name'),
            msg = `Renaming ${oldName} -> ${name}`;

        this._client.startTransaction(msg);
        this._client.setAttribute(this._currentNodeId, 'name', name);
        this._client.completeTransaction();
    };

    MonacoEditorControl.prototype.TERRITORY_RULE = {children: 0};
    MonacoEditorControl.prototype.selectedObjectChanged = function (nodeId) {
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

            self._currentNodeParentId = parentId;

            self._territoryId = self._client.addUI(self, function (events) {
                const node = self._client.getNode(self._currentNodeId);
                self._currentNodeHasAttr = node && node.getValidAttributeNames().includes(self.ATTRIBUTE_NAME);

                self._eventCallback(events);
            });
            self._logger.debug(`TextEditor territory id is ${this._territoryId}`);

            // Update the territory
            self._selfPatterns[nodeId] = this.TERRITORY_RULE;
            self._client.updateTerritory(self._territoryId, self._selfPatterns);
        }
    };

    MonacoEditorControl.prototype._getParentId = function (nodeId) {
        var node = this._client.getNode(nodeId);
        return node ? node.getParentId() : null;
    };


    MonacoEditorControl.prototype._getDefaultText = function (node) {
        const attrs = node.getAttributeNames()
            .map(attrName => [attrName, node.getAttribute(attrName)]);
        const nodeData = _.object(attrs);
        return this.defaultTemplate(nodeData);
    };

    MonacoEditorControl.prototype._getObjectDescriptor = function (nodeId) {
        const node = this._client.getNode(nodeId);

        if (node) {
            return {
                id: node.getId(),
                name: node.getAttribute(nodePropertyNames.Attributes.name),
                parentId: node.getParentId(),
                text: node.getAttribute(this.ATTRIBUTE_NAME) || this._getDefaultText(node),
                ownText: node.getOwnAttribute(this.ATTRIBUTE_NAME),
            };
        }
    };

    /* * * * * * * * Node Event Handling * * * * * * * */
    MonacoEditorControl.prototype._eventCallback = function (events) {
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

    MonacoEditorControl.prototype._onLoad = function (gmeId) {
        if (this._currentNodeId == gmeId) {
            var description = this._getObjectDescriptor(gmeId);
            this._widget.addNode(description);
        }
    };

    MonacoEditorControl.prototype._onUpdate = function (gmeId) {
        var description = this._getObjectDescriptor(gmeId);
        this._widget.updateNode(description);
    };

    MonacoEditorControl.prototype._onUnload = function (gmeId) {
        this._widget.removeNode(gmeId);
    };

    MonacoEditorControl.prototype._stateActiveObjectChanged = function (model, activeObjectId) {
        if (this._currentNodeId === activeObjectId) {
            // The same node selected as before - do not trigger
        } else {
            this.selectedObjectChanged(activeObjectId);
        }
    };

    /* * * * * * * * Visualizer life cycle callbacks * * * * * * * */
    MonacoEditorControl.prototype.destroy = function () {
        this._detachClientEventListeners();
        if (this._territoryId) {
            this._client.removeUI(this._territoryId);
        }

    };

    MonacoEditorControl.prototype._attachClientEventListeners = function () {
        if (!this._embedded) {
            this._detachClientEventListeners();
            WebGMEGlobal.State.on('change:' + CONSTANTS.STATE_ACTIVE_OBJECT, this._stateActiveObjectChanged, this);
        }
    };

    MonacoEditorControl.prototype._detachClientEventListeners = function () {
        if (!this._embedded) {
            WebGMEGlobal.State.off('change:' + CONSTANTS.STATE_ACTIVE_OBJECT, this._stateActiveObjectChanged);
        }
    };

    MonacoEditorControl.prototype.onActivate = function () {
        this._attachClientEventListeners();

        if (typeof this._currentNodeId === 'string') {
            WebGMEGlobal.State.registerSuppressVisualizerFromNode(true);
            WebGMEGlobal.State.registerActiveObject(this._currentNodeId);
            WebGMEGlobal.State.registerSuppressVisualizerFromNode(false);
        }
    };

    MonacoEditorControl.prototype.onDeactivate = function () {
        this._detachClientEventListeners();
        // this._widget.destroy();
    };

    return MonacoEditorControl;
});
