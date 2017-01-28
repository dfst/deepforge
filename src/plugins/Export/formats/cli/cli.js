/*globals define*/
// Simple torch cli for the given pipeline
define([
], function(
) {

    var TOBOOLEAN;

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
        var code = [];

        // Update deserializers for cli input
        deserializersFromString.call(this, sections);

        // Define all the operations, pipelines, etc
        code.push(this.getAllDefinitions(sections));

        // Command line specific stuff
        var pipelineName = Object.keys(sections.pipelines)[0],
            files = {},
            main,
            args,
            staticNames = staticInputs.map(input => input.name),
            varDefs,
            index = 1;

        // Create some names for the inputs
        args = sections.mainInputNames.map(name => `${sections.deserializerFor[name]}(${name})`);

        main = `local outputs = ${pipelineName}(${args.join(', ')})`;

        // Grab the args from the cli
        code.push(sections.mainInputNames.map((name, index) => {
            return `local ${name} = arg[${index + 1}]`;
        }).join('\n'));

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
        code.push(main);

        // Save outputs to disk
        code.push(sections.serializeOutputs);

        files['init.lua'] = code.join('\n\n');

        // if no extra assets, just return the main file
        return staticInputs.length ? files : files['init.lua'];
    };

    TOBOOLEAN = 
`local function toboolean(str)
    if str == 'true' then
        return true
    elseif str == 'false' then
        return false
    end
end`;

    return createExecFile;
});
