/*globals define, $, WebGMEGlobal*/
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
    var FILE_UPLOAD_INPUT = $('<input type="file" />');

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

    var importTorch = function() {
        var pluginId = 'ImportTorch',
            context = this.client.getCurrentPluginContext(pluginId),
            fileInput = FILE_UPLOAD_INPUT.clone();

        // Prompt for the file
        fileInput.on('change', event => this.uploadFile(event)
            .then(hash => {
                // Run the plugin in the browser (set namespace)
                context.managerConfig.namespace = 'nn';
                context.pluginConfig = {
                    srcHash: hash
                };
                return Q.ninvoke(this.client, 'runBrowserPlugin', pluginId, context);
            })
            .then(res => {
                Materialize.toast(res.messages[0].message, 2000);
            })
            .fail(err => Materialize.toast(`Import failed: ${err}`, 2000))
                
        );
        fileInput.click();
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
        MyDataTypes_META: [
            {
                name: 'Create new primitive data type',
                icon: 'add',
                action: DeepForge.create.Primitive
            },
            {
                name: 'Create new class',
                icon: 'add',
                action: DeepForge.create.Complex
            }
        ],
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
        MyResources_META: [
            {
                name: 'Import library',
                icon: 'library_add',
                action: function() {
                    // Open the modal with the library dialog
                    // TODO
                    let dialog = new LibraryDialog(this.logger);
                    dialog.show();
                    // Open the modal with the library dialog
                    // TODO

                    // How do I import a library? Check the library importer
                    // TODO
                }
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
