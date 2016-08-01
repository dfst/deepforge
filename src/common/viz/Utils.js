/* globals define*/
define({
    getDisplayTime: timestamp => {
        var today = new Date().toLocaleDateString(),
            date = new Date(timestamp).toLocaleDateString();

        if (date === today) {
            date = `Today (${new Date(timestamp).toLocaleTimeString()})`;
        }
        return date;
    }
});
