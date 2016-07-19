/*globals DeepForge, define, $, Materialize, WebGMEGlobal*/
// These are actions defined for specific meta types. They are evaluated from
// the context of the ForgeActionButton
define([
    'q',
    'js/RegistryKeys',
    'deepforge/globals'
], function(
    Q,
    REGISTRY_KEYS
) {
    var FILE_UPLOAD_INPUT = $('<input type="file" />');

    var createLayer = function() {
        // Prompt the base type
        this.promptLayerType().then(selected => {
            var baseId = selected.node.id,
                typeName = this.client.getNode(baseId).getAttribute('name'),
                metanodes = this.client.getAllMetaNodes(),
                msg = `Created new custom ${typeName} layer`,
                newId,
                customLayerId,
                name;

            for (var i = metanodes.length; i--;) {
                name = metanodes[i].getAttribute('name');
                if (name === 'CustomLayer') {
                    customLayerId = metanodes[i].getId();
                    break;
                }
            }

            this.client.startTransaction(msg);

            newId = this.createNamedNode(baseId, true);
            this.addToMetaSheet(newId, 'CustomLayers');
            this.client.addMixin(newId, customLayerId);
            this.client.setRegistry(newId, REGISTRY_KEYS.IS_ABSTRACT, false);

            this.client.completeTransaction();

            WebGMEGlobal.State.registerActiveObject(newId);
        });
    };

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
                filter: () => {
                    return DeepForge.last[fromType];
                },
                action: returnToLast.bind(null, fromType)
            },
            {
                name: `Delete ${type} Definition`,
                icon: 'delete',
                priority: 1,
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
            icon: 'queue',
            action: DeepForge.create.Pipeline
        }
    ];

    return {
        HOME: MyPipelinesButtons,
        MyPipelines_META: MyPipelinesButtons,
        MyArchitectures_META: [
            {
                name: 'Create new architecture',
                icon: 'queue',
                action: DeepForge.create.Architecture
            },
            {
                name: 'Import Torch Architecture',
                icon: 'swap_vert',
                action: importTorch
            }
        ],
        MyDataTypes_META: [
            {
                name: 'Create new primitive data type',
                icon: 'queue',
                action: DeepForge.create.Primitive
            },
            {
                name: 'Create new class',
                icon: 'queue',
                action: DeepForge.create.Complex
            }
        ],
        MyLayers_META: [
            {
                name: 'Create new layer',
                icon: 'queue',
                action: createLayer
            }
        ],
        MyOperations_META: [
            {
                name: 'Create new operation',
                icon: 'queue',
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
        Layer_META: prototypeButtons('Layer', 'Architecture'),
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
            {
                name: 'Restart Job',
                icon: 'replay',
                priority: 1000,
                action: function() {
                    this.runExecutionPlugin('ExecuteJob');
                }
            },
            {
                name: 'Download Execution Files',
                icon: 'play_for_work',
                priority: 1,
                href: download.execFiles
            }
        ],
        Execution: [
            {
                name: 'Restart Execution',
                icon: 'replay',
                priority: 1000,
                action: function() {
                    this.runExecutionPlugin('ExecutePipeline');
                }
            }
        ],
        Pipeline: [
            {
                name: 'Create new node',
                icon: 'queue',
                priority: 2,
                action: function() {
                    this.addOperation();
                }
            }
        ],
        Architecture: [
            {
                name: 'Import Torch Architecture',
                icon: 'swap_vert',
                action: importTorch
            }
        ]
    };
});
