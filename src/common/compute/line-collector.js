/*globals define*/
define([], function() {
    class LineCollector {
        constructor() {
            this.currentLine = '';
            this.handler = null;
        }

        on(fn) {
            this.handler = fn;
        }

        receive(data) {
            const text = data.toString();
            const newLineIndex = text.indexOf('\n');
            let fragment;
            if (newLineIndex > -1) {
                const line = this.currentLine + text.substring(0, newLineIndex);
                this.handler(line);
                fragment = text.substring(newLineIndex + 1);
                this.currentLine = '';
            } else {
                fragment = text;
            }
            this.currentLine += fragment;
        }

        flush() {
            if (this.currentLine) {
                this.handler(this.currentLine);
                this.currentLine = '';
            }
        }
    }

    return LineCollector;
});
