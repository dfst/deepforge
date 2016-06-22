var fs = require('fs');
var path = require('path');
var parser = require('../src/common/lua').parser;
var torchPath = process.env.HOME + '/torch/extra/nn/';
var SKIP_LAYERS = {};
var skipLayerList = require('./skipLayers.json');
skipLayerList.forEach(name => SKIP_LAYERS[name] = true);

var findInitParams = function(ast){
    // Find '__init' function
    var params;
    ast.block.stats.forEach(function(block){
        if(block.key && block.key.val == '__init' && block.func){
            params = block.func.args;
            if(params.length === 0 && block.func.varargs){
                params[0] = 'params';
            }
        }
    });
    return params;
};

var findTorchClass = function(ast){
    var torchClassArgs,  // args for `torch.class(...)`
        name = '',
        baseType,
        params = [];

    if(ast.type == 'function'){
        ast.block.stats.forEach(function(func){
            if(func.type == 'stat.local' && func.right && func.right[0] &&
              func.right[0].func && func.right[0].func.self &&
              func.right[0].func.self.val == 'torch' &&
              func.right[0].func.key.val == 'class'){

                torchClassArgs = func.right[0].args.map(arg => arg.val);
                name = torchClassArgs[0];
                if(name !== ''){
                    name = name.replace('nn.', '');
                    params = findInitParams(ast);
                    if (torchClassArgs.length > 1) {
                        baseType = torchClassArgs[1].replace('nn.', '');
                    }
                }
            }
        });
    }
    return {
        name,
        baseType,
        params
    };
};

var categories = require('./categories.json');
var catNames = Object.keys(categories);
var layerToCategory = {};
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
        .map(filename => fs.readFileSync(torchPath + filename, 'utf8'))
        .map(code => parser.parse(code))
        .map(ast => findTorchClass(ast))  // create initial layers
        .filter(layer => !!layer && layer.name);

    layers.forEach(layer => {
        layer.type = lookupType(layer.name);
        layerByName[layer.name] = layer;
        layer.setters = [];
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
