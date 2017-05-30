/* globals define, $*/
define([
    'js/Dialogs/PluginConfig/PluginConfigDialog',
    'text!js/Dialogs/PluginConfig/templates/PluginConfigDialog.html',
    'plugin/Export/Export/format',
    'css!./ConfigDialog.css'
], function(
    PluginConfigDialog,
    pluginConfigDialogTemplate,
    ExportFormats
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

    ConfigDialog.prototype.getFormatOptions = function() {
        this._exportFormats = Object.keys(ExportFormats);

        this._formatOptions = [];
        if (this._exportFormats.length > 1) {
            this._formatOptions.push({  // format options
                name: 'exportFormat',
                displayName: 'Export Format',
                valueType: 'string',
                value: this._exportFormats[0],
                valueItems: this._exportFormats,
                readOnly: false
            });
        }
    };

    ConfigDialog.prototype.show = function(pluginMetadata, callback) {
        this._pluginMetadata = pluginMetadata;

        this.getFormatOptions();
        this._initDialog();

        this._dialog.on('shown', () => {
            this._dialog.find('input').first().focus();
        });

        this._btnSave.on('click', event => {
            this.submit(callback);
            event.stopPropagation();
            event.preventDefault();
        });

        //save&run on CTRL + Enter
        this._dialog.on('keydown.PluginConfigDialog', event => {
            if (event.keyCode === 13 && (event.ctrlKey || event.metaKey)) {
                event.stopPropagation();
                event.preventDefault();
                this.submit(callback);
            }
        });
        this._dialog.modal('show');
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
        this._title.text(this._pluginMetadata.id + ' ' + 'v' + this._pluginMetadata.version);

        // Generate the config options
        var sectionHeader = SECTION_HEADER.clone();

        sectionHeader.text('Static Artifacts');
        this._divContainer.append(sectionHeader);
        this.generateConfigSection(this._pluginMetadata);

        if (this._exportFormats.length > 1) {
            this._divContainer.append($('<hr class="extension-config-divider">'));
            sectionHeader = SECTION_HEADER.clone();
            sectionHeader.text('Export Options');
            this._divContainer.append(sectionHeader);

            this.generateConfigSection({
                id: 'FormatOptions',
                configStructure: this._formatOptions
            });
            this._widgets.FormatOptions.exportFormat.el.find('select').on('change', event => {
                var format = event.target.value;
                // Update the ext config
                this.updateExtConfig(format);
            });
        }

        this.updateExtConfig(this._exportFormats[0]);
    };

    ConfigDialog.prototype.submit = function (callback) {
        var config = this._getAllConfigValues();
        this._dialog.modal('hide');

        if (this._exportFormats.length === 1) {
            config.FormatOptions = {
                exportFormat: this._exportFormats[0]
            };
        }
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

    ConfigDialog.prototype.updateExtConfig = function (format) {
        var extConfig = {
            id: 'extensionConfig',
            class: 'extension-config',
            configStructure: ExportFormats[format].getConfigStructure ?
                ExportFormats[format].getConfigStructure(this._node, this._client) : []
        };
        this._divContainer.find('.extension-config').remove();

        if (extConfig.configStructure.length) {
            this.generateConfigSection(extConfig);
        }
    };

    ConfigDialog.prototype.generateConfigSection = function (metadata) {
        var len = metadata.configStructure.length,
            i,
            el,
            pluginConfigEntry,
            widget,
            descEl,
            containerEl,
            pluginSectionEl = PLUGIN_CONFIG_SECTION_BASE.clone();

        pluginSectionEl.data(SECTION_DATA_KEY, metadata.id);
        this._divContainer.append(pluginSectionEl);
        containerEl = pluginSectionEl.find('.form-horizontal');

        if (metadata.class) {
            pluginSectionEl.addClass(metadata.class);
        }

        this._widgets[metadata.id] = {};
        for (i = 0; i < len; i += 1) {
            pluginConfigEntry = metadata.configStructure[i];
            descEl = undefined;

            // Make sure not modify the global metadata.
            pluginConfigEntry = JSON.parse(JSON.stringify(pluginConfigEntry));
            if (this._client.getProjectAccess().write === false && pluginConfigEntry.writeAccessRequired === true) {
                pluginConfigEntry.readOnly = true;
            }

            widget = this._propertyGridWidgetManager.getWidgetForProperty(pluginConfigEntry);
            this._widgets[metadata.id][pluginConfigEntry.name] = widget;

            el = ENTRY_BASE.clone();
            el.data(ATTRIBUTE_DATA_KEY, pluginConfigEntry.name);

            el.find('label.control-label').text(pluginConfigEntry.displayName);

            if (pluginConfigEntry.description && pluginConfigEntry.description !== '') {
                descEl = descEl || DESCRIPTION_BASE.clone();
                descEl.text(pluginConfigEntry.description);
            }

            if (pluginConfigEntry.minValue !== undefined &&
                pluginConfigEntry.minValue !== null &&
                pluginConfigEntry.minValue !== '') {
                descEl = descEl || DESCRIPTION_BASE.clone();
                descEl.append(' The minimum value is: ' + pluginConfigEntry.minValue + '.');
            }

            if (pluginConfigEntry.maxValue !== undefined &&
                pluginConfigEntry.maxValue !== null &&
                pluginConfigEntry.maxValue !== '') {
                descEl = descEl || DESCRIPTION_BASE.clone();
                descEl.append(' The maximum value is: ' + pluginConfigEntry.maxValue + '.');
            }

            el.find('.controls').append(widget.el);
            if (descEl) {
                el.find('.description').append(descEl);
            }

            containerEl.append(el);
        }
    };

    return ConfigDialog;
});
