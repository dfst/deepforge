/* globals define */
define([
], function(
) {
    class CommandFailedError extends Error {
        constructor(cmd, result) {
            const {exitCode, stderr} = result;
            const msg = stderr ?
                `Command "${cmd}" failed with exit code ${exitCode}:\n${stderr}` :
                `Command "${cmd}" failed with exit code ${exitCode}.`;
            super(msg);
        }
    }

    return {CommandFailedError};
});
