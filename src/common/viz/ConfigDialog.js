/* globals define, $*/
define([
    'q',
    'js/Dialogs/PluginConfig/PluginConfigDialog',
    'deepforge/utils',
    'text!js/Dialogs/PluginConfig/templates/PluginConfigDialog.html',
    'css!./ConfigDialog.css'
], function(
    Q,
    PluginConfigDialog,
    utils,
    pluginConfigDialogTemplate,
) {
    var SECTION_DATA_KEY = 'section',
        ATTRIBUTE_DATA_KEY = 'attribute',
        //jscs:disable maximumLineLength
        PLUGIN_CONFIG_SECTION_BASE = $('<div><fieldset><form class="form-horizontal" role="form"></form><fieldset></div>'),
        ENTRY_BASE = $('<div class="form-group"><div class="row"><label class="col-sm-4 control-label">NAME</label><div class="col-sm-8 controls"></div></div><div class="row description"><div class="col-sm-4"></div></div></div>'),
        //jscs:enable maximumLineLength
        DESCRIPTION_BASE = $('<div class="desc muted col-sm-8"></div>'),
        SECTION_HEADER = $('<h6 class="config-section-header">');

    var ConfigDialog = function(client) {
        PluginConfigDialog.call(this, {client: client});
        this._widgets = {};
    };

    ConfigDialog.prototype = Object.create(PluginConfigDialog.prototype);

    ConfigDialog.prototype.show = async function(pluginMetadata, options={}) {
        const deferred = Q.defer();

        this._pluginMetadata = pluginMetadata;
        const prevConfig = await this.getSavedConfig();
        this._initDialog(pluginMetadata, prevConfig, options);

        this._dialog.on('shown', () => {
            this._dialog.find('input').first().focus();
        });

        this._btnSave.on('click', event => {
            this.submit(deferred.resolve);
            event.stopPropagation();
            event.preventDefault();
        });

        //save&run on CTRL + Enter
        this._dialog.on('keydown.PluginConfigDialog', event => {
            if (event.keyCode === 13 && (event.ctrlKey || event.metaKey)) {
                event.stopPropagation();
                event.preventDefault();
                this.submit(deferred.resolve);
            }
        });
        this._dialog.modal('show');
        return deferred.promise;
    };

    ConfigDialog.prototype._initDialog = function(metadata, prevConfig, options) {
        this._dialog = $(pluginConfigDialogTemplate);

        this._btnSave = this._dialog.find('.btn-save');
        this._divContainer = this._dialog.find('.modal-body');
        this._saveConfigurationCb = this._dialog.find('.save-configuration');
        this._modalHeader = this._dialog.find('.modal-header');
        this._saveConfigurationCb.find('input').prop('checked', true);

        // Create the header
        const config = this.getDialogConfig(metadata, options);
        var iconEl = $('<i/>', {class: config.iconClass});
        iconEl.addClass('plugin-icon pull-left');
        this._modalHeader.prepend(iconEl);
        this._title = this._modalHeader.find('.modal-title');
        this._title.text(config.title);

        this.generateConfigSection(metadata, prevConfig);
    };

    ConfigDialog.prototype.getDialogConfig = function(metadata, options) {
        const defaultTitle = metadata.name ? `${metadata.name} (v${metadata.version})` :
            metadata.id + ' v' + metadata.version;
        return {
            title: options.title || defaultTitle,
            iconClass: (metadata.icon && metadata.icon.class) || 'glyphicon glyphicon-cog',
        };
    };

    ConfigDialog.prototype.submit = function (callback) {
        const config = this._getAllConfigValues();
        const saveConfig = this._saveConfigurationCb.find('input')
            .prop('checked');

        this._dialog.modal('hide');
        if (saveConfig) {
            this.saveConfig(config);
        }
        return callback(config);
    };

    ConfigDialog.prototype.saveConfig = async function (config) {
        const authKeys = this.getAuthenticationKeys(this._pluginMetadata)
            .map(keys => [this._pluginMetadata.id].concat(keys));
        const [secretConfig, publicConfig] = utils.splitObj(config, authKeys);

        await this.saveUserData({Dialog: {__secrets__: secretConfig}}, true);
        await this.saveUserData({Dialog: publicConfig});
    };

    ConfigDialog.prototype.saveUserData = async function (config, encrypt=false) {
        const opts = {
            method: 'PATCH',
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(config)
        };
        await fetch(`/api/user/data?${encrypt ? 'encrypt=1' : ''}`, opts);
    };

    ConfigDialog.prototype.getAuthenticationKeys = function (metadata) {
        const keys = [];
        const configItems = metadata.configStructure || metadata.valueItems;

        configItems.forEach(config => {
            if (config.isAuth) {
                keys.push([config.name]);
            } else if (config.valueType === 'dict') {
                const nestedKeys = config.valueItems
                    .flatMap(c => this.getAuthenticationKeys(c))
                    .map(key => [config.name, 'config'].concat(key));

                keys.push(...nestedKeys);
            } else if (config.valueType === 'group') {
                const nestedKeys = this.getAuthenticationKeys(config)
                    .map(key => [config.name].concat(key));

                keys.push(...nestedKeys);
            }
        });

        return keys;
    };

    ConfigDialog.prototype.getSavedConfig = async function () {
        const secrets = await this.getConfigFromUserData(['Dialog', '__secrets__'], true) || {};
        const publicData = await this.getConfigFromUserData(['Dialog']) || {};
        return utils.deepExtend(publicData, secrets);
    };

    ConfigDialog.prototype.getConfigFromUserData = async function (keys, encrypted) {
        const opts = {
            method: 'GET',
            credentials: 'same-origin'
        };
        const url = `/api/user/data/${keys.map(encodeURIComponent).join('/')}`;
        const queryString = encrypted ? 'decrypt=true' : '';
        const response = await fetch(`${url}?${queryString}`, opts);
        return response.status < 399 ? await response.json() : null;
    };

    ConfigDialog.prototype._getAllConfigValues = function () {
        var settings = {};

        Object.keys(this._widgets).forEach(namespace => {
            settings[namespace] = {};

            Object.keys(this._widgets[namespace]).forEach(name => {
                settings[namespace][name] = this._widgets[namespace][name].getValue();
            });
        });

        return settings;
    };

    ConfigDialog.prototype.generateConfigSection = function (metadata, prevConfig, htmlClass) {
        const html = this.getConfigHtml(metadata, prevConfig, htmlClass);
        this._divContainer.append(html);
    };

    ConfigDialog.prototype.getConfigHtml = function (metadata, prevConfig, htmlClass) {
        var len = metadata.configStructure.length,
            pluginConfigEntry,
            pluginSectionEl = PLUGIN_CONFIG_SECTION_BASE.clone(),
            html = $('<div>', {class: htmlClass});

        pluginSectionEl.data(SECTION_DATA_KEY, metadata.id);
        html.append(pluginSectionEl);
        let containerEl = pluginSectionEl.find('.form-horizontal');

        if (htmlClass) {
            pluginSectionEl.addClass(htmlClass);
        }

        this._widgets[metadata.id] = {};
        for (let i = 0; i < len; i += 1) {
            pluginConfigEntry = metadata.configStructure[i];

            // Make sure not modify the global metadata.
            pluginConfigEntry = JSON.parse(JSON.stringify(pluginConfigEntry));
            if (pluginConfigEntry.writeAccessRequired === true && this._client.getProjectAccess().write === false) {
                pluginConfigEntry.readOnly = true;
            }

            const config = prevConfig && prevConfig[metadata.id];
            const entry = this.getEntryForProperty(pluginConfigEntry, config);
            if (pluginConfigEntry.valueType === 'section') {
                if (i > 0) {
                    const {name} = pluginConfigEntry;
                    html.append($(`<hr class="${name}-config-divider">`));
                }
                html.append(entry.el);
                const pluginSectionEl = PLUGIN_CONFIG_SECTION_BASE.clone();
                pluginSectionEl.data(SECTION_DATA_KEY, name);
                containerEl = pluginSectionEl.find('.form-horizontal');
                html.append(pluginSectionEl);
            } else {
                containerEl.append(entry.el);
                this._widgets[metadata.id][pluginConfigEntry.name] = entry.widget;
            }
        }
        return html;
    };

    ConfigDialog.prototype.getEntryForProperty = function (configEntry, prevConfig = {}) {
        let entry = null;
        if (ConfigDialog.ENTRIES[configEntry.valueType]) {
            entry = ConfigDialog.ENTRIES[configEntry.valueType].call(this, configEntry, prevConfig);
        } else {
            const widget = this.getWidgetForProperty(configEntry);
            const el = ENTRY_BASE.clone();
            let descEl;
            el.data(ATTRIBUTE_DATA_KEY, configEntry.name);
            el.find('label.control-label').text(configEntry.displayName);

            if (configEntry.description && configEntry.description !== '') {
                descEl = descEl || DESCRIPTION_BASE.clone();
                descEl.text(configEntry.description);
            }

            if (configEntry.minValue !== undefined &&
                configEntry.minValue !== null &&
                configEntry.minValue !== '') {
                descEl = descEl || DESCRIPTION_BASE.clone();
                descEl.append(' The minimum value is: ' + configEntry.minValue + '.');
            }

            if (configEntry.maxValue !== undefined &&
                configEntry.maxValue !== null &&
                configEntry.maxValue !== '') {
                descEl = descEl || DESCRIPTION_BASE.clone();
                descEl.append(' The maximum value is: ' + configEntry.maxValue + '.');
            }

            el.find('.controls').append(widget.el);
            if (descEl) {
                el.find('.description').append(descEl);
            }
            entry = {widget, el};
        }
        entry.id = configEntry.name;
        if (prevConfig.hasOwnProperty(entry.id)) {
            const prevValue = prevConfig[entry.id];
            entry.widget.setValue(prevValue);
        }
        return entry;
    };

    ConfigDialog.prototype.getWidgetForProperty = function (configEntry) {
        if (ConfigDialog.WIDGETS[configEntry.valueType]) {
            return ConfigDialog.WIDGETS[configEntry.valueType].call(this, configEntry);
        } else {
            return this._propertyGridWidgetManager.getWidgetForProperty(configEntry);
        }
    };

    ConfigDialog.WIDGETS = {};
    ConfigDialog.ENTRIES = {};
    ConfigDialog.ENTRIES.section = function(configEntry) {
        const sectionHeader = SECTION_HEADER.clone();
        sectionHeader.text(configEntry.displayName);
        return {el: sectionHeader};
    };

    ConfigDialog.ENTRIES.group = function(configEntry, config) {
        const widget = {el: null};
        widget.el = $('<div>', {class: configEntry.name});

        const entries = configEntry.valueItems
            .map(item => this.getEntryForProperty(item, config));

        entries.forEach(entry => widget.el.append(entry.el));

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
    };

    ConfigDialog.ENTRIES.dict = function(configEntry, config) {
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
    };

    return ConfigDialog;
});
