define([
    './backends/GME',
    './backends/Local'
], function(
    GME,
    Local
) {
    // FIXME: Add more intelligent interface here...
    // - fetch a given backend and configure
    return Local;
});
