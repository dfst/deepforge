/* globals define, $ */
/* eslint-env browser */

define([
    'deepforge/storage/index'
], function (
    Storage
) {
    const SECTION_HEADER = $('<h6 class="config-section-header">');
    const CUSTOM_WIDGET_TYPES = ['dict', 'section', 'group', 'userAsset'];

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
                return this.getEntryForProperty(item, config);
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

        userAsset(configEntry, config) {
            const widget = {el: null, active: null};
            const storageOpts = this._getStorageOpts();
            widget.el = $('<div>', {class: configEntry.name});
            const browserAssetConfig = {
                name: configEntry.name,
                displayName: configEntry.displayName,
                valueType: 'file'
            };
            const browserAssetWidget = this.getEntryForProperty(browserAssetConfig, config);
            const storageWidget = this.getEntryForProperty(storageOpts, config);
            widget.el.append(browserAssetWidget.el);
            widget.el.append(storageWidget.el);

            widget.getValue = async () => {
                const {name, config} = storageWidget.widget.getValue();
                const backendId = this._getStorageBackendId(name);
                const basedir = this.getBaseStorageDir();
                const storageClient = await Storage
                    .getClient(backendId, browserAssetWidget.widget.logger, config);
                const file = browserAssetWidget.widget.getValue();
                const dataInfo = await storageClient.putFile(`${basedir}/${file.name}`, file);
                return {
                    name: file.name,
                    dataInfo: dataInfo,
                    storageAssetWidgetValue: storageWidget.widget.getValue()
                };
            };

            widget.setValue = value => {
                const {storageAssetWidgetValue} = value;
                if(storageAssetWidgetValue) {
                    storageWidget.widget.setValue(storageAssetWidgetValue);
                }
            };

            return {widget, el: widget.el};
        }

        _getStorageOpts() {
            const backends = Storage.getAvailableBackends();
            const storageMetadata = backends.map(id => Storage.getStorageMetadata(id));
            return {
                name: 'storage',
                displayName: 'Storage',
                description: 'Location to store intermediate/generated data.',
                valueType: 'dict',
                value: Storage.getBackend(backends[0]).name,
                valueItems: storageMetadata
            };
        }

        _getStorageBackendId(backendName) {
            const backends = Storage.getAvailableBackends();
            const storageMetadata = backends.map(id => Storage.getStorageMetadata(id));
            return storageMetadata.find(metadata => metadata.name === backendName).id;
        }

        static isCustomEntryValueType(valueType) {
            return CUSTOM_WIDGET_TYPES.includes(valueType);
        }
    }

    return CustomConfigEntries;
});
