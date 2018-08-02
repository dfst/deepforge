/* globals WebGMEGlobal, define*/
// This file creates the DeepForge namespace and defines basic actions
define([
    'panel/FloatingActionButton/styles/Materialize',
    'text!./NewOperationCode.ejs',
    'js/RegistryKeys',
    'js/Panels/MetaEditor/MetaEditorConstants',
    'js/Constants',
    'underscore',
    'q'
], function(
    Materialize,
    DefaultCodeTpl,
    REGISTRY_KEYS,
    META_CONSTANTS,
    CONSTANTS,
    _,
    Q
) {
    var DeepForge = {},
        placesTerritoryId,
        client = WebGMEGlobal.Client,
        GetOperationCode = _.template(DefaultCodeTpl),
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
        var newId = client.createNode({parentId, baseId}),
            baseNode = client.getNode(baseId),
            basename,
            newName,
            code;

        basename = 'New' + baseNode.getAttribute('name');
        newName = getUniqueName(parentId, basename);

        if (baseNode.getAttribute('name') === 'Operation') {
            code = GetOperationCode({name: newName});
            client.setAttribute(newId, 'code', code);
        }

        // If instance, make the first char lowercase
        if (!isMeta) {
            newName = newName.substring(0, 1).toLowerCase() + newName.substring(1);
        }

        // Set isAbstract false, if needed
        if (baseNode.getRegistry('isAbstract')) {
            client.setRegistry(newId, 'isAbstract', false);
        }

        client.setAttribute(newId, 'name', newName);
        return newId;
    };

    var getUniqueName = function(parentId, basename) {
        var pNode = client.getNode(parentId),
            children = pNode.getChildrenIds().map(id => client.getNode(id)),
            name = basename,
            exists = {},
            i = 2;

        children
            .filter(child => child !== null)
            .forEach(child => exists[child.getAttribute('name')] = true);

        while (exists[name]) {
            name = basename + '_' + i;
            i++;
        }

        return name;
    };

    //////////////////// DeepForge places detection ////////////////////
    DeepForge.places = {};
    var TYPE_TO_CONTAINER = {
        
        Code: 'MyUtilities',
        Architecture: 'MyResources',
        Pipeline: 'MyPipelines',
        Execution: 'MyExecutions',
        Artifact: 'MyArtifacts',
        Operation: 'MyOperations',
        Primitive: 'MyDataTypes',
        Complex: 'MyDataTypes',
        InitCode: 'InitCode'
    };

    PLACE_NAMES = Object.keys(TYPE_TO_CONTAINER).map(key => TYPE_TO_CONTAINER[key]);

    // Add DeepForge directories
    var placePromises = {},
        setPlaceId = {},
        firstProject = true;

    var getPlace = function(name) {
        return placePromises[name];
    };

    var initializePlaces = function() {
        PLACE_NAMES.forEach(name => {
            var deferred = Q.defer();
            placePromises[name] = deferred.promise;
            setPlaceId[name] = deferred.resolve;
        });
    };

    var updateDeepForgeNamespace = function() {
        var territory = {};

        if (!firstProject) {
            initializePlaces();
        }
        firstProject = false;

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

        PLACE_NAMES.forEach(name => setPlaceId[name](nodeIdsByName[name]));
        
        // Remove the territory
        client.removeUI(placesTerritoryId);
        placesTerritoryId = null;
    };

    initializePlaces();
    PLACE_NAMES.forEach(name => DeepForge.places[name] = getPlace.bind(null, name));

    //////////////////// DeepForge creation actions ////////////////////
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
        var placeName = TYPE_TO_CONTAINER[type],
            newId,
            baseId,
            msg = `Created new ${type + (metasheetName ? ' prototype' : '')}`;

        baseId = client.getAllMetaNodes()
                .find(node => node.getAttribute('name') === type)
                .getId();

        // Look up the parent container
        return DeepForge.places[placeName]().then(parentId => {

            client.startTransaction(msg);
            newId = createNamedNode(baseId, parentId, !!metasheetName);

            if (metasheetName) {
                addToMetaSheet(newId, metasheetName);
            }

            client.completeTransaction();

            WebGMEGlobal.State.registerActiveObject(newId);
            return newId;
        });
    };

    // Creating Artifacts
    var UPLOAD_PLUGIN = 'ImportArtifact';

    var uploadArtifact = function() {
        // Get the data types
        var dataBase,
            dataBaseId,
            metanodes = client.getAllMetaNodes(),
            dataTypes = [];

        dataBase = metanodes.find(n => n.getAttribute('name') === 'Data');

        if (!dataBase) {
            this.logger.error('Could not find the base Data node!');
            return;
        }

        dataBaseId = dataBase.getId();
        dataTypes = metanodes.filter(n => n.isTypeOf(dataBaseId))
            .filter(n => !n.getRegistry('isAbstract'))
            .map(node => node.getAttribute('name'));

        // Add the target type to the pluginMetadata...
        var metadata = WebGMEGlobal.allPluginsMetadata[UPLOAD_PLUGIN];

        WebGMEGlobal.InterpreterManager.configureAndRun(metadata, result => {
            var msg = 'Artifact upload complete!';
            if (!result) {
                return;
            }
            if (!result.success) {
                msg = `Artifact upload failed: ${result.error}`;
            }
            Materialize.toast(msg, 2000);
        });
    };

    DeepForge.last = {};
    DeepForge.create = {};
    DeepForge.register = {};
    instances.forEach(type => {
        DeepForge.create[type] = function() {
            return createNew.call(null, type);
        };
    });

    metaNodes.forEach(type => {
        DeepForge.create[type] = function() {
            return createNew.call(null, type, type);
        };
        DeepForge.register[type] = function(id) {
            // Add the given element to the metasheet!
            return addToMetaSheet(id, type);
        };
    });

    DeepForge.create.Artifact = uploadArtifact;

    //////////////////// DeepForge prev locations ////////////////////
    // Update DeepForge on project changed
    WebGMEGlobal.State.on('change:' + CONSTANTS.STATE_ACTIVE_PROJECT_NAME,
        updateDeepForgeNamespace, null);

    // define DeepForge globally
    window.DeepForge = DeepForge;

    return DeepForge;
});
