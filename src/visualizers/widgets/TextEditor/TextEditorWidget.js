/*globals $, define*/
/*jshint browser: true*/

// TODO: store code editor configuration in component settings
define([
    'ace/ace',
    'underscore',
    './completer',
    'jquery-contextMenu',
    'css!./styles/TextEditorWidget.css'
], function (
    ace,
    _,
    Completer
) {
    'use strict';

    var TextEditorWidget,
        WIDGET_CLASS = 'text-editor',
        DEFAULT_SETTINGS = {
            theme: 'solarized_dark',
            fontSize: 12
        };

    TextEditorWidget = function (logger, container) {
        this._logger = logger.fork('Widget');

        this._el = container;
        this._el.css({height: '100%'});
        this.$editor = $('<div/>');
        this.$editor.css({height: '100%'});
        this._el.append(this.$editor[0]);

        this.readOnly = this.readOnly || false;
        this.editor = ace.edit(this.$editor[0]);
        this._initialize();

        // Get the config from component settings for themes
        this.editor.getSession().setOptions(this.getSessionOptions());
        this.addExtensions();
        this.editor.$blockScrolling = Infinity;
        this.DELAY = 750;
        this.silent = false;
        this.saving = false;

        this.editor.on('change', () => {
            if (!this.silent) {
                this.saving = true;
                this.onChange();
            }
        });
        this.onChange = _.debounce(this.saveText.bind(this), this.DELAY);

        this.setReadOnly(this.readOnly);
        this.currentHeader = '';
        this.activeNode = null;

        this._logger.debug('ctor finished');
    };

    TextEditorWidget.prototype.addExtensions = function () {
        require(['ace/ext/language_tools'], () => {
            this.editor.setOptions(this.getEditorOptions());
            this.completer = this.getCompleter();
            this.editor.completers = [this.completer];
        });
    };

    TextEditorWidget.prototype.getCompleter = function () {
        return new Completer(this.editor.completers);
    };

    TextEditorWidget.prototype.getEditorOptions = function () {
        return {
            enableBasicAutocompletion: true,
            enableLiveAutocompletion: true,
            theme: 'ace/theme/' + this.editorSettings.theme,
            fontSize: this.editorSettings.fontSize + 'pt'
        };
    };

    TextEditorWidget.prototype.getSessionOptions = function () {
        return {
            mode: 'ace/mode/lua',
            tabSize: 3,
            useSoftTabs: true
        };
    };

    TextEditorWidget.prototype._initialize = function () {
        // set widget class
        this._el.addClass(WIDGET_CLASS);

        // Add context menu
        $.contextMenu('destroy', '.' + WIDGET_CLASS);
        $.contextMenu({
            selector: '.' + WIDGET_CLASS,
            build: $trigger => {
                return {
                    items: this.getMenuItemsFor($trigger)
                };
            }
        });

        // Create the editor settings
        // TODO
        this.editorSettings = _.extend({}, DEFAULT_SETTINGS);
    };

    TextEditorWidget.prototype.getMenuItemsFor = function () {
        // TODO: 
        //  - copy
        //  - paste
        //  - theme
        //  - font
        //  - font size
        //  - keybindings
        //
        //  maybe some of these should be under a "Settings" option...

        // TODO: get the component settings
        var fontSizes = [8, 10, 11, 12, 14],
            themes = [
                'Solarized Light',
                'Solarized Dark',
                'Twilight',
                'Eclipse',
                'Monokai'
            ],
            menuItems = {
            setKeybindings: {
                name: 'Keybindings...',
                items: {
                    ace: {
                        name: '<span style="font-weight: bold">default</span>',
                        isHtmlName: true,
                        callback: () => console.log('setting keybindings to def')
                    },
                    vim: {
                        name: 'vim',
                        callback: () => console.log('setting keybindings to vim')
                    },
                    emacs: {
                        name: 'emacs',
                        callback: () => console.log('setting keybindings to emacs')
                    }
                }
            },
            setFontSize: {
                name: 'Font...',
                items: {}
            },
            setTheme: {
                name: 'Theme...',
                items: {}
            }
        };

        fontSizes.forEach(fontSize => {
            var name = fontSize + ' pt',
                isSet = fontSize === this.editorSettings.fontSize;

            if (isSet) {
                name = '<span style="font-weight: bold">' + name + '</span>';
            }

            menuItems.setFontSize.items['font' + fontSize] = {
                name: name,
                isHtmlName: isSet,
                callback: () => {
                    this.editorSettings.fontSize = fontSize;
                    this.editor.setOptions(this.getEditorOptions());
                    // TODO
                }
            };
        });

        themes.forEach(name => {
            var theme = name.toLowerCase().replace(/ /g, '_'),
                isSet = theme === this.editorSettings.theme;

            if (isSet) {
                name = '<span style="font-weight: bold">' + name + '</span>';
            }

            menuItems.setTheme.items[theme] = {
                name: name,
                isHtmlName: isSet,
                callback: () => {
                    this.editorSettings.theme = theme;
                    this.editor.setOptions(this.getEditorOptions());
                    // TODO
                }
            };
        });

        return menuItems;
    };

    TextEditorWidget.prototype.onWidgetContainerResize = function () {
        this.editor.resize();
    };

    // Adding/Removing/Updating items
    TextEditorWidget.prototype.getHeader = function (desc) {
        return `-- Editing "${desc.name}"`;
    };

    TextEditorWidget.prototype.addNode = function (desc) {
        // Set the current text based on the given
        // Create the header
        var header = this.getHeader(desc);

        this.activeNode = desc.id;
        this.silent = true;
        this.editor.setValue(header + '\n' + desc.text, 2);
        this.silent = false;
        this.currentHeader = header;
    };

    TextEditorWidget.prototype.saveText = function () {
        var text;

        this.saving = false;
        if (this.readOnly) {
            return;
        }

        text = this.editor.getValue()
            .replace(this.currentHeader + '\n', '');
        if (typeof this.activeNode === 'string') {
            this.saveTextFor(this.activeNode, text);
        } else {
            this._logger.error(`Active node is invalid! (${this.activeNode})`);
        }
    };

    TextEditorWidget.prototype.removeNode = function (gmeId) {
        if (this.activeNode === gmeId) {
            this.editor.setValue('');
            this.activeNode = null;
        }
    };

    TextEditorWidget.prototype.updateNode = function (desc) {
        var shouldUpdate = this.readOnly ||
            (!this.saving && !this.editor.isFocused()) ||
            (this.activeNode === desc.id && this.getHeader(desc) !== this.currentHeader);

        // Check for header changes
        if (shouldUpdate) {
            this.addNode(desc);
        }
        // TODO: Handle concurrent editing... Currently, last save wins and there are no
        // updates after opening the node. Supporting multiple users editing the same
        // operation/layer is important but more work than it is worth for now
    };

    /* * * * * * * * Visualizer life cycle callbacks * * * * * * * */
    TextEditorWidget.prototype.destroy = function () {
        this.editor.destroy();
        $.contextMenu('destroy', '.' + WIDGET_CLASS);
    };

    TextEditorWidget.prototype.onActivate = function () {
        this._logger.debug('TextEditorWidget has been activated');
    };

    TextEditorWidget.prototype.onDeactivate = function () {
        this._logger.debug('TextEditorWidget has been deactivated');
    };

    TextEditorWidget.prototype.setReadOnly = function (isReadOnly) {
        this.readOnly = isReadOnly;
        this.editor.setReadOnly(isReadOnly);
    };

    return TextEditorWidget;
});
