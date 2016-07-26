var fs = require('fs'),
    path = require('path'),
    torchPath,

    LayerParser = require(__dirname + '/../src/common/LayerParser'),
    SKIP_LAYERS = {},
    skipLayerList = require('./skipLayers.json'),

    categories = require('./categories.json'),
    catNames = Object.keys(categories),
    exists = require('exists-file'),
    configDir = process.env.HOME + '/.deepforge/',
    configPath = configDir + 'config.json',
    layerToCategory = {},
    config;

// Check the deepforge config
torchPath = process.env.HOME + '/torch';
if (exists.sync(configPath)) {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    torchPath = (config.torch && config.torch.dir) || (configDir + 'torch');
}
torchPath += '/extra/nn/';

skipLayerList.forEach(name => SKIP_LAYERS[name] = true);
catNames.forEach(cat =>  // create layer -> category dictionary
   categories[cat].forEach(lname => layerToCategory[lname] = cat)
);
var lookupType = function(name){
    var layerType = layerToCategory[name];
    if (!layerType) {  // try to infer
        layerType = name.indexOf('Criterion') > -1 && 'Criterion';
    }
    return layerType || 'Misc';
};

fs.readdir(torchPath, function(err,files){
    if(err) throw err;
    var layers,
        layerByName = {};

    layers = files.filter(filename => path.extname(filename) === '.lua')
        //.filter(filename => filename === 'SpatialAveragePooling.lua')
        .map(filename => fs.readFileSync(torchPath + filename, 'utf8'))
        .map(code => LayerParser.parse(code))
        .filter(layer => !!layer && layer.name);

    layers.forEach(layer => {
        layer.type = lookupType(layer.name);
        layerByName[layer.name] = layer;
    });

    // handle inheritance
    layers.forEach(layer => {
        var iter = layer,
            params = layer.params;

        while (iter && params === undefined) {
            params = iter.params;
            iter = layerByName[iter.baseType];
        }
        layer.params = params;
    });
    layers = layers.filter(layer => !SKIP_LAYERS[layer.name]);

    // eslint-disable-next-line no-console
    console.log('Saved nn interface to src/common/layers.json');
    fs.writeFileSync('src/common/layers.json', JSON.stringify(layers, null, 2));
});
