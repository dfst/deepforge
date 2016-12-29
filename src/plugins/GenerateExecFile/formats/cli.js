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

    var createExecFile = function (sections) {
        var classes,
            initClassFn,
            initLayerFn,
            code = [];

        // concat all the sections into a single file

        // wrap the class/layer initialization in a fn
        // Add the classes ordered wrt their deps
        classes = Object.keys(sections.classes)
            .sort((a, b) => {
                // if a depends on b, switch them (return 1)
                if (sections.classDependencies[a].includes(b)) {
                    return 1;
                }
                return -1;
            })
            // Create fns from the classes
            .map(name => [
                `local function init${name}()`,
                this.indent(sections.classes[name]),
                'end',
                `init${name}()`
            ].join('\n'));

        initClassFn = [
            `local function ${INIT_CLASSES_FN}()`,
            this.indent(classes.join('\n\n')),
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
        code = code.concat(_.values(sections.operations));

        code = code.concat(_.values(sections.pipelines));

        code.push(DEEPFORGE_CODE);
        code.push('deepforge.initialize()');
        code.push(sections.main);

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
