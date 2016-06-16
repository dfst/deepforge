/*globals define*/
define([
    'text!./entry.ejs',
    'text!./main.ejs',
    'text!./serialize.ejs',
    'text!./deserialize.ejs'
], function(
    ENTRY,
    MAIN,
    SERIALIZE,
    DESERIALIZE
) {

    var BASH = `th init.lua  2>&1 | sed -e 's/[[:cntrl:]]//g' -e 's/\\[32;1m//g' -e 's/\\[0;36m//g' -e 's/\\[33;1m//g' -e 's/\\[35;1m//g' -e 's/\\[37;1m//g' -e 's/\\[0m//g'`;
    return {
        BASH,
        ENTRY,
        MAIN,
        SERIALIZE,
        DESERIALIZE
    };
});
