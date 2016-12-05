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
    var TMP_DIR = '/tmp',
        spawn = childProcess.spawn;  // TODO: configurable
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
        this._tmpFileId = `${name}_${Date.now()}`;
        return PluginBase.prototype.main.call(this, callback);
    };

    ValidateArchitecture.prototype.createOutputFiles = function (tree) {
        var layers = tree[SimpleNodeConstants.CHILDREN],
            tests = [],
            id;

        // Generate code for each layer
        for (var i = layers.length; i--;) {
            id = layers[i][SimpleNodeConstants.NODE_PATH];
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
    };

    ValidateArchitecture.prototype.validateLayer = function (id, code) {
        var deferred = Q.defer(),
            tmpPath = path.join(TMP_DIR, this._tmpFileId);

        // Write to a temp file
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
        return {
            id: id,
            msg: stderr
        };
    };

    ValidateArchitecture.prototype._saveOutput = function () {};

    return ValidateArchitecture;
});
