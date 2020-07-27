/* globals define, $ */
/* eslint-env browser */

define([], function () {
    const SECTION_HEADER = $('<h6 class="config-section-header">');

    class CustomConfigEntries {
        section(configEntry) {
            const sectionHeader = SECTION_HEADER.clone();
            sectionHeader.text(configEntry.displayName);
            return {el: sectionHeader};
        }

        group(configEntry, config) {
            const widget = {el: null};
            widget.el = $('<div>', {class: configEntry.name});
            const entries = configEntry.valueItems.map(item => {
                return item.this.getEntryForProperty(item, config);
            });
            widget.getValue = () => {
                const config = {};
                entries.forEach(entry => {
                    if (entry.widget) {
                        config[entry.id || entry.name] = entry.widget.getValue();
                    }
                });
                return config;
            };

            widget.setValue = config => {
                entries.forEach(entry => {
                    const value = config[entry.id || entry.name];
                    if (entry.widget && value !== undefined) {
                        entry.widget.setValue(value);
                    }
                });
                return config;
            };

            return {widget, el: widget.el};
        }

        dict(configEntry, config) {
            const widget = {el: null, active: null};
            widget.el = $('<div>', {class: configEntry.name});

            const entriesForItem = {};
            const valueItemsDict = {};
            for (let i = 0; i < configEntry.valueItems.length; i++) {
                const valueItem = configEntry.valueItems[i];
                const entries = valueItem.configStructure
                    .map(item => {
                        const entry = this.getEntryForProperty(item, config);
                        return entry;
                    });

                entries.forEach(entry => {
                    if (i > 0) {
                        entry.el.css('display', 'none');
                    }
                    widget.el.append(entry.el);
                });

                const displayName = valueItem.displayName || valueItem.name;
                entriesForItem[displayName] = entries;
                valueItemsDict[displayName] = valueItem;
            }

            const itemNames = Object.keys(valueItemsDict);
            const defaultValue = itemNames[0];

            const configForKeys = {
                name: configEntry.name,
                displayName: configEntry.displayName,
                value: defaultValue,
                valueType: 'string',
                valueItems: itemNames
            };
            const selector = this.getEntryForProperty(configForKeys);

            widget.active = defaultValue;
            widget.onSetSelector = value => {
                const oldEntries = entriesForItem[widget.active];
                oldEntries.forEach(entry => entry.el.css('display', 'none'));

                widget.active = value;
                entriesForItem[widget.active]
                    .forEach(entry => entry.el.css('display', ''));
            };

            selector.el.find('select').on('change', event => {
                const {value} = event.target;
                widget.onSetSelector(value);
            });

            widget.getValue = () => {
                const displayName = widget.active;
                const name = valueItemsDict[displayName].name;
                const config = {};
                entriesForItem[name].forEach(entry => {
                    if (entry.widget) {
                        config[entry.id] = entry.widget.getValue();
                    }
                });
                return {name, config};
            };

            widget.setValue = value => {
                const {name, config} = value;
                selector.widget.setValue(name);
                widget.onSetSelector(name);
                entriesForItem[name].forEach(entry => {
                    if (entry.widget) {
                        entry.widget.setValue(config[entry.id]);
                    }
                });
                return {name, config};
            };

            widget.el.prepend(selector.el);

            return {widget, el: widget.el};
        }

        static isCustomEntryValueType(valueType) {
            return ['dict', 'section', 'group'].includes(valueType);
        }
    }

    return CustomConfigEntries;
});
