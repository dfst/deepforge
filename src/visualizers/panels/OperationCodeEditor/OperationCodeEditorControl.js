/*globals define */
/*jshint browser: true*/

define([
    'panels/TextEditor/TextEditorControl',
    'text!./boilerplate.ejs',
    'deepforge/viz/OperationControl',
    'deepforge/OperationParser',
    'deepforge/viz/Execute',
    'deepforge/Constants',
    'underscore'
], function (
    TextEditorControl,
    CodeTemplate,
    OperationControl,
    OperationParser,
    Execute,
    CONSTANTS,
    _
) {

    'use strict';

    var OperationCodeEditorControl;
    var GenerateBoilerplate = _.template(CodeTemplate);

    OperationCodeEditorControl = function (options) {
        options.attributeName = 'code';
        TextEditorControl.call(this, options);
        Execute.call(this, this._client, this._logger);
        this.currentJobId = null;
    };

    _.extend(
        OperationCodeEditorControl.prototype,
        OperationControl.prototype,
        TextEditorControl.prototype,
        Execute.prototype
    );

    OperationCodeEditorControl.prototype._initWidgetEventHandlers = function () {
        TextEditorControl.prototype._initWidgetEventHandlers.call(this);
        this._widget.getOperationAttributes = this.getOperationAttributes.bind(this);
        this._widget.executeOrStopJob = this.executeOrStopJob.bind(this);
    };

    OperationCodeEditorControl.prototype.TERRITORY_RULE = {children: 3};
    OperationCodeEditorControl.prototype._getObjectDescriptor = function (id) {
        var desc = TextEditorControl.prototype._getObjectDescriptor.call(this, id),
            node = this._client.getNode(id);

        // Add the inputs, outputs, references, and attributes
        desc.inputs = this.getOperationInputs(node).map(id => this.formatIO(id));
        desc.outputs = this.getOperationOutputs(node).map(id => this.formatIO(id));
        desc.references = node.getPointerNames().filter(name => name !== 'base');

        // Create the boilerplate operation code, if applicable
        if (!desc.ownText) {
            desc.text = GenerateBoilerplate(desc);
        }
        return desc;
    };

    // This will be changed when the input/output reps are updated (soon)
    OperationCodeEditorControl.prototype.formatIO = function (id) {
        // parse arguments are in the form 'arg: Type1, arg2: Type2'
        // and return [[arg1, Type1], [arg2, Type2]]
        var node = this._client.getNode(id),
            mNode = this._client.getNode(node.getMetaTypeId());

        return [node, mNode].map(n => n.getAttribute('name'));
    };

    // input/output updates are actually activeNode updates
    OperationCodeEditorControl.prototype._onUpdate = function (id) {
        if (id === this._currentNodeId || this.hasMetaName(id, 'Data')) {
            TextEditorControl.prototype._onUpdate.call(this, this._currentNodeId);
        }
    };

    OperationCodeEditorControl.prototype.saveTextFor = function (id, code) {
        try {
            // Parse the operation implementation and detect change in inputs/outputs
            var schema = OperationParser.parse(code),
                oldInputs = this.getDataNames(this._currentNodeId, true),
                currentInputs = schema.inputs.map(input => input.name),
                name = this._client.getNode(this._currentNodeId).getAttribute('name'),
                newInputs,
                rmInputs,
                oldOutputs = this.getDataNames(this._currentNodeId),
                currentOutputs = schema.outputs.map(input => input.name),
                newOutputs,
                rmOutputs;

            // Check for input nodes to remove
            if (currentInputs[0] === 'self') currentInputs.shift();
            newInputs = _.difference(currentInputs, oldInputs);
            rmInputs = _.difference(oldInputs, currentInputs);
            newOutputs = _.difference(currentOutputs, oldOutputs);
            rmOutputs = _.difference(oldOutputs, currentOutputs);

            if (rmInputs.length || newInputs.length || rmOutputs.length || newOutputs.length) {
                var msg = `Updating operation implementation for ${name}`;

                this._client.startTransaction(msg);
                TextEditorControl.prototype.saveTextFor.call(this, id, code, true);

                // update the inputs
                rmInputs.forEach(input => this.removeInputData(this._currentNodeId, input));
                newInputs.map(input => this.addInputData(this._currentNodeId, input));

                // update the outputs
                rmOutputs.forEach(output => this.removeOutputData(this._currentNodeId, output));
                newOutputs.map(output => this.addOutputData(this._currentNodeId, output));
                this._client.completeTransaction();
            } else {
                return TextEditorControl.prototype.saveTextFor.call(this, id, code);
            }
        } catch (e) {
            this._logger.debug(`failed parsing operation: ${e}`);
            return TextEditorControl.prototype.saveTextFor.call(this, id, code);
        }
    };

    OperationCodeEditorControl.prototype.getOperationAttributes = function () {
        var node = this._client.getNode(this._currentNodeId),
            attrs = node.getValidAttributeNames(),
            rmAttrs = ['name', 'code', CONSTANTS.LINE_OFFSET],
            i;

        for (var j = rmAttrs.length; j--;) {
            i = attrs.indexOf(rmAttrs[j]);
            if (i > -1) {
                attrs.splice(i, 1);
            }
        }

        return attrs;
    };

    OperationCodeEditorControl.prototype.executeOrStopJob = function () {
        var job;

        if (this.currentJobId) {  // Only if nested in a job
            job = this._client.getNode(this.currentJobId);
            if (this.isRunning(job)) {
                this.stopJob(job);
            } else {
                this.executeJob(job);
            }
        }
    };

    // Line offset handling
    OperationCodeEditorControl.prototype.offsetNodeChanged = function (id) {
        // Create a territory for this node
        if (this._offsetUI) {
            this._client.removeUI(this._offsetUI);
        }
        this._offsetNodeId = id;
        this._offsetUI = this._client.addUI(this, this.onOffsetNodeEvents.bind(this));
        this._offsetTerritory = {};
        this._offsetTerritory[id] = {children: 0};
        this._client.updateTerritory(this._offsetUI, this._offsetTerritory);
    };

    OperationCodeEditorControl.prototype.onOffsetNodeEvents = function () {
        var node = this._client.getNode(this._offsetNodeId);
        if (node) {  // wasn't a 'delete' event
            this._widget.setLineOffset(node.getAttribute(CONSTANTS.LINE_OFFSET) || 0);
        }
    };

    OperationCodeEditorControl.prototype.destroy = function () {
        TextEditorControl.prototype.destroy.call(this);
        if (this._offsetUI) {
            this._client.removeUI(this._offsetUI);
        }
    };

    return OperationCodeEditorControl;
});
