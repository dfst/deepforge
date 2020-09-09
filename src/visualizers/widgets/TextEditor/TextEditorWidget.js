/*globals $, define, monaco */
/*jshint browser: true*/

define([
    'underscore',
    'js/Utils/ComponentSettings',
    'text!./MonacoLanguages.json',
    'vs/editor/editor.main',
    'jquery-contextMenu',
    'css!./styles/TextEditorWidget.css'
], function (
    _,
    ComponentSettings,
    MonacoLanguages
) {
    'use strict';

    const WIDGET_CLASS = 'text-editor';

    MonacoLanguages = JSON.parse(MonacoLanguages);
    const DEFAULT_THEMES = ['vs-dark', 'vs', 'hc-black'];

    const AVAILABLE_KEYBINDINGS = ['default', 'vim'];

    const TextEditorWidget = function (logger, container, config={}) {
        this.logger = logger.fork('Widget');
        this._registerMonacoLanguages();
        this.language = this.language || config.language || 'python';
        this.destroyed = false;
        this.monacoURI = this._getMonacoURI();
        const value = config.value || '';
        this.model = monaco.editor.getModel(this.monacoURI) ||
            monaco.editor.createModel(
                value,
                this.language,
                this.monacoURI
            );
        this.model.updateOptions({
            tabSize: 4,
            insertSpaces: true
        });

        const displayMiniMap = config.displayMiniMap !== false;

        this._el = container;
        this._el.css({height: '100%'});
        this.$editor = $('<div/>');
        this.$status = $('<div/>'); // required for vim keybinding
        this.$editor.css({height: '100%'});
        this._el.append(this.$editor[0]);
        this._el.append(this.$status[0]);

        this.readOnly = this.readOnly || false;
        this.editor = this._createEditor(displayMiniMap);
        this.DELAY = 750;
        this.silent = false;
        this.saving = false;
        this.count = 0;

        this.model.onDidChangeContent(() => {
            if (!this.silent) {
                this.saving = true;
                this.onChange();
            }
        });

        this.onChange = _.debounce(this.saveText.bind(this), this.DELAY);
        this.currentHeader = '';
        this.activeNode = null;

        this.vimImported = this._importMonacoVim();

        this.nodes = {};
        this._initialize();
        this.logger.debug('ctor finished');
    };

    TextEditorWidget.prototype._getMonacoURI = function () {
        const modelSuffix = Math.random().toString(36).substring(2, 15);
        return monaco.Uri.parse(
            `inmemory://model_${modelSuffix}.${MonacoLanguages[this.language].extensions[0]}`
        );
    };

    TextEditorWidget.prototype._importMonacoVim = async function () {
        const self = this;
        return new Promise((resolve, reject) => {
            require(['MonacoVim'], function (MonacoVim) {
                self.MonacoVim = MonacoVim;
                resolve();
            }, reject);
        });
    };

    TextEditorWidget.prototype._createEditor = function (displayMiniMap) {
        const editor = monaco.editor.create(
            this.$editor[0], {
                model: this.model,
                automaticLayout: true,
                lightbulb: {
                    enabled: true
                },
                fontSize: 14,
                readOnly: this.readOnly,
                minimap: {
                    enabled: displayMiniMap
                },
                theme: DEFAULT_THEMES[0],
                contextmenu: false
            }
        );

        return editor;
    };

    TextEditorWidget.prototype.getEditorOptions = function () {
        return {
            keybindings: this.editorSettings.keybindings,
            theme: this.editorSettings.theme,
            fontSize: this.editorSettings.fontSize + 'pt',
            fontFamily: this.editorSettings.fontFamily
        };
    };

    TextEditorWidget.prototype.getDefaultEditorOptions = function () {
        return {
            keybindings: 'default',
            theme: 'vs-dark',
            fontSize: 12,
            fontFamily: 'source'
        };
    };

    TextEditorWidget.prototype._initialize = function () {
        // set widget class
        this._el.addClass(WIDGET_CLASS);
        const selector = `.${WIDGET_CLASS}`;

        // Add context menu
        $.contextMenu('destroy', selector);
        this._el.contextmenu(event => {
            const altMenu = event.shiftKey || event.ctrlKey;
            if (altMenu) {
                this._el.contextMenu({x: event.pageX, y: event.pageY});
                event.preventDefault();
                event.stopPropagation();
            }
        });
        $.contextMenu({
            selector: selector,
            trigger: 'none',
            build: $trigger => {
                return {
                    items: this.getMenuItemsFor($trigger)
                };
            }
        });

        this.editorSettings = _.extend({}, this.getDefaultEditorOptions()),
        ComponentSettings.resolveWithWebGMEGlobal(
            this.editorSettings,
            this.getComponentId()
        );
        if (this.editorSettings.keybindings === 'vim') {
            this.initVimKeyBindings();
        }
    };

    TextEditorWidget.prototype.initVimKeyBindings = async function () {
        await this.vimImported;
        if (!this.destroyed) {
            this.vimMode = this.MonacoVim.initVimMode(
                this.editor,
                this.$status[0]
            );
        }
    };

    TextEditorWidget.prototype.disposeVimMode = function() {
        if(this.vimMode) {
            this.vimMode.dispose();
        }
    };

    TextEditorWidget.prototype._registerMonacoLanguages = function () {
        const languages = Object.keys(MonacoLanguages);
        languages.forEach(language => {
            monaco.languages.register(
                MonacoLanguages[language]
            );
        });
    };

    TextEditorWidget.prototype.getDefaultEditorOptions = function () {
        return {
            keybindings: 'default',
            theme: 'vs-dark',
            fontSize: 12
        };
    };

    TextEditorWidget.prototype.getComponentId = function () {
        return 'TextEditor';
    };

    TextEditorWidget.prototype.getMenuItemsFor = function () {
        var fontSizes = [8, 10, 11, 12, 14],
            themes = DEFAULT_THEMES,
            keybindings = AVAILABLE_KEYBINDINGS,
            menuItems = {
                setKeybindings: {
                    name: 'Keybindings...',
                    items: {}
                },
                setFontSize: {
                    name: 'Font Size...',
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
                    this.editor.updateOptions(this.getEditorOptions());
                    this.onUpdateEditorSettings();
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
                    monaco.editor.setTheme(theme);
                    this.onUpdateEditorSettings();
                }
            };
        });

        keybindings.forEach(name => {
            var handler = name.toLowerCase().replace(/ /g, '_'),
                isSet = handler === this.editorSettings.keybindings;

            if (isSet) {
                name = '<span style="font-weight: bold">' + name + '</span>';
            }

            menuItems.setKeybindings.items[handler] = {
                name: name,
                isHtmlName: isSet,
                callback: () => {
                    this.editorSettings.keybindings = handler;
                    switch (handler) {
                        case 'vim':
                            this.initVimKeyBindings();
                        default:
                            this.disposeVimMode();
                    }
                    this.onUpdateEditorSettings();
                }
            };
        });

        return menuItems;
    };

    TextEditorWidget.prototype.onUpdateEditorSettings = function () {
        ComponentSettings.overwriteComponentSettings(this.getComponentId(), this.editorSettings,
            err => err && this.logger.error(`Could not save editor settings: ${err}`));
    };

    TextEditorWidget.prototype.onWidgetContainerResize = function () {
        this.editor.layout();
    };

    // Adding/Removing/Updating items
    TextEditorWidget.prototype.comment = function (text) {
        const commentToken = MonacoLanguages[this.language].comment + ' ';
        return text.replace(
            new RegExp('^(' + commentToken + ')?','mg'),
            commentToken
        );
    };

    TextEditorWidget.prototype.getHeader = function (/*desc*/) {
        return '';
    };

    TextEditorWidget.prototype.addNode = function (desc) {
        // Set the current text based on the given
        // Create the header
        const header = this.getHeader(desc),
            newContent = header ? header + '\n' + desc.text : desc.text;

        this.activeNode = desc.id;
        this.silent = true;
        const prevPosition = this.editor.getPosition();
        this.editor.setValue(newContent);
        this.editor.setPosition(prevPosition);

        this.silent = false;
        this.currentHeader = header;
    };


    TextEditorWidget.prototype.saveText = function () {
        var text;

        this.saving = false;
        if (this.readOnly) {
            return;
        }

        text = this.editor.getValue();
        if (this.currentHeader) {
            text = text.replace(this.currentHeader + '\n', '');
        }

        if (typeof this.activeNode === 'string') {
            this.saveTextFor(this.activeNode, text);
        } else {
            this.logger.error(`Active node is invalid! (${this.activeNode})`);
        }
    };

    TextEditorWidget.prototype.removeNode = function (gmeId) {
        if (this.activeNode === gmeId) {
            if (this.saving) {
                this.saveText();
            }

            this.editor.setValue('');
            this.activeNode = null;
        }
    };

    TextEditorWidget.prototype.updateNode = function (desc) {
        var shouldUpdate = this.readOnly ||
            (!this.saving && !this.editor.hasTextFocus()) ||
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
        this.readOnly = true;
        this.destroyed = true;
        this.editor.dispose();
        this.model.dispose();
        this.disposeVimMode();
        $.contextMenu('destroy', '.' + WIDGET_CLASS);
    };

    TextEditorWidget.prototype.onActivate = function () {
        this.logger.debug('TextEditorWidget has been activated');
    };

    TextEditorWidget.prototype.onDeactivate = function () {
        this.logger.debug('TextEditorWidget has been deactivated');
    };

    TextEditorWidget.prototype.setReadOnly = function (isReadOnly) {
        this.readOnly = isReadOnly;
        this.editor.updateOptions({
            readOnly: isReadOnly
        });
    };

    return TextEditorWidget;
});
