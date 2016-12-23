// Utility for applying and removing deepforge extensions
// This utility is run by the cli when executing:
//
//     deepforge extensions add <project>
//     deepforge extensions remove <name>
//
var extender = {
    install: {},
    uninstall: {}
};

extender.isSupportedType = function(type) {
    return extender.install[type] && extender.uninstall[type];
};

// Extension Types
// TODO

module.exports = extender;
