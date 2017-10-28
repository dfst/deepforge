var brython = require('./node-brython'),
    fs = require('fs'),
    assert = require('assert'),
    src = fs.readFileSync(process.env.HOME + '/projects/pytorch/torch/nn/modules/conv.py', 'utf8'),
    root = build_ast(src);

function build_ast(src) {
  brython.$py_module_path['__main__']='./'
  return brython.py2js(src,'__main__', '__main__', '__builtins__')
}

// The provided tree gives us contexts which can have associated 'C'
function traverse (node, fn) {
    var i;
    if (node.children) {
        for (i = node.children.length; i--;) {
            traverse(node.children[i], fn);
            fn(node.children[i]);
        }
    }
    if (node.C && node.C.tree) {
        for (i = node.C.tree.length; i--;) {
            traverse(node.C.tree[i], fn);
            fn(node.C.tree[i]);
        }
    }
}

var types = {},
    layers = [],
    pCtx,
    classNode,
    params;

function isClass(node) {
    return node.type === 'class';
}

function isInitFn(node) {
    return node.type === 'def' && node.name === '__init__';
}

function getBaseClass(node) {
    assert(node.type === 'class');
    return node.args.tree[0].tree[0].tree[0].value;
}

var defaults = {},
    defTypes,
    args,
    def;

traverse(root, node => {
    if (node.type) types[node.type] = true;

    // Get the class for the given function
    if (isInitFn(node)) {
        pCtx = node.parent.node.parent;
        classNode = pCtx.C.tree[0];

        if (isClass(classNode)) {
            // remove the 'self' variable
            // TODO: May need to update this for kwargs
            // (use positional_list)
            args = node.tree[1].tree;
            defaults = {};
            params = node.args.slice(1);
            defTypes = {};
            for (var i = args.length; i--;) {
                if (args[i].tree[0]) {
                    def = args[i].tree[0].tree[0];
                    console.log('setting type of ', params[i-1], 'to', def.type);
                    defTypes[params[i-1]] = def.type;
                    if (def.type === 'int') {
                        defaults[params[i-1]] = parseInt.apply(null, def.value.reverse());
                    } else {
                        defaults[params[i-1]] = def.value;
                    }
                }
            }
            layers.push({
                name: classNode.name,
                baseType: getBaseClass(classNode),
                //doc: classNode.doc_string || '',
                defaults: defaults,
                types: defTypes,
                params: params
            });
        }
    }
    // TODO: What if there is no constructor? Is this a potential problem?
});

console.log('layers:', layers);
fs.writeFileSync('./testPyTorchLayers.json', JSON.stringify(layers, null, 2));
//console.log('layers:', layers.map(l => l.name));
// Try to find the class definitions...
//
//  Need to create:
//
//    setters: (I don't think these are used in pytorch!
//    types: 
//    defaults: 
//    type: 
