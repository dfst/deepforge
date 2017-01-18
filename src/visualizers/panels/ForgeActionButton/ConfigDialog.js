/* globals define, $*/
define([
    'js/Dialogs/PluginConfig/PluginConfigDialog',
    'text!js/Dialogs/PluginConfig/templates/PluginConfigDialog.html',
    'plugin/GenerateExecFile/GenerateExecFile/format'
], function(
    PluginConfigDialog,
    pluginConfigDialogTemplate,
    ExportFormats
) {
    var PLUGIN_DATA_KEY = 'plugin',
        ATTRIBUTE_DATA_KEY = 'attribute',
    //jscs:disable maximumLineLength
        PLUGIN_CONFIG_SECTION_BASE = $('<div><fieldset><form class="form-horizontal" role="form"></form><fieldset></div>'),
        ENTRY_BASE = $('<div class="form-group"><div class="row"><label class="col-sm-4 control-label">NAME</label><div class="col-sm-8 controls"></div></div><div class="row description"><div class="col-sm-4"></div></div></div>'),
    //jscs:enable maximumLineLength
        DESCRIPTION_BASE = $('<div class="desc muted col-sm-8"></div>');

    var ConfigDialog = function(client, nodeId) {
        PluginConfigDialog.call(this, {client: client});
        this._widgets = {};
        this._node = this._client.getNode(nodeId);
    };

    ConfigDialog.prototype = Object.create(PluginConfigDialog.prototype);

    ConfigDialog.prototype.show = function(globalOptions, pluginMetadata, extMetadata, callback) {
        this._extMetadata = extMetadata;
        return PluginConfigDialog.prototype.show.call(this, globalOptions, pluginMetadata, {}, callback);
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
        var format = Object.keys(ExportFormats)[0],
            extConfig = {
                configStructure: ExportFormats[format].getConfigStructure ?
                ExportFormats[format].getConfigStructure(this._client, this._node) : []
            };

        this.generateExtConfig({configStructure: this._globalOptions});

        this._divContainer.append($('<hr class="extension-config-divider">'));

        this.generateExtConfig(extConfig);

        if ((this._globalOptions.length || extConfig.configStructure.length) && this._pluginMetadata.configStructure.length) {
            this._divContainer.append($('<hr class="extension-and-inputs-divider">'));
        }

        this.generateExtConfig(this._pluginMetadata);

        // TODO: When the Export Format is set, update the extension configuration opts
        // TODO:
    };

    ConfigDialog.prototype.generateExtConfig = function (metadata) {
        var len = metadata.configStructure.length,
            i,
            el,
            pluginConfigEntry,
            widget,
            descEl,
            containerEl,
            pluginSectionEl = PLUGIN_CONFIG_SECTION_BASE.clone();

        pluginSectionEl.data(PLUGIN_DATA_KEY, metadata.id);
        this._divContainer.append(pluginSectionEl);
        containerEl = pluginSectionEl.find('.form-horizontal');

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
