/* globals WebGMEGlobal, define*/
// This file creates the DeepForge namespace and defines basic actions
define([
    'js/RegistryKeys',
    'js/Panels/MetaEditor/MetaEditorConstants',
    'js/Constants'
], function(
    REGISTRY_KEYS,
    META_CONSTANTS,
    CONSTANTS
) {
    var DeepForge = {},
        placesTerritoryId,
        client = WebGMEGlobal.Client,
        PLACE_NAMES;

    // Helper functions
    var addToMetaSheet = function(nodeId, metasheetName) {
        var root = client.getNode(CONSTANTS.PROJECT_ROOT_ID),
            metatabs = root.getRegistry(REGISTRY_KEYS.META_SHEETS),
            metatab = metatabs.find(tab => tab.title === metasheetName) || metatabs[0],
            metatabId = metatab.SetID;

        // Add to the general meta
        client.addMember(
            CONSTANTS.PROJECT_ROOT_ID,
            nodeId,
            META_CONSTANTS.META_ASPECT_SET_NAME
        );
        client.setMemberRegistry(
            CONSTANTS.PROJECT_ROOT_ID,
            nodeId,
            META_CONSTANTS.META_ASPECT_SET_NAME,
            REGISTRY_KEYS.POSITION,
            {
                x: 100,
                y: 100
            }
        );

        // Add to the specific sheet
        client.addMember(CONSTANTS.PROJECT_ROOT_ID, nodeId, metatabId);
        client.setMemberRegistry(
            CONSTANTS.PROJECT_ROOT_ID,
            nodeId,
            metatabId,
            REGISTRY_KEYS.POSITION,
            {
                x: 100,
                y: 100
            }
        );
    };

    var createNamedNode = function(baseId, parentId, isMeta) {
        var newId = client.createChild({parentId, baseId}),
            baseNode = client.getNode(baseId),
            basename = 'New' + baseNode.getAttribute('name'),
            newName = getUniqueName(parentId, basename);

        // If instance, make the first char lowercase
        if (!isMeta) {
            newName = newName.substring(0, 1).toLowerCase() + newName.substring(1);
        }

        // Set isAbstract false, if needed
        if (baseNode.getRegistry('isAbstract')) {
            client.setRegistry(newId, 'isAbstract', false);
        }

        client.setAttributes(newId, 'name', newName);
        return newId;
    };

    var getUniqueName = function(parentId, basename) {
        var pNode = client.getNode(parentId),
            children = pNode.getChildrenIds().map(id => client.getNode(id)),
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

    /////////// Initializing DeepForge ///////////
    var TYPE_TO_CONTAINER = {
        
        Architecture: 'MyArchitectures',
        Pipeline: 'MyPipelines',
        Execution: 'MyExecutions',
        Layer: 'MyLayers',
        Operation: 'MyOperations',
        Primitive: 'MyDataTypes',
        Complex: 'MyDataTypes'
    };

    PLACE_NAMES = Object.keys(TYPE_TO_CONTAINER).map(key => TYPE_TO_CONTAINER[key]);

    // Add DeepForge directories
    var updateDeepForgeNamespace = function() {
        var territory = {};

        DeepForge.places = {};

        // Create a territory
        if (placesTerritoryId) {
            client.removeUI(placesTerritoryId);
        }

        territory[CONSTANTS.PROJECT_ROOT_ID] = {children: 1};
        placesTerritoryId = client.addUI(null, updateDeepForgePlaces);

        // Update the territory (load the main places)
        client.updateTerritory(placesTerritoryId, territory);
    };

    var updateDeepForgePlaces = function(events) {
        var nodeIdsByName = {},
            nodes;

        nodes = events
            // Remove root node, complete event and update/unload events
            .filter(event => event.eid && event.eid !== CONSTANTS.PROJECT_ROOT_ID)
            .filter(event => event.etype === CONSTANTS.TERRITORY_EVENT_LOAD)
            .map(event => client.getNode(event.eid));

        nodes.forEach(node =>
            nodeIdsByName[node.getAttribute('name')] = node.getId());

        PLACE_NAMES.forEach(name => DeepForge.places[name] = nodeIdsByName[name]);
        
        // Remove the territory
        client.removeUI(placesTerritoryId);
        placesTerritoryId = null;
    };

    // Add DeepForge action primitives
    // Creating custom operations
    var instances = [
            'Architecture',
            'Pipeline'
        ],
        metaNodes = [
            'Operation',
            'Primitive',
            'Complex'
        ];

    var createNew = function(type, metasheetName) {
        var parentId,
            placeName = TYPE_TO_CONTAINER[type],
            newId,
            baseId,
            msg = `Created new ${type + (metasheetName ? ' prototype' : '')}`;

        baseId = client.getAllMetaNodes()
                .find(node => node.getAttribute('name') === type)
                .getId();

        // Look up the parent container
        parentId = DeepForge.places[placeName];

        client.startTransaction(msg);
        newId = createNamedNode(baseId, parentId, !!metasheetName);

        if (metasheetName) {
            addToMetaSheet(newId, metasheetName);
        }

        client.completeTransaction();

        WebGMEGlobal.State.registerActiveObject(newId);
        return newId;
    };

    DeepForge.create  = {};
    instances.forEach(type => {
        DeepForge.create[type] = function() {
            return createNew.call(null, type);
        };
    });

    metaNodes.forEach(type => {
        DeepForge.create[type] = function() {
            return createNew.call(null, type, type);
        };
    });

    // Update DeepForge on project changed
    WebGMEGlobal.State.on('change:' + CONSTANTS.STATE_ACTIVE_PROJECT_NAME, updateDeepForgeNamespace, null);

    // define DeepForge globally
    window.DeepForge = DeepForge;

});
