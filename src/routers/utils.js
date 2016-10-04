module.exports = {
    getMissingField: function(array, fields) {
        for (var i = fields.length; i--;) {
            if (!array[fields[i]]) {
                return fields[i];
            }
        }
        return null;
    }
};
