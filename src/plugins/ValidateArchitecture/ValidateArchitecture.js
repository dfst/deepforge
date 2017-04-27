/*globals define*/
/*jshint node:true, browser:true*/

define([
    'plugin/GenerateArchitecture/GenerateArchitecture/GenerateArchitecture',
    'SimpleNodes/Constants',
    'text!./metadata.json',
    'q',
    'fs',
    'path',
    'child_process',
    'rimraf'
], function (
    PluginBase,
    SimpleNodeConstants,
    pluginMetadata,
    Q,
    fs,
    path,
    childProcess,
    rm_rf
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
        spawn = childProcess.spawn,
        GET_ARG_INDEX = /argument #([0-9]+) to/,
        TORCH_INSTALLED = true;

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

        if (!TORCH_INSTALLED) {
            return this.validationFinished();
        }

        // Generate code for each layer
        this.layerName = {};
        for (var i = layers.length; i--;) {
            id = layers[i][SimpleNodeConstants.NODE_PATH];
            this.layerName[id] = layers[i].name;
            tests.push([id, this.createLayerTestCode(layers[i])]);
        }

        // Run each code snippet
        this.validateLayers(tests)
            .then(errors => this.validationFinished(errors))
            .fail(err => this.logger.error(`validation failed: ${err}`));
    };

    ValidateArchitecture.prototype.validationFinished = function (errors) {
        if (!TORCH_INSTALLED) {
            this.logger.warn('Torch is not installed. Architecture validation is not supported.');
        } else {
            this.logger.info(`found ${errors.length} validation errors`);
        }

        this.createMessage(null, {
            errors: TORCH_INSTALLED ? errors : null
        });
        this.result.setSuccess(true);
        this._callback(null, this.result);
    };

    ValidateArchitecture.prototype.createLayerTestCode = function (layer) {
        var customLayerDefs = this.genLayerDefinitions([layer]);

        return this.definitions.concat([
            customLayerDefs,
            this.createLayer(layer)
        ]).join('\n');
    };

    ValidateArchitecture.prototype.validateLayers = function (layerTests) {
        return Q.all(layerTests.map(layer => this.validateLayer(layer[0], layer[1])))
            .then(results => Q.nfcall(rm_rf, this._tmpFileId)
                .then(() => results.filter(result => !!result))
            );
    };

    ValidateArchitecture.prototype.validateLayer = function (id, code) {
        var deferred = Q.defer(),
            tmpPath = path.join(this._tmpFileId, id.replace(/[^a-zA-Z\d]+/g, '_'));

        if (!TORCH_INSTALLED) {
            deferred.resolve(null);
        } else {
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
                job.on('error', err => {
                    if (err.code === 'ENOENT') {
                        TORCH_INSTALLED = false;
                    }
                });
                job.on('close', code => {
                    if (code === 0) {
                        deferred.resolve(null);
                    } else {
                        // If it errored, clean the error and return it
                        deferred.resolve(this.parseError(id, stderr));
                    }
                });
            });
        }

        return deferred.promise;
    };

    ValidateArchitecture.prototype.parseError = function (id, stderr) {
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
            // This is the index for the incorrect argument passed to the
            // tensor...
            msg = msg.replace(`#${argIndex}`, `"${argName}"`);
        }

        return {
            id: id,
            msg: msg
        };
    };

    ValidateArchitecture.prototype._saveOutput = function () {};

    // for testing
    ValidateArchitecture.prototype.setTorchInstalled = function (value) {
        TORCH_INSTALLED = !!value;
    };

    return ValidateArchitecture;
});
