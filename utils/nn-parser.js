var fs = require('fs'),
    path = require('path'),
    torchPath,

    LayerParser = require(__dirname + '/../src/common/LayerParser'),
    SKIP_LAYERS = {},
    skipLayerList = require('./skipLayers.json'),

    categories = require('./categories.json'),
    SKIP_ARGS = require('./skipArgs.json'),
    ARG_TYPES = require('./argTypes.json'),
    catNames = Object.keys(categories),
    exists = require('exists-file'),
    configDir = process.env.HOME + '/.deepforge/',
    configPath = configDir + 'config.json',
    layerToCategory = {},
    outputName = 'nn',
    outputDst = 'src/plugins/CreateTorchMeta/schemas/',
    config;

if (process.argv[2]) {
    outputName = process.argv[2];
}

// Find the given package in the torch installation
torchPath = process.env.HOME + '/torch';
if (exists.sync(configPath)) {  // Check the deepforge config
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    torchPath = (config.torch && config.torch.dir) || (configDir + 'torch');
}
// FIXME: Get the pytorch root path...
torchPath = process.env.HOME + '/projects/pytorch';
// check 'modules', 'parallel'
torchPath += '/torch/nn/';

console.log(`parsing ${outputName} from ${torchPath}`);

skipLayerList.forEach(name => SKIP_LAYERS[name] = true);
catNames.forEach(cat =>  // create layer -> category dictionary
   categories[cat].forEach(lname => layerToCategory[lname] = cat)
);
var lookupType = function(layer){
    var layerType;

    if (layer.baseType === 'Container') {
        layerType = 'Container';
    } else {
        layerType = layerToCategory[layer.name];
    }

    if (!layerType) {  // try to infer
        layerType = layer.name.indexOf('Criterion') > -1 && 'Criterion';
    }
    return layerType || 'Misc';
};

var parseLayerFiles = function(layerDir) {
    var files = fs.readdirSync(layerDir),
        layers,
        layerByName = {};

    console.log('parsing', layerDir);
    layers = files.filter(filename => path.extname(filename) === '.py' &&
            filename[0] !== '_')
        .map(filename => fs.readFileSync(layerDir + filename, 'utf8'))
        .map(code => LayerParser.parse(code))
        .filter(list => list !== null)
        .reduce((l1, l2) => l1.concat(l2), [])
        .filter(layer => !!layer && layer.name);

    layers.forEach(layer => {
        layer.type = lookupType(layer);
        layerByName[layer.name] = layer;
    });

    // handle inheritance
    layers.forEach(layer => {
        var iter = layer,
            params = layer.params,
            unsupArgs = SKIP_ARGS[layer.name],
            type,
            i;

        while (iter && params === undefined) {
            params = iter.params;
            iter = layerByName[iter.baseType];
        }
        // Remove any unsupported (optional) args
        if (unsupArgs) {
            for (var k = params.length; k--;) {
                i = unsupArgs.indexOf(params[k]);
                if (i !== -1) {
                    // eslint-disable-next-line no-console
                    console.log(`Removing "${params[k]}" param from ${layer.name}`);
                    params = params.splice(0, k);
                }
            }
        }
        layer.params = params;

        // Add any explicit types from argTypes.json
        if (ARG_TYPES[layer.name]) {
            for (i = layer.params.length; i--;) {
                type = ARG_TYPES[layer.name][layer.params[i]];
                if (type) {
                    // eslint-disable-next-line no-console
                    console.log(`Setting "${layer.params[i]}" (${layer.name}) to ${type}`);
                    layer.types[layer.params[i]] = type;
                }
            }
        }
    });
    layers = layers.filter(layer => !SKIP_LAYERS[layer.name]);
    return layers;
};

var layers = ['modules']
    .map(dir => torchPath + dir + '/')
    .map(path => parseLayerFiles(path))
    .reduce((l1, l2) => l1.concat(l2))
    .filter(layer => layer.name[0] !== '_');  // skip hidden/abstract layers


// eslint-disable-next-line no-console
console.log('discovered', layers.length, 'layers');
outputDst += outputName + '.json';
// eslint-disable-next-line no-console
console.log('Saved nn interface to ' + outputDst);
fs.writeFileSync(outputDst, JSON.stringify(layers, null, 2));

// Update the CreateTorchMeta index
var updateSchemas = `${__dirname}/../src/plugins/CreateTorchMeta/update-schemas.js`,
    job = require('child_process').fork(updateSchemas);

job.on('close', code => {
    process.exit(code);
});
