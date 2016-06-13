/*globals define, Materialize, WebGMEGlobal*/
// These are actions defined for specific meta types. They are evaluated from
// the context of the ForgeActionButton
define([
    'js/RegistryKeys',
    'js/Panels/MetaEditor/MetaEditorConstants',
    'js/Constants'
], function(
    REGISTRY_KEYS,
    META_CONSTANTS,
    CONSTANTS
) {
    var instances = [
            'Architecture',
            'Pipeline'
        ],
        metaNodes = [
            'Operation',
            'Data'
        ],
        create = {};

    var getUniqueName = function(parentId, basename) {
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

    var createNew = function(type, metasheetName) {
        // Create CNN node in the current dir
        // Get CNN node type
        var parentId = this._currentNodeId,
            newId,
            baseId;

        baseId = this.client.getAllMetaNodes()
                .find(node => node.getAttribute('name') === type)
                .getId();

        this.client.startTransaction('Created new operation prototype');
        newId = this.client.createChild({parentId, baseId});

        // Name the new node
        var basename = 'New' + this.client.getNode(baseId).getAttribute('name'),
            newName = getUniqueName.call(this, parentId, basename);

        // If instance, make the first char lowercase
        if (!metasheetName) {
            newName = newName.substring(0, 1).toLowerCase() + newName.substring(1);
        }

        this.client.setAttributes(newId, 'name', newName);
        if (metasheetName) {  // Add to metasheet
            var root = this.client.getNode(CONSTANTS.PROJECT_ROOT_ID),
                metatabs = root.getRegistry(REGISTRY_KEYS.META_SHEETS),
                metatab = metatabs.find(tab => tab.title === metasheetName) || metatabs[0],
                metatabId = metatab.SetID;

            // Add to the general meta
            this.client.addMember(
                CONSTANTS.PROJECT_ROOT_ID,
                newId,
                META_CONSTANTS.META_ASPECT_SET_NAME
            );
            this.client.setMemberRegistry(
                CONSTANTS.PROJECT_ROOT_ID,
                newId,
                META_CONSTANTS.META_ASPECT_SET_NAME,
                REGISTRY_KEYS.POSITION,
                {
                    x: 100,
                    y: 100
                }
            );

            // Add to the specific sheet
            this.client.addMember(CONSTANTS.PROJECT_ROOT_ID, newId, metatabId);
            this.client.setMemberRegistry(
                CONSTANTS.PROJECT_ROOT_ID,
                newId,
                metatabId,
                REGISTRY_KEYS.POSITION,
                {
                    x: 100,
                    y: 100
                }
            );
        }
        this.client.completeTransaction();

        WebGMEGlobal.State.registerActiveObject(newId);
    };

    instances.forEach(type => {
        create[type] = function() {
            return createNew.call(this, type);
        };
    });

    metaNodes.forEach(type => {
        create[type] = function() {
            return createNew.call(this, type, type);
        };
    });

    // Add download model button
    var downloadButton = function() {
        var id = this._currentNodeId,
            node = this.client.getNode(id),
            hash = node.getAttribute('data');

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

    var returnToLastPipeline = () => 
        WebGMEGlobal.State.registerActiveObject(window.DeepForge.lastPipeline);
    return {
        // Meta nodes
        MyPipelines_META: [
            {
                name: 'Create new pipeline',
                icon: 'queue',
                action: create.Pipeline
            }
        ],
        MyArchitectures_META: [
            {
                name: 'Create new architecture',
                icon: 'queue',
                action: create.Architecture
            }
        ],
        MyDataTypes_META: [
            {
                name: 'Create new data type',
                icon: 'queue',
                action: create.Data
            }
        ],
        MyOperations_META: [
            {
                name: 'Create new operation',
                icon: 'queue',
                action: create.Operation
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
                filter: () => window.DeepForge && window.DeepForge.lastPipeline,
                action: returnToLastPipeline
            }
        ],

        // Instances
        Data: [
            {
                name: 'Download',
                icon: 'play_for_work',
                href: downloadButton  // function to create href url
            }
        ],
        Pipeline: [
            {
                name: 'Create new node',
                icon: 'queue',
                priority: 2,
                action: function() {
                    this.onCreateInitialNode();
                }
            }
        ]
    };
});
