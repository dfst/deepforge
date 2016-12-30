/*globals define*/
// Simple torch cli for the given pipeline
define([
    'underscore'
], function(
    _
) {

    var INIT_CLASSES_FN = '__initClasses',
        INIT_LAYERS_FN = '__initLayers',
        DEEPFORGE_CODE;  // defined at the bottom (after the embedded template)

    var createExecFile = function (sections, staticInputs) {
        var classes,
            initClassFn,
            initLayerFn,
            code = [];

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
            // Grab the args from the cli
            code.push(sections.mainInputNames.map((name, index) => {
                return `local ${name} = arg[${index + 1}]`;
            }).join('\n'));

            // Add the main fn
            code.push(sections.main);

            // Save outputs to disk
            code.push(sections.serializeOutputs);

            return code.join('\n\n');
        }

        return code.join('\n\n');
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

    DEEPFORGE_CODE = _.template(deepforgeTxt)({
        initCode: `${INIT_CLASSES_FN}()\n${'   '}${INIT_LAYERS_FN}()`
    });

    return createExecFile;
});
