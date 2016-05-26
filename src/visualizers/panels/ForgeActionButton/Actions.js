/*globals define, WebGMEGlobal*/
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

    return {
        Data: [
            {
                name: 'Download',
                icon: 'play_for_work',
                href: downloadButton  // function to create href url
            }
        ],

        MyPipelines: [
            {
                name: 'Create new pipeline',
                icon: 'queue',
                action: create.Pipeline
            }
        ],
        MyArchitectures: [
            {
                name: 'Create new architecture',
                icon: 'queue',
                action: create.Architecture
            }
        ],
        // FIXME: the next two should also add the created node to
        // the meta
        MyDataTypes: [
            {
                name: 'Create new data type',
                icon: 'queue',
                action: create.Data
            }
        ],
        MyOperations: [
            {
                name: 'Create new operation',
                icon: 'queue',
                action: create.Operation
            }
        ]
    };
});
