/* eslint-disable no-console */
// Update the metadata and schemas/index based on the new schemas in schemas/

// Update metadata
var fs = require('fs'),
    path = require('path'),
    schemas,
    metadata = require('./metadata.json'),
    schemaList;

schemas = fs.readdirSync(__dirname + '/schemas/')
    .filter(name => path.extname(name) === '.json')
    .map(name => name.replace(/\.json$/, ''));

console.log('Discovered schemas: ' + schemas.join(', '));

schemaList = metadata.configStructure.find(struct => struct.name === 'layerSchema');
schemaList.valueItems = schemas.concat('all');

console.log('Updating metadata...');
fs.writeFileSync(__dirname + '/metadata.json', JSON.stringify(metadata, null, 2));

// Update index.js
var index =
`/*globals define*/
define([
    ${schemas.map(s => `'text!./${s}.json'`).join(',\n    ')}
], function(
    ${schemas.map(s => s).join(',\n    ')}
) {
    return {
        ${schemas.map(s => s + ': ' + s).join(',\n        ')}
    };
});`;

console.log('Updating index.js...');
fs.writeFileSync(__dirname + '/schemas/index.js', index);
