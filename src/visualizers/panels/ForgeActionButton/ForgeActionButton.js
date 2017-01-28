/*globals $, window, define, _, WebGMEGlobal */
/*jshint browser: true*/

define([
    'blob/BlobClient',
    'js/Utils/SaveToDisk',
    './ConfigDialog',
    'js/Constants',
    'panel/FloatingActionButton/FloatingActionButton',
    'deepforge/viz/PipelineControl',
    'deepforge/viz/NodePrompter',
    'deepforge/viz/Execute',
    './Actions',
    'widgets/EasyDAG/AddNodeDialog',
    'js/RegistryKeys',
    'js/Panels/MetaEditor/MetaEditorConstants',
    'q',
    'deepforge/globals',
    'deepforge/Constants',
    'plugin/Export/Export/format'
], function (
    BlobClient,
    SaveToDisk,
    ConfigDialog,
    GME_CONSTANTS,
    PluginButton,
    PipelineControl,
    NodePrompter,
    Execute,
    ACTIONS,
    AddNodeDialog,
    REGISTRY_KEYS,
    META_CONSTANTS,
    Q,
    DeepForge,
    Constants,
    ExportFormatDict
) {
    'use strict';

    var NEW_OPERATION_ID = '__NEW_OPERATION__';
    var ForgeActionButton= function (layoutManager, params) {
        PluginButton.call(this, layoutManager, params);
        this._client = this.client;
        this._actions = [];
        this._blobClient = new BlobClient({
            logger: this.logger.fork('BlobClient')
        });

        Execute.call(this, this.client, this.logger);
        this.initializeKeyListener();
        this.logger.debug('ctor finished');
    };

    // inherit from PanelBaseWithHeader
    _.extend(
        ForgeActionButton.prototype,
        PluginButton.prototype,
        Execute.prototype,
        PipelineControl.prototype
    );

    ForgeActionButton.prototype.initializeKeyListener = function() {
        // add key listener to parent?
        this.oldOnKeyDown = document.body.onkeydown;
        document.onkeydown = event => {
            var keys = String.fromCharCode(event.which) || '',
                names = Object.keys(this.buttons),
                btn,
                name;

            // Simple button detection
            if (event.which === 13) {
                keys = 'enter';
            }
            if (event.shiftKey) {
                keys = 'shift ' + keys;
            }

            for (var i = names.length; i--;) {
                name = names[i];
                btn = this.buttons[name];
                if (btn.hotkey && btn.hotkey === keys) {
                    btn.action.call(this, event);
                }
            }
            if (this.oldOnKeyDown) {
                this.oldOnKeyDown(event);
            }
        };
    };

    ForgeActionButton.prototype.destroy = function() {
        PluginButton.prototype.destroy.call(this);
        PipelineControl.prototype.destroy.call(this);
        document.body.onclick = this.oldOnKeyDown;
    };

    ForgeActionButton.prototype.findActionsFor = function(nodeId) {
        var node = this.client.getNode(nodeId),
            base = this.client.getNode(node.getMetaTypeId()),
            isMeta = base && base.getId() === node.getId(),
            suffix = isMeta ? '_META' : '',
            actions,
            basename;

        if (!base) {  // must be ROOT or FCO
            basename = node.getAttribute('name') || 'ROOT_NODE';
            actions = (ACTIONS[basename] || [])
                .filter(action => !action.filter || action.filter.call(this));
            return actions;
        }

        while (base && !(actions && actions.length)) {
            basename = base.getAttribute('name') + suffix;
            base = this.client.getNode(base.getBaseId());
            actions = ACTIONS[basename];
            if (actions) {
                actions = actions.filter(action => !action.filter || action.filter.call(this));
            }
        }

        return actions || [];
    };

    ForgeActionButton.prototype.onNodeLoad = function(nodeId) {
        PluginButton.prototype.onNodeLoad.call(this, nodeId);
        this.addActionsForObject(nodeId);
    };

    ForgeActionButton.prototype.addActionsForObject = function(nodeId) {
        var actions = this.findActionsFor(nodeId),
            i;

        // Remove old actions
        for (i = this._actions.length; i--;) {
            delete this.buttons[this._actions[i].name];
        }

        // Get node name and look up actions
        for (i = actions.length; i--;) {
            this.buttons[actions[i].name] = actions[i];
        }

        this._actions = actions;
        this.update();
    };

    // Helper functions REMOVE! FIXME
    ForgeActionButton.prototype.addToMetaSheet = function(nodeId, metasheetName) {
        var root = this.client.getNode(GME_CONSTANTS.PROJECT_ROOT_ID),
            metatabs = root.getRegistry(REGISTRY_KEYS.META_SHEETS),
            metatab = metatabs.find(tab => tab.title === metasheetName) || metatabs[0],
            metatabId = metatab.SetID;

        // Add to the general meta
        this.client.addMember(
            GME_CONSTANTS.PROJECT_ROOT_ID,
            nodeId,
            META_CONSTANTS.META_ASPECT_SET_NAME
        );
        this.client.setMemberRegistry(
            GME_CONSTANTS.PROJECT_ROOT_ID,
            nodeId,
            META_CONSTANTS.META_ASPECT_SET_NAME,
            REGISTRY_KEYS.POSITION,
            {
                x: 100,
                y: 100
            }
        );

        // Add to the specific sheet
        this.client.addMember(GME_CONSTANTS.PROJECT_ROOT_ID, nodeId, metatabId);
        this.client.setMemberRegistry(
            GME_CONSTANTS.PROJECT_ROOT_ID,
            nodeId,
            metatabId,
            REGISTRY_KEYS.POSITION,
            {
                x: 100,
                y: 100
            }
        );
    };

    ForgeActionButton.prototype.createNamedNode = function(baseId, isMeta) {
        var parentId = this._currentNodeId,
            newId = this.client.createNode({parentId, baseId}),
            basename = 'New' + this.client.getNode(baseId).getAttribute('name'),
            newName = this.getUniqueName(parentId, basename);

        // If instance, make the first char lowercase
        if (!isMeta) {
            newName = newName.substring(0, 1).toLowerCase() + newName.substring(1);
        }
        this.client.setAttribute(newId, 'name', newName);
        return newId;
    };

    ForgeActionButton.prototype.getUniqueName = function(parentId, basename) {
        var pNode = this.client.getNode(parentId),
            children = pNode.getChildrenIds().map(id => this.client.getNode(id)),
            name = basename,
            exists = {},
            i = 2;

        children.forEach(child => exists[child.getAttribute('name')] = true);

        while (exists[name]) {
            name = basename + '_' + i;
            i++;
        }

        return name;
    };

    ForgeActionButton.prototype.getLayerTypeDesc = function(node) {
        var decManager = this.client.decoratorManager,
            desc = {};

        desc.id = node.getId();
        desc.name = node.getAttribute('name');
        desc.baseName = desc.name;
        desc.attributes = {};
        desc.pointers = {};

        // Get the decorator
        desc.Decorator = decManager.getDecoratorForWidget('EllipseDecorator', 'EasyDAG');

        // Set the color
        desc.color = '#9e9e9e';
        return desc;
    };

    ForgeActionButton.prototype.promptLayerType = function() {
        // Prompt for the new custom layer's base type
        var metanodes = this.client.getAllMetaNodes(),
            baseLayerId = metanodes.find(n => n.getAttribute('name') === 'Layer').getId(),
            layerType,
            types;

        // PoA:
        //   - Get the layer type ids
        //   - Create the descriptors
        //     - Get the color for the given types
        //       - Move colors to a constants dir?

        // Get the layer type ids
        layerType = metanodes
            .filter(node => node.getBaseId() === baseLayerId);

        //   - Create the descriptors
        types = layerType.map(node => {
            return {
                node: this.getLayerTypeDesc(node)
            };
        });

        return AddNodeDialog.prompt(types);
    };

    ForgeActionButton.prototype.uploadFile = function(event) {
        var deferred = Q.defer(),
            file,

            files,
            afName,
            artifact;

        // cancel event and hover styling
        event.stopPropagation();
        event.preventDefault();

        // fetch FileList object
        files = event.target.files || event.dataTransfer.files;

        // should only receive one file
        if (files && files.length > 0) {
            if (files.length > 1) {
                this.logger.warn('Received multiple files. Using only the first');
            }

            afName = 'imported-architecture';
            artifact = this._blobClient.createArtifact(afName);

            file = files[0];
            artifact.addFileAsSoftLink(file.name, file, (err, hash) => {
                if (err) {
                    deferred.reject(err);
                    return;
                }
                deferred.resolve(hash);
            });
        }
        return deferred.promise;
    };

    /////////////// Expanding containers ///////////////
    ForgeActionButton.prototype.addOperation = function() {
        var ops = this.getValidInitialNodes(),
            newOperation = this.getNewOpNode();

        // Add the 'New op button'
        ops.push(newOperation);

        this.promptNode(ops, (selected, prompter) => {
            if (selected.id === NEW_OPERATION_ID) {
                prompter.destroy();
                DeepForge.create.Operation();
            } else {
                this.createNode(selected.id);
            }
        });
    };

    ForgeActionButton.prototype.getNewOpNode = function() {
        var Decorator = this.client.decoratorManager.getDecoratorForWidget(
            'OperationDecorator', 'EasyDAG');

        return {
            id: NEW_OPERATION_ID,
            class: 'create-node',
            name: 'New Operation...',
            Decorator: Decorator,
            attributes: {}
        };
    };

    ForgeActionButton.prototype.promptNode = function(nodes, selectFn) {
        // Get the absolute location of the given button
        var mainBtn = this.$el[0].children[0],
            rect = mainBtn.getBoundingClientRect(),
            panelRect,
            panelWidth = 400,
            panelHeight = 400,
            btns = this.$el.find('.tooltipped'),
            ids;

        this.$el.closeFAB();

        // Hide the tooltip
        ids = Array.prototype.map.call(btns, el => el.getAttribute('data-tooltip-id'));
        ids.map(id => $('#' + id))
            .filter(matches => matches.length)
            .forEach(tooltip => tooltip.hide());

        panelRect = {
            left: rect.right-panelWidth,
            top: rect.bottom-panelHeight,
            width: panelWidth,
            height: panelHeight
        };

        var cx = panelWidth-rect.width/2,
            cy = panelHeight-rect.width/2,
            prompter = new NodePrompter(panelRect, {cx, cy, padding: 5});

        return prompter.prompt(nodes, selectFn);
    };

    ForgeActionButton.prototype.deleteCurrentNode = function(msg) {
        var nodeId = this._currentNodeId;
        if (nodeId) {
            this.client.startTransaction(msg);
            this.client.deleteNode(nodeId);
            this.client.completeTransaction();
        }
    };

    ForgeActionButton.prototype.downloadFromBlob = function(hash) {
        this._blobClient.getMetadata(hash)
            .then(metadata => {
                var url = this._blobClient.getDownloadURL(hash),
                    name = metadata.name,
                    save = document.createElement('a');

                save.href = url;
                save.target = '_self';
                save.download = name;

                save.click();
                (window.URL || window.webkitURL).revokeObjectURL(save.href);
            })
            .fail(err => this.logger.error(`Blob download failed: ${err}`));
    };

    /// Export Pipeline Support
    ForgeActionButton.prototype.exportPipeline = function() {
        var deferred = Q.defer(),
            pluginId = 'Export',
            metadata = WebGMEGlobal.allPluginsMetadata[pluginId],
            id = this._currentNodeId,
            node = this.client.getNode(id),
            inputData,
            inputNames;

        inputData = node.getChildrenIds()
            .map(id => this.client.getNode(id))
            .filter(node => {
                var typeId = node.getMetaTypeId(),
                    type = this.client.getNode(typeId).getAttribute('name');

                return type === Constants.OP.INPUT;
            })
            .map(input => {
                var outputCntr,
                    outputIds;

                outputCntr = input.getChildrenIds()
                    .map(id => this.client.getNode(id))
                    .find(node => {
                        var typeId = node.getMetaTypeId(),
                            type = this.client.getNode(typeId).getAttribute('name');
                        return type === 'Outputs';
                    });

                // input operations only have a single output
                outputIds = outputCntr.getChildrenIds();

                if (outputIds.length === 1) {
                    return outputIds[0];
                } else if (outputIds.length > 1) {
                    this.logger.warn(`Found multiple ids for input op: ${outputIds.join(', ')}`);
                    return;
                }
            })
            .filter(outputId => !!outputId)
            .map(id => this.client.getNode(id))
            .filter(output => output.getAttribute('data'));

        // get the name of node referenced from the input op
        inputNames = inputData
            .map(node => {
                var cntrId = node.getParentId(),
                    opId = this._client.getNode(cntrId).getParentId(),
                    inputOp = this._client.getNode(opId),
                    targetNodeId = inputOp.getPointer('artifact').to;

                return this._client.getNode(targetNodeId).getAttribute('name');
            })
            .sort();

        // create config options from inputs
        var inputOpts = inputNames.map((input, index) => {
            return {
                name: inputData[index].getId(),
                displayName: input,
                description: `Export ${input} as static (non-input) content`,
                value: false,
                valueType: 'boolean',
                readOnly: false
            };
        });

        var exportFormats = Object.keys(ExportFormatDict),
            configDialog = new ConfigDialog(this.client, this._currentNodeId),
            inputConfig = _.extend({}, metadata),
            extOptions = [];

        inputConfig.configStructure = inputOpts;

        // Try to get the extension options
        if (inputOpts.length || exportFormats.length > 1|| extOptions.length) {
            configDialog.show(inputConfig, (allConfigs) => {
                var context = this.client.getCurrentPluginContext(pluginId),
                    exportFormat = allConfigs.FormatOptions.exportFormat,
                    staticInputs = Object.keys(allConfigs[pluginId]).filter(input => allConfigs[pluginId][input]);

                this.logger.debug('Exporting pipeline to format', exportFormat);
                this.logger.debug('static inputs:', staticInputs);

                context.managerConfig.namespace = 'pipeline';
                context.pluginConfig = {
                    format: exportFormat,
                    staticInputs: staticInputs,
                    extensionConfig: allConfigs.extensionConfig
                };
                return Q.ninvoke(this.client, 'runBrowserPlugin', pluginId, context)
                    .then(deferred.resolve)
                    .fail(deferred.reject);
            });
        } else {  // no options - just run the plugin!
            var context = this.client.getCurrentPluginContext(pluginId);

            this.logger.debug('Exporting pipeline to format', exportFormats[0]);

            context.managerConfig.namespace = 'pipeline';
            context.pluginConfig = {
                format: exportFormats[0],
                staticInputs: []
            };
            return Q.ninvoke(this.client, 'runBrowserPlugin', pluginId, context);
        }

        return deferred.promise;
    };

    return ForgeActionButton;
});
