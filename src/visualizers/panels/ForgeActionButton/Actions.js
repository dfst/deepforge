/*globals define, WebGMEGlobal*/
// These are actions defined for specific meta types. They are evaluated from
// the context of the ForgeActionButton
define([
    './LibraryDialog',
    'panel/FloatingActionButton/styles/Materialize',
    'q',
    'js/RegistryKeys',
    'deepforge/globals',
    'deepforge/viz/TextPrompter',
    'deepforge/viz/StorageHelpers',
], function(
    LibraryDialog,
    Materialize,
    Q,
    REGISTRY_KEYS,
    DeepForge,
    TextPrompter,
    StorageHelpers,
) {
    var returnToLast = (place) => {
        var returnId = DeepForge.last[place];
        WebGMEGlobal.State.registerActiveObject(returnId);
    };

    var prototypeButtons = function(type, fromType) {
        return [
            {
                name: `Return to ${fromType}`,
                icon: 'input',
                priority: 2,
                color: 'teal',
                filter: () => {
                    return DeepForge.last[fromType];
                },
                action: returnToLast.bind(null, fromType)
            },
            {
                name: `Delete ${type} Definition`,
                icon: 'delete',
                priority: 1,
                color: 'red',
                action: function() {
                    // Delete and go to the last pipeline?
                    var node = this.client.getNode(this._currentNodeId),
                        name = node.getAttribute('name'),
                        msg = `Deleted ${type} Definition for "${name}"`;

                    this.deleteCurrentNode(msg);
                    setTimeout(() => Materialize.toast(msg, 2000), 10);
                    returnToLast(fromType);
                }
            }
        ];
    };

    var MyPipelinesButtons = [
        {
            name: 'Create new pipeline',
            icon: 'add',
            action: DeepForge.create.Pipeline
        }
    ];

    var makeRestartButton = function(name, pluginId, hotkeys) {
        return {
            name: 'Restart ' + name,
            icon: 'replay',
            priority: 1000,
            color: 'red',
            hotkey: hotkeys && 'shift enter',
            filter: function() {
                // Only show if stopped!
                return !this.isRunning();
            },
            action: function() {
                this.runExecutionPlugin(pluginId);
            }
        };
    };

    return {
        HOME: MyPipelinesButtons,
        MyPipelines_META: MyPipelinesButtons,
        MyResources_META: function(client, currentNode) {
            let meta = this._client.getChildrenMeta(currentNode.getId());
            let buttons = [
                {
                    name: 'Import library',
                    icon: 'library_add',
                    action: function() {
                        let dialog = new LibraryDialog(this.logger);
                        dialog.onChange = () => this.refresh();
                        dialog.show();
                        // On close, update the button
                    }
                }
            ];

            // Add a button to create a node from a library

            // Get the valid children of the given node
            let childrenIds = !meta ? [] : meta.items.map(item => item.id);
            let addButtons = childrenIds.map(id => {
                let node = client.getNode(id);
                let name = node.getAttribute('name');
                return {
                    name: `Create new ${name}`,
                    icon: 'add',
                    action: () => {
                        client.startTransaction(`Created new ${name}`);
                        let newId = client.createNode({
                            parentId: currentNode.getId(),
                            baseId: id
                        });
                        client.completeTransaction();
                        WebGMEGlobal.State.registerActiveObject(newId);
                    }
                };
            });
            // TODO: Add support for adding (inherited) children

            buttons = addButtons.concat(buttons);
            return buttons;
        },
        MyOperations_META: [
            {
                name: 'Create new operation',
                icon: 'add',
                action: DeepForge.create.Operation
            }
        ],
        MyArtifacts_META: [
            {
                name: 'Upload artifact',
                icon: 'swap_vert',
                action: DeepForge.create.Artifact
            },
            {
                name: 'Import existing data',
                icon: 'swap_horiz',
                action: DeepForge.import.Artifact
            }
        ],
        // Creating prototypes
        Operation_META: prototypeButtons('Operation', 'Pipeline'),
        Complex_META: prototypeButtons('Class', 'Operation'),
        Primitive_META: prototypeButtons('Primitive Type', 'Operation'),

        // Instances
        Data: [
            {
                name: 'Download',
                icon: 'play_for_work',
                action: async function() {
                    const node = this.client.getNode(this._currentNodeId);
                    const artifactName = node.getAttribute('name');
                    try {
                        const dataInfo = JSON.parse(node.getAttribute('data'));
                        await StorageHelpers.download(dataInfo, artifactName);
                    } catch (err) {
                        Materialize.toast(`Unable to download ${artifactName}: ${err.message}`);
                    }
                }
            }
        ],
        Job: [
            makeRestartButton('Job', 'ExecuteJob'),
            {
                name: 'Download Execution Files',
                icon: 'play_for_work',
                priority: 1,
                href: function() {
                    const id = this._currentNodeId;
                    const node = this.client.getNode(id);
                    const hash = node.getAttribute('execFiles');

                    if (hash) {
                        return '/rest/blob/download/' + hash;
                    }
                    return null;
                }
            },
            // Stop execution button
            {
                name: 'Stop Current Job',
                icon: 'stop',
                priority: 1001,
                filter: function() {
                    return this.isRunning();
                },
                action: function() {
                    this.stopExecution();
                }
            }
        ],
        Execution: [
            makeRestartButton('Execution', 'ExecutePipeline', true),
            // Stop execution button
            {
                name: 'Stop Running Execution',
                icon: 'stop',
                priority: 1001,
                hotkey: 'shift enter',
                filter: function() {
                    return this.isRunning();
                },
                action: function() {
                    this.stopExecution();
                }
            }
        ],
        Pipeline: [
            {
                name: 'Create new node',
                icon: 'add',
                priority: 2,
                action: function() {
                    this.addOperation();
                }
            },
            {
                name: 'Export Pipeline',
                icon: 'launch',
                priority: -1,
                action: async function() {
                    try {
                        const result = await this.exportPipeline();
                        Materialize.toast('Export successful!', 2000);
                        // Download the result!
                        this.downloadFromBlob(result.artifacts[0]);
                        result.__unread = true;
                        this.results.push(result);
                        this._updatePluginBtns();
                    } catch (err) {
                        this.logger.warn('Pipeline export failed:', err);
                        Materialize.toast(`Export failed: ${err}`, 4000);
                    }
                }
            },
            {
                name: 'Execute Pipeline',
                icon: 'play_arrow',
                priority: 1,
                action: function() {
                    return this.executePipeline();
                }
            }
        ],
        MyUtilities_META: [
            {
                name: 'Create new module',
                icon: 'add',
                priority: 2,
                action: function() {
                    return TextPrompter.prompt('New Module Name (eg. module.py)')
                        .then(name => this.addNewFile(name));
                }
            }
        ]
    };
});
