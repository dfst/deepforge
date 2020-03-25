/* globals define*/
define([], function(){
    const Utils = {};

    Utils.getDisplayTime = timestamp => {
        var today = new Date().toLocaleDateString(),
            date = new Date(timestamp).toLocaleDateString();

        if (date === today) {
            date = `Today (${new Date(timestamp).toLocaleTimeString()})`;
        }
        return date;
    };

    Utils.ClassForJobStatus = {
        success: 'success',
        canceled: 'job-canceled',
        failed: 'danger',
        pending: '',
        running: 'warning'
    };

    Utils.base64ToImageArray = function (base64String, width, height, numChannels) {
        const decodedString = atob(base64String);
        let bytes = new Uint8Array(decodedString.length);
        for (let i = 0; i < decodedString.length; i++) {
            bytes[i] = decodedString.charCodeAt(i);
        }

        return reshape(bytes, width, height, numChannels);
    };

    const reshape = function (bytesArray, width, height, numChannels) {
        let pixelArray = [], oneRow = [], rgbaArray = [];
        let i, j = 0;
        for (i = 0; i < height * numChannels; i += numChannels) {
            while (j < width * numChannels) {
                pixelArray = Array.from(bytesArray
                    .slice(i * width + j, i * width + j + numChannels).values());
                oneRow.push(pixelArray);
                j += numChannels;
            }
            j = 0;
            rgbaArray.push(oneRow);
            oneRow = [];
        }
        return rgbaArray;
    };

    return Utils;
});

