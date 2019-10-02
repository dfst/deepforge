/* globals define, $*/
define([
    'q',
    'js/Dialogs/PluginConfig/PluginConfigDialog',
    'text!js/Dialogs/PluginConfig/templates/PluginConfigDialog.html',
    'css!./ConfigDialog.css'
], function(
    Q,
    PluginConfigDialog,
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

    var ConfigDialog = function(client, nodeId) {
        PluginConfigDialog.call(this, {client: client});
        this._widgets = {};
        this._node = this._client.getNode(nodeId);
    };

    ConfigDialog.prototype = Object.create(PluginConfigDialog.prototype);

    ConfigDialog.prototype.show = function(pluginMetadata) {
        const deferred = Q.defer();

        this._pluginMetadata = pluginMetadata;

        this._initDialog();

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

    ConfigDialog.prototype._initDialog = function() {
        this._dialog = $(pluginConfigDialogTemplate);

        this._btnSave = this._dialog.find('.btn-save');
        this._divContainer = this._dialog.find('.modal-body');
        this._saveConfigurationCb = this._dialog.find('.save-configuration');
        this._modalHeader = this._dialog.find('.modal-header');

        // Create the header
        var iconEl = $('<i/>', {
            class: this._pluginMetadata.icon.class || 'glyphicon glyphicon-cog'
        });
        iconEl.addClass('plugin-icon pull-left');
        this._modalHeader.prepend(iconEl);
        this._title = this._modalHeader.find('.modal-title');
        this._title.text(this._pluginMetadata.id + ' v' + this._pluginMetadata.version);

        // Generate the config options
        this.generateConfigSection(this._pluginMetadata);
    };

    ConfigDialog.prototype.submit = function (callback) {
        var config = this._getAllConfigValues();
        this._dialog.modal('hide');
        return callback(config);
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

    ConfigDialog.prototype.generateConfigSection = function (metadata, htmlClass) {
        const html = this.getConfigHtml(metadata, htmlClass);
        this._divContainer.append(html);
    };

    ConfigDialog.prototype.getConfigHtml = function (metadata, htmlClass) {
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
            if (this._client.getProjectAccess().write === false && pluginConfigEntry.writeAccessRequired === true) {
                pluginConfigEntry.readOnly = true;
            }

            const entry = this.getEntryForProperty(pluginConfigEntry);
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

    ConfigDialog.prototype.getEntryForProperty = function (configEntry) {
        let entry = null;
        if (ConfigDialog.ENTRIES[configEntry.valueType]) {
            entry = ConfigDialog.ENTRIES[configEntry.valueType].call(this, configEntry);
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

    ConfigDialog.ENTRIES.dict = function(configEntry) {
        const itemIds = configEntry.valueItems.map(item => item.id);
        const configForKeys = {
            name: configEntry.name,
            displayName: configEntry.displayName,
            value: itemIds[0],
            valueType: 'string',
            valueItems: itemIds
        };
        const selector = this.getEntryForProperty(configForKeys);
        const widget = {active: itemIds[0]};
        selector.el.find('select').on('change', event => {
            const {value} = event.target;
            const oldEntries = entriesForItem[widget.active];
            oldEntries.forEach(entry => entry.el.css('display', 'none'));

            widget.active = value;
            entriesForItem[widget.active]
                .forEach(entry => entry.el.css('display', ''));
        });

        widget.el = $('<div>', {class: configEntry.name});
        widget.getValue = () => {
            const id = widget.active;
            const config = {};
            entriesForItem[id].forEach(entry => {
                if (entry.widget) {
                    config[entry.id] = entry.widget.getValue();
                }
            });
            return {id, config};
        };

        widget.el.append(selector.el);

        const entriesForItem = {};
        for (let i = configEntry.valueItems.length; i--;) {
            const valueItem = configEntry.valueItems[i];
            const entries = valueItem.configStructure
                .map(item => {
                    const entry = this.getEntryForProperty(item);
                    return entry;
                });

            entries.forEach(entry => {
                if (i > 0) {
                    entry.el.css('display', 'none');
                }
                widget.el.append(entry.el);
            });

            entriesForItem[valueItem.id] = entries;
        }

        return {widget, el: widget.el};
    };

    return ConfigDialog;
});
