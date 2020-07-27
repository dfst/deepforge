/* globals define, $ */
define([
    'underscore',
    'deepforge/EventEmitter',
], function(
    _,
    EventEmitter,
) {

    class DataEditorBase extends EventEmitter {
        constructor(html, dataFields, updateOnChange) {
            super();
            this.$el = $(html);

            this.$elements = {};
            dataFields.forEach(name => {
                this.$elements[name] = this.$el.find(`#${name}`);
                if (updateOnChange) {
                    this.$elements[name].change(() => this.onUpdate());
                }
            });
        }

        set(values) {
            Object.entries(this.$elements).map(entry => {
                const [name, element] = entry;
                if (values.hasOwnProperty(name)) {
                    element.val(values[name]);
                }
            });
        }

        data() {
            const entries = Object.entries(this.$elements)
                .map(entry => {
                    const [name, element] = entry;
                    const value = element.val();
                    return [name, value];
                })
                .filter(entry => !!entry[1]);
            return _.object(entries);
        }

        onUpdate() {
            const values = this.data();
            this.emit('update', values);
        }
    }

    return DataEditorBase;
});
