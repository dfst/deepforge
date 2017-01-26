/*globals define*/
// Simple torch cli for the given pipeline
define([
    'underscore'
], function(
    _
) {

    var INIT_CLASSES_FN = '__initClasses',
        INIT_LAYERS_FN = '__initLayers',
        TOBOOLEAN,
        DEEPFORGE_CODE;  // defined at the bottom (after the embedded template)

    var deserializersFromString = function(sections) {
        var hasBool = false;

        // Add serializers given cli string input
        Object.keys(this.isInputOp).forEach(id => {
            var node = this.inputNode[id],
                base = this.core.getBase(node),
                type = this.core.getAttribute(base, 'name'),
                name = this._nameFor[id];

            if (type === 'boolean') {
                hasBool = true;
                sections.deserializerFor[name] = 'toboolean';
            } else if (type === 'number') {
                sections.deserializerFor[name] = 'tonumber';
            } else if (type === 'string') {
                sections.deserializerFor[name] = 'tostring';
            }
        });

        if (hasBool) {
            sections.deserializers += '\n' + TOBOOLEAN;
        }

        return sections;
    };

    var createExecFile = function (sections, staticInputs) {
        var classes,
            initClassFn,
            initLayerFn,
            code = [];

        // Update deserializers for cli input
        deserializersFromString.call(this, sections);

        // concat all the sections into a single file
        // wrap the class/layer initialization in a fn
        // Add the classes ordered wrt their deps
        classes = sections.orderedClasses
            // Create fns from the classes
            .map(name => this.indent(sections.classes[name])).join('\n');

        initClassFn = [
            `local function ${INIT_CLASSES_FN}()`,
            this.indent(classes),
            'end'
        ].join('\n');

        code = code.concat(initClassFn);

        // wrap the layers in a function
        initLayerFn = [
            `local function ${INIT_LAYERS_FN}()`,
            this.indent(_.values(sections.layers).join('\n\n')),
            'end'
        ].join('\n');
        code = code.concat(initLayerFn);

        // Add operation fn definitions
        code = code.concat(_.values(sections.operations));
        code = code.concat(_.values(sections.pipelines));

        code.push(DEEPFORGE_CODE);
        code.push('deepforge.initialize()');

        // define deserializers, serializers
        code.push(sections.deserializers);
        code.push(sections.serializers);

        code.push(sections.serializeOutputsDef);

        if (staticInputs.length) {
            var files = {},
                staticNames = staticInputs.map(input => input.name),
                varDefs,
                index = 1;

            // Add the hash for each of the static inputs and reference them
            staticInputs.forEach(input => {
                files[`res/${input.name}`] = input.hash;
            });

            varDefs = staticNames.map(name => {
                return `local ${name} = './res/${name}'`;
            });

            // Grab the remaining args from the cli
            varDefs = varDefs.concat(sections.mainInputNames.map(name => {
                if (!staticNames.includes(name)) {
                    return `local ${name} = arg[${index++}]`;
                }
            }));

            // Add the main fn
            code.push(varDefs.join('\n'));
            code.push(sections.main);

            // Save outputs to disk
            code.push(sections.serializeOutputs);

            files['init.lua'] = code.join('\n\n');

            return files;
        } else {
            var pipelineName = Object.keys(sections.pipelines)[0],
                main,
                args;

            // Create some names for the inputs
            args = sections.mainInputNames.map(name => `${sections.deserializerFor[name]}(${name})`);

            main = `local outputs = ${pipelineName}(${args.join(', ')})`;

            // Grab the args from the cli
            code.push(sections.mainInputNames.map((name, index) => {
                return `local ${name} = arg[${index + 1}]`;
            }).join('\n'));

            // Add the main fn
            code.push(main);

            // Save outputs to disk
            code.push(sections.serializeOutputs);

            return code.join('\n\n');
        }
    };

    var deepforgeTxt =
`-- Instantiate the deepforge object
deepforge = {}

function deepforge.initialize()
    require 'nn'
    require 'rnn'
    <%= initCode %>
end

-- Graph support
torch.class('deepforge.Graph')

function deepforge.Graph:__init(name)
    -- nop
end

torch.class('deepforge._Line')

function deepforge._Line:__init(graphId, name, opts)
   -- nop
end

function deepforge._Line:add(x, y)
   -- nop
end

function deepforge.Graph:line(name, opts)
    return deepforge._Line(self.id, name, opts)
end

-- Image support
function deepforge.image(name, tensor)
   -- nop
end

torch.class('deepforge.Image')
function deepforge.Image:__init(name, tensor)
   -- nop
end

function deepforge.Image:update(tensor)
   -- nop
end

function deepforge.Image:title(name)
   -- nop
end`;

    TOBOOLEAN = 
`local function toboolean(str)
    if str == 'true' then
        return true
    elseif str == 'false' then
        return false
    end
end`;

    DEEPFORGE_CODE = _.template(deepforgeTxt)({
        initCode: `${INIT_CLASSES_FN}()\n${'   '}${INIT_LAYERS_FN}()`
    });

    return createExecFile;
});
