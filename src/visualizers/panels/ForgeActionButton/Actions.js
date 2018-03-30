/*globals define, WebGMEGlobal*/
// These are actions defined for specific meta types. They are evaluated from
// the context of the ForgeActionButton
define([
    './LibraryDialog',
    'panel/FloatingActionButton/styles/Materialize',
    'q',
    'js/RegistryKeys',
    'deepforge/globals',
    'deepforge/Constants'
], function(
    LibraryDialog,
    Materialize,
    Q,
    REGISTRY_KEYS,
    DeepForge
) {
    ////////////// Downloading files //////////////
    var downloadAttrs = [
            'data',
            'execFiles'
        ],
        download = {};

    downloadAttrs.forEach(attr => {
        download[attr] = function() {
            return downloadButton.call(this, attr);
        };
    });

    // Add download model button
    var downloadButton = function(attr) {
        var id = this._currentNodeId,
            node = this.client.getNode(id),
            hash = node.getAttribute(attr);

        if (hash) {
            return '/rest/blob/download/' + hash;
        }
        return null;
    };

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
            action: function(event) {
                this.runExecutionPlugin(pluginId, {useSecondary: event.shiftKey});
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
                href: download.data  // function to create href url
            }
        ],
        Job: [
            makeRestartButton('Job', 'ExecuteJob'),
            {
                name: 'Download Execution Files',
                icon: 'play_for_work',
                priority: 1,
                href: download.execFiles
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
                    this.stopJob();
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
                action: function() {
                    this.exportPipeline()
                        .then(result => {
                            Materialize.toast('Export successful!', 2000);
                            // Download the result!
                            this.downloadFromBlob(result.artifacts[0]);
                            result.__unread = true;
                            this.results.push(result);
                            this._updatePluginBtns();
                        })
                        .fail(err => {
                            this.logger.warn('Pipeline export failed:', err);
                            Materialize.toast(`Export failed: ${err}`, 4000);
                        });
                }
            }
        ]
    };
});
