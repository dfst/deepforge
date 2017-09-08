/*globals define */
/*jshint browser: true*/

define([
    'panels/TextEditor/TextEditorControl',
    'text!./boilerplate.ejs',
    'deepforge/viz/OperationControl',
    'deepforge/OperationCode',
    'deepforge/viz/Execute',
    'deepforge/Constants',
    'underscore'
], function (
    TextEditorControl,
    CodeTemplate,
    OperationControl,
    OperationCode,
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
            // TODO: Update this to use the code object
            var operation = new OperationCode(code),
                currentInputs = operation.getInputs().map(input => input.name),
                name = this._client.getNode(this._currentNodeId).getAttribute('name');

            // Check for input nodes to remove
            if (currentInputs[0] === 'self') currentInputs.shift();

            var msg = `Updating ${name} operation code`;
            var refs = this.getCurrentReferences(this._currentNodeId);
            var allAttrs = operation.getAttributes();

            this._client.startTransaction(msg);
            // update the attributes
            // TODO
            //
            // If a new ctor arg shows up, assume it is an attribute (default type: string)
            // Infer type based off default value
            // TODO
            //
            var oldAttrs = this.getAttributeNames(this._currentNodeId),
                value,
                index,
                attr;

            for (var i = 0; i < allAttrs.length; i++) {
                attr = allAttrs[i];
                index = oldAttrs.indexOf(attr.name);
                if (index === -1) {
                    // make sure it isn't a reference
                    if (refs.indexOf(attr.name) === -1) {
                        if (attr.default) {
                            if (attr.default._astname === 'Name' && /True|False/.test(attr.default.id.v)) {
                                value = attr.default.id.v === 'True';
                            } else if (attr.default._astname === 'Num') {
                                value = attr.default.n.v;
                            } else if (attr.default._astname === 'str') {
                                value = attr.default.s.v;
                            }
                        }
                        this.addAttribute(this._currentNodeId, attr.name, value);
                    }
                } else {
                    oldAttrs.splice(index, 1);
                }
            }
            // TODO: handle the remaining oldAttrs (to remove)

            // update the references (removal only)
            var oldRefs = _.difference(refs, allAttrs);
            oldRefs.forEach(name => this.removeReference(this._currentNodeId, name));

            // update the inputs
            this.synchronize(
                currentInputs,
                this.getDataNames(this._currentNodeId, true),
                input => this.addInputData(this._currentNodeId, input),
                input => this.removeInputData(this._currentNodeId, input)
            );

            // update the outputs
            this.synchronize(
                operation.getOutputs().map(input => input.name),
                this.getDataNames(this._currentNodeId),
                output => this.removeOutputData(this._currentNodeId, output),
                output => this.addOutputData(this._currentNodeId, output)
            );

            TextEditorControl.prototype.saveTextFor.call(this, id, code, true);
            this._client.completeTransaction();
        } catch (e) {
            this._logger.debug(`failed parsing operation: ${e}`);
            return TextEditorControl.prototype.saveTextFor.call(this, id, code);
        }
    };

    OperationCodeEditorControl.prototype.synchronize = function(l1, l2, addFn, rmFn) {
        var changes = this.getChangedValues(l1, l2);
        changes[0].forEach(addFn);
        changes[1].forEach(rmFn);
    };

    OperationCodeEditorControl.prototype.getChangedValues = function(newList, oldList) {
        return [
            _.difference(newList, oldList),  // new elements (to create)
            _.difference(oldList, newList)  // old elements (to remove)
        ];
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
