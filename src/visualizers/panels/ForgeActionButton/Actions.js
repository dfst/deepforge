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

    var UPLOAD_PLUGIN = 'ImportArtifact',
        DATA_TYPE_CONFIG = {
            name: 'dataTypeId',
            displayName: 'Data Type Id',
            valueType: 'string',
            valueItems: []
        };
    var uploadArtifact = function() {
        // Get the data types
        var dataBase,
            dataBaseId,
            metanodes = this.client.getAllMetaNodes(),
            dataTypes = [];  // TODO

        dataBase = metanodes.find(n => n.getAttribute('name') === 'Data');

        if (!dataBase) {
            this.logger.error('Could not find the base Data node!');
            return;
        }

        dataBaseId = dataBase.getId();
        dataTypes = metanodes.filter(n => this.client.isTypeOf(n.getId(), dataBaseId))
            .map(node => node.getAttribute('name'));

        this.logger.info(`Found ${dataTypes.length} data types`);

        // Add the target type to the pluginMetadata... hacky :/
        // FIXME: this should create it's own plugin dialog which allows
        // users to select the data type
        var metadata = WebGMEGlobal.allPluginsMetadata[UPLOAD_PLUGIN], 
            config = metadata.configStructure
                .find(opt => opt.name === DATA_TYPE_CONFIG.name);

        if (!config) {
            config = DATA_TYPE_CONFIG;
            WebGMEGlobal.allPluginsMetadata[UPLOAD_PLUGIN].configStructure.push(config);
        }

        config.valueItems = dataTypes;
        config.value = dataTypes[0];

        WebGMEGlobal.InterpreterManager.configureAndRun(metadata, (result) => {
            if (!result) {
                Materialize.toast('Artifact upload failed!', 2000);
                return;
            }
            this.logger.info('Finished uploading ' + UPLOAD_PLUGIN);
            Materialize.toast('Artifact upload complete!', 2000);
        });
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

    return {
        // Meta nodes
        MyPipelines_META: [
            {
                name: 'Create new pipeline',
                icon: 'queue',
                action: DeepForge.create.Pipeline
            }
        ],
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
                action: uploadArtifact
            }
        ],
        Operation_META: [
            {
                name: 'Return to Pipeline',
                icon: 'input',
                action: returnToLast.bind(null, 'Pipeline')
            }
        ],
        Layer_META: [
            {
                name: 'Return to Architecture',
                icon: 'input',
                action: returnToLast.bind(null, 'Architecture')
            }
        ],

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
                name: 'Download Execution Files',
                icon: 'play_for_work',
                href: download.execFiles
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
            },
            {
                name: 'Create new node',
                icon: 'queue',
                priority: 2,
                action: function() {
                    this.addOperation();
                }
            }
        ]
    };
});
