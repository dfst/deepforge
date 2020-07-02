/* globals WebGMEGlobal, define*/
// This file creates the DeepForge namespace and defines basic actions
define([
    'deepforge/storage/index',
    'deepforge/viz/ConfigDialog',
    'panel/FloatingActionButton/styles/Materialize',
    'text!./NewOperationCode.ejs',
    'js/RegistryKeys',
    'js/Panels/MetaEditor/MetaEditorConstants',
    'js/Constants',
    'underscore',
    'q'
], function(
    Storage,
    ConfigDialog,
    Materialize,
    DefaultCodeTpl,
    REGISTRY_KEYS,
    META_CONSTANTS,
    CONSTANTS,
    _,
    Q
) {
    var DeepForge = {_actions: []},
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

    DeepForge.last = {};
    DeepForge.create = {};
    DeepForge.import = {};
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

    // Creating Artifacts
    const UPLOAD_PLUGIN = 'UploadArtifact';
    const IMPORT_PLUGIN = 'ImportArtifact';
    const copy = data => JSON.parse(JSON.stringify(data));
    const storageBackends = Storage.getAvailableBackends();
    const storageMetadata = storageBackends.map(id => Storage.getStorageMetadata(id));

    const getStorageOptions = function(backends = storageBackends) {
        return {
            name: 'storage',
            displayName: 'Storage',
            description: 'Location to store intermediate/generated data.',
            valueType: 'dict',
            value: Storage.getBackend(backends[0]).name,
            valueItems: storageMetadata.filter(metadata => backends.includes(metadata.id)),
        };
    };

    const runArtifactPlugin = async function(pluginName, metadata) {
        const configDialog = new ConfigDialog(client);
        const allConfigs = await configDialog.show(metadata);
        const context = client.getCurrentPluginContext(pluginName);
        context.pluginConfig = allConfigs[pluginName];
        context.pluginConfig.storage.id = storageMetadata
            .find(metadata => metadata.name === context.pluginConfig.storage.name)
            .id;
        return await Q.ninvoke(client, 'runBrowserPlugin', pluginName, context);
    };


    DeepForge.create.Artifact = async function() {
        const metadata = copy(WebGMEGlobal.allPluginsMetadata[UPLOAD_PLUGIN]);
        const storageOpts = getStorageOptions();

        metadata.configStructure.unshift({
            name: 'artifactOptions',
            displayName: 'New Artifact',
            valueType: 'section'
        });

        const storageHeader = {
            name: 'storageOptions',
            displayName: 'Storage',
            valueType: 'section'
        };
        metadata.configStructure.push(storageHeader);
        metadata.configStructure.push(storageOpts);

        await runArtifactPlugin(UPLOAD_PLUGIN, metadata);
    };

    DeepForge.import.Artifact = async function() {
        const storageBackends = Storage.getAvailableBackends()
            .filter(backend => backend !== 'gme');
        const metadata = copy(WebGMEGlobal.allPluginsMetadata[IMPORT_PLUGIN]);
        const storageOpts = getStorageOptions(storageBackends);

        metadata.configStructure.unshift(storageOpts);

        await runArtifactPlugin(IMPORT_PLUGIN, metadata);
    };

    DeepForge.registerActionButton = function(button) {
        DeepForge._actionButton = button;
        while (this._actions.length) {
            this.registerAction(...this._actions.shift());
        }
    };

    DeepForge.registerAction = function(name, icon='add', priority=2, action) {
        if (this._actionButton) {
            this._actionButton.addAction({name, icon, priority, action});
        } else {
            this._actions.push(arguments);
        }
    };

    DeepForge.unregisterAction = function(name) {
        if (this._actionButton) {
            this._actionButton.removeAction(name);
        }
    };

    //////////////////// DeepForge prev locations ////////////////////
    // Update DeepForge on project changed
    WebGMEGlobal.State.on('change:' + CONSTANTS.STATE_ACTIVE_PROJECT_NAME,
        updateDeepForgeNamespace, null);

    // define DeepForge globally
    window.DeepForge = DeepForge;

    return DeepForge;
});
