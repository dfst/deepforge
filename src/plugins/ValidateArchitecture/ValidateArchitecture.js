/*globals define*/
/*jshint node:true, browser:true*/

define([
    'plugin/GenerateArchitecture/GenerateArchitecture/GenerateArchitecture',
    'SimpleNodes/Constants',
    'text!./metadata.json',
    'q',
    'fs',
    'path',
    'child_process'
], function (
    PluginBase,
    SimpleNodeConstants,
    pluginMetadata,
    Q,
    fs,
    path,
    childProcess
) {
    'use strict';

    pluginMetadata = JSON.parse(pluginMetadata);

    /**
     * Initializes a new instance of ValidateArchitecture.
     * @class
     * @augments {PluginBase}
     * @classdesc This class represents the plugin ValidateArchitecture.
     * @constructor
     */
    var TMP_DIR = '/tmp',  // TODO: configurable
        spawn = childProcess.spawn,
        GET_ARG_INDEX = /argument #([0-9]+) to/;
    var ValidateArchitecture = function () {
        // Call base class' constructor.
        PluginBase.call(this);
        this.pluginMetadata = pluginMetadata;
    };

    /**
     * Metadata associated with the plugin. Contains id, name, version, description, icon, configStructue etc.
     * This is also available at the instance at this.pluginMetadata.
     * @type {object}
     */
    ValidateArchitecture.metadata = pluginMetadata;

    // Prototypical inheritance from PluginBase.
    ValidateArchitecture.prototype = Object.create(PluginBase.prototype);
    ValidateArchitecture.prototype.constructor = ValidateArchitecture;

    ValidateArchitecture.prototype.main = function (callback) {
        var name = this.core.getAttribute(this.activeNode, 'name');

        this._callback = callback;
        // make the tmp dir
        this._tmpFileId = path.join(TMP_DIR, `${name}_${Date.now()}`);
        fs.mkdir(this._tmpFileId, err => {
            if (err) throw err;
            return PluginBase.prototype.main.call(this, callback);
        });
    };

    ValidateArchitecture.prototype.createOutputFiles = function (tree) {
        var layers = tree[SimpleNodeConstants.CHILDREN],
            tests = [],
            id;

        // Generate code for each layer
        this.layerName = {};
        for (var i = layers.length; i--;) {
            id = layers[i][SimpleNodeConstants.NODE_PATH];
            this.layerName[id] = layers[i].name;
            tests.push([id, this.createLayerTestCode(layers[i])]);
        }

        // Run each code snippet
        this.validateLayers(tests)
            .then(errors => {
                console.log('errors', errors);
                errors.forEach(error => this.createMessage(null, error));
                this.result.setSuccess(true);
                this._callback(null, this.result);
            });
    };

    ValidateArchitecture.prototype.createLayerTestCode = function (layer) {
        // TODO: add custom layer definition if necessary
        return this.definitions.concat([
            this.createLayer(layer)
        ]).join('\n');
    };

    ValidateArchitecture.prototype.validateLayers = function (layerTests) {
        return Q.all(layerTests.map(layer => this.validateLayer(layer[0], layer[1])))
            .then(results => results.filter(result => !!result));
            // TODO: Remove tmp files
    };

    ValidateArchitecture.prototype.validateLayer = function (id, code) {
        var deferred = Q.defer(),
            tmpPath = path.join(this._tmpFileId, id.replace(/[^a-zA-Z\d]+/g, '_'));

        // Write to a temp file
        console.log('--- Test code for ' + id + ' ---');
        console.log(code);
        fs.writeFile(tmpPath, code, err => {
            var job,
                stderr = '',
                stdout = '';

            if (err) {
                return deferred.reject(`Could not create tmp file at ${tmpPath}: ${err}`);
            }
            // Run the file
            job = spawn('th', [tmpPath]);
            job.stderr.on('data', data => stderr += data.toString());
            job.stdout.on('data', data => stdout += data.toString());
            job.on('close', code => {
                // TODO: Ignore errors if 'th' not found
                if (code === 0) {
                    deferred.resolve(null);
                } else {
                    // If it errored, clean the error and return it
                    deferred.resolve(this.parseError(id, stderr));
                }
            });
        });

        return deferred.promise;
    };

    ValidateArchitecture.prototype.parseError = function (id, stderr) {
        console.log(`error for ${id} is ${stderr}`);
        var msg = stderr
            .split('\n').shift()  // first line
            .replace(/^[^:]*: /, '')  // remove the file path
            .replace(/ at [^ ]*\)/, ')')  // remove last line number
            .replace(/ to '\?'/, '');  // remove unknown symbol

        // convert 'bad argument #[num]' to the argument name
        if (msg.indexOf('bad argument') === 0) {
            var layerName = this.layerName[id],
                args = this.LayerDict[layerName].args,
                argIndex = +(stderr.match(GET_ARG_INDEX)[1]),
                argName = args[argIndex-1].name;

            // FIXME: This is not the correct index...
            msg = msg.replace(`#${argIndex}`, `"${argName}"`);
        }

        return {
            id: id,
            msg: msg
        };
    };

    ValidateArchitecture.prototype._saveOutput = function () {};

    return ValidateArchitecture;
});
