/* globals define */
define([
    './Figure',
], function(
    Figure,
) {

    const MetadataClasses = [Figure];
    function getClassForCommand(cmd) {
        return MetadataClasses.find(clazz => {
            return clazz.getCommand() === cmd;
        });
    }

    return {getClassForCommand};
});
