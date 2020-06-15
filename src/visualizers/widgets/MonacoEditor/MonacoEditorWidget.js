/*globals define, WebGMEGlobal, monaco, _*/

define([
    'js/Utils/ComponentSettings',
    'text!./MonacoLanguages.json',
    'text!MonacoThemes/themelist.json',
    'vs/editor/editor.main',
    'jquery-contextMenu',
    'css!./styles/MonacoEditorWidget.css',
], function (
    ComponentSettings,
    MonacoLanguages,
    ThemeList
) {
    'use strict';

    MonacoLanguages = JSON.parse(MonacoLanguages);
    ThemeList = JSON.parse(ThemeList);

    const WIDGET_CLASS = 'monaco-editor';
    const DISPLAY_MENU_CLASS = 'display-menu';
    const DEFAULT_THEMES = ['vs', 'vs-dark', 'hc-black'];
    const DEFAULT_COLORS = {
        'vs': '#fffffe',
        'vs-dark': '#1e1e1e',
        'hc-black': '#000000'
    };

    const AVAILABLE_KEYBINDINGS = ['default', 'vim'];

    const TAB_NAV = `<ul class="nav nav-tabs nav-display-menu">
                        <li class="pull-right nav-item">
                        </li>
                        <li data-role="button" class="pull-right nav-item">
                            <button class="btn btn-link ${DISPLAY_MENU_CLASS}">
                               <i class="glyphicon glyphicon-cog"></i>
                               Display Settings
                            </button>
                        </li>
                     </ul>`;

    function MonacoEditorWidget(logger, container, config={}) {
        this._logger = logger.fork('Widget');
        this.modelURI = config.modelURI || 'inmemory://code.py';
        this.monacoURI = monaco.Uri.parse(this.modelURI);
        this.language = config.language || 'python';
        this.keyBindingAdapter = null;

        this._el = container;
        this._el.css({height: '100%'});
        this._el.append($(TAB_NAV));

        this.$editor = $('<div/>');
        this.$status = $('<div/>');
        this.$editor.css({height: '100%'});
        this._el.append(this.$editor[0]);
        this._el.append(this.$status[0]);

        this.readOnly = config.readOnly || false;

        // register context menu to display settings and ComponentSettings
        this._registerContextMenu();

        // register languages to the monaco editor
        this._registerLanguages();

        // Create editor with value provided by constructor
        const value = config.value  || "def dummy_python_func():\n\tpass";
        this.editor = this._createEditor(value);
        this.DELAY = 750;

        this.editor.onDidChangeModelContent(() => {
            if(!this.silent) {
                this.saving = true;
                this.onChange();
            }
        });

        this.onChange = _.debounce(this.saveText.bind(this), this.DELAY);
        this.currentHeader = '';
        this.activeNode = null;

        this.$settingsBtn = this._el.find(`.${DISPLAY_MENU_CLASS}`);

        this.nodes = {};
        this._initialize();

        this._logger.debug('ctor finished');
    }

    MonacoEditorWidget.prototype._createEditor = function (value) {
        if (!DEFAULT_THEMES.includes(this.displaySettings.theme)) {
            this.importTheme(this.displaySettings.theme, ThemeList[this.displaySettings.theme]);
            this.setNavColor(this.displaySettings.navColor);
        }
        const editor = monaco.editor.create(
            this.$editor[0],
            {
                model: monaco.editor.createModel(value, this.language, this.monacoURI),
                automaticLayout: true,
                lightbulb: {
                    enabled: true
                },
                fontSize: this.displaySettings.fontSize,
                readOnly: this.readOnly
            }
        );
        this.activateKeyBinding(this.displaySettings.keybindings);
        return editor;
    };

    MonacoEditorWidget.prototype._registerContextMenu = function () {
        const selector = `.${DISPLAY_MENU_CLASS}`;

        $.contextMenu({
            selector: selector,
            className: 'vs-dark',
            trigger: 'left',
            build: $trigger => {
                return{
                    items: this.getMenuItemsFor($trigger)
                };
            }
        });

        this.displaySettings = Object.assign({}, this.getDefaultDisplayOptions());

        ComponentSettings.resolveWithWebGMEGlobal(
            this.displaySettings,
            this.getComponentId()
        );
    };

    MonacoEditorWidget.prototype.getMenuItemsFor = function () {
        const fontSizes = [8, 10, 11, 12, 14, 16],
            themes = DEFAULT_THEMES.concat(Object.keys(ThemeList)),
            menuItems = {
                setKeybindings: {
                    name: 'Keybindings...',
                    className: 'vs-dark',
                    items: {}
                },
                setFontSize: {
                    name: 'Font Size...',
                    items: {},
                    className: 'vs-dark',
                },
                setTheme: {
                    name: 'Theme...',
                    items: {},
                    className: 'vs-dark',
                }
            };

        fontSizes.forEach(fontSize => {
            var name = fontSize + ' pt',
                isSet = fontSize === this.displaySettings.fontSize;

            if (isSet) {
                name = '<span style="font-weight: bold">' + name + '</span>';
            }

            menuItems.setFontSize.items['font' + fontSize] = {
                name: name,
                isHtmlName: isSet,
                callback: () => {
                    this.editor.updateOptions({
                        fontSize: fontSize
                    });
                    this.displaySettings.fontSize = fontSize;
                    this.onUpdateDisplaySettings();
                },
                className: 'vs-dark'
            };
        });

        themes.forEach(theme => {
            let name = theme.toLowerCase();
            const isSet = name === this.displaySettings.theme;

            if (isSet) {
                name = '<span style="font-weight: bold">' + name + '</span>';
            }

            menuItems.setTheme.items[name] = {
                name: name,
                isHtmlName: isSet,
                callback: async () => {
                    if(DEFAULT_THEMES.includes(name)) {
                        monaco.editor.setTheme(name);
                        this.setNavColor(DEFAULT_COLORS[name]);
                    } else {
                        let themeName = name;

                        if (isSet) {
                            themeName = theme.toLowerCase();
                        }

                        await this.importTheme(themeName, ThemeList[theme]);
                    }
                    this.displaySettings.theme = theme;
                    this.onUpdateDisplaySettings();
                },
                className: 'vs-dark'
            };
        });

        AVAILABLE_KEYBINDINGS.forEach(name => {
            const handler = name.toLowerCase().replace(/ /g, '_'),
                isSet = handler === this.displaySettings.keybindings;

            if (isSet) {
                name = '<span style="font-weight: bold">' + name + '</span>';
            }

            menuItems.setKeybindings.items[handler] = {
                name: name,
                isHtmlName: isSet,
                callback: () => {
                    this.activateKeyBinding(handler);
                    this.displaySettings.keybindings = handler;
                    this.onUpdateDisplaySettings();
                },
                className: 'vs-dark',
            };
        });

        return menuItems;
    };

    MonacoEditorWidget.prototype.setNavColor = function (color) {
        const $tabNav = this._el.find('.nav-display-menu');
        $tabNav.css({
            'background-color': ''
        });
        $tabNav.css({
            'background-color': color
        });
        this.displaySettings.navColor = color;
    };

    MonacoEditorWidget.prototype.importTheme = async function (name, theme) {
        if(!(name && theme)){
            return;
        }
        const themeURL = `text!MonacoThemes/${theme}.json`;
        const self = this;
        return new Promise((resolve, reject) => {
            require([themeURL], function (themeJSON) {
                themeJSON = JSON.parse(themeJSON);
                monaco.editor.defineTheme(name, themeJSON);
                monaco.editor.setTheme(name);
                if(themeJSON.colors['editor.background']){
                    self.setNavColor(themeJSON.colors['editor.background']);
                }
                resolve();
            }, reject);
        });
    };

    MonacoEditorWidget.prototype.activateKeyBinding = function(keybinding) {
        if (keybinding === 'default' && this.displaySettings.keybindings === 'vim') {
            this.disposeVimMode();
        } else if(keybinding === 'vim') {
            this.initVimMode();
        }
    };

    MonacoEditorWidget.prototype.initVimMode = function () {
        const self = this;
        return new Promise((resolve, reject) => {
            require(['MonacoVim'], function (MonacoVim) {
                self.keyBindingAdapter = MonacoVim.initVimMode(self.editor, self.$status[0]);
                resolve();
            }, reject);
        });
    };

    MonacoEditorWidget.prototype.disposeVimMode = function() {
        if(this.keyBindingAdapter) {
            this.keyBindingAdapter.dispose();
            this.keyBindingAdapter = null;
        }
    };

    MonacoEditorWidget.prototype._registerLanguages = function() {
        const languages = Object.keys(MonacoLanguages);
        languages.forEach(language => {
            monaco.languages.register(
                MonacoLanguages[language]
            );
        });
    };

    MonacoEditorWidget.prototype._initialize = function() {
        this._el.addClass(WIDGET_CLASS);
        this.addEditorActions();
    };

    MonacoEditorWidget.prototype.addEditorActions = function () {
        this.editor.addAction({
            id: 'displaySettings',
            label: 'Display Settings',
            keybindings: [
                monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.KEY_S
            ],
            precondition: null,
            keybindingContext: null,
            contextMenuGroupId: 'settings',
            contextMenuOrder: 1.5,
            run: () => {
                this.$settingsBtn.click();
            }
        });

    };

    MonacoEditorWidget.prototype.onWidgetContainerResize = function (width, height) {
        this._logger.debug('Widget is resizing...');
    };

    // Adding/Removing/Updating items
    MonacoEditorWidget.prototype.addNode = function (desc) {
        const header = this.getHeader(desc),
            newContent = header ? header + '\n' + desc.text : desc.text;

        this.activeNode = desc.id;

        this.silent = true;

        this.editor.setValue(newContent);

        this.silent = false;
        this.currentHeader = header;
    };

    MonacoEditorWidget.prototype.removeNode = function (gmeId) {
        if (this.activeNode === gmeId) {
            if(this.saving){
                this.saveText();
            }
            this.editor.setValue('');
            this.activeNode = null;
        }
    };

    MonacoEditorWidget.prototype.getText = function () {
        const model = monaco.editor.getModel(this.monacoURI);
        return model.getValue();
    };

    MonacoEditorWidget.prototype.saveText = function () {
        let text;
        this.saving = false;

        if(this.readOnly) {
            return;
        }

        text = this.editor.getValue();

        if(this.currentHeader) {
            text = text.replace(this.currentHeader + '\n', '');
        }

        if(typeof  this.activeNode === 'string') {
            this.saveTextFor(this.activeNode, text);
        } else {
            this._logger.error(`Active node is invalid! (${this.activeNode})`);
        }
    };

    MonacoEditorWidget.prototype.getComponentId = function () {
        return 'MonacoEditorWidget';
    };

    MonacoEditorWidget.prototype.updateNode = function (desc) {
        const shouldUpdate = this.readOnly ||
            (!this.saving && this.editor.hasTextFocus()) ||
            (this.activeNode === desc.id && this.getHeader(desc) !== this.currentHeader);

        if(shouldUpdate){
            this.addNode(desc);
        }
    };

    MonacoEditorWidget.prototype.getHeader = function() {
        return '';
    };

    MonacoEditorWidget.prototype.getDefaultDisplayOptions = function () {
        return {
            keybindings: 'default',
            theme: 'vs-dark',
            fontSize: 12
        };
    };

    MonacoEditorWidget.prototype.getDefaultEditorOptions = function() {
        return {
            glyphMargin: true,
            lightbulb: {
                enabled: true,
            },
            theme: 'vs-dark',
            automaticLayout: true
        };
    };

    MonacoEditorWidget.prototype.onUpdateDisplaySettings = function () {
        ComponentSettings.overwriteComponentSettings(
            this.getComponentId(),
            this.displaySettings,
            err => err && this._logger.error(`Could not save editor settings: ${err}`)
        );
    };

    /* * * * * * * * Visualizer life cycle callbacks * * * * * * * */
    MonacoEditorWidget.prototype.destroy = function () {
    };

    MonacoEditorWidget.prototype.onActivate = function () {
        this._logger.debug('MonacoEditorWidget has been activated');
    };

    MonacoEditorWidget.prototype.onDeactivate = function () {
        this._logger.debug('MonacoEditorWidget has been deactivated');
    };

    return MonacoEditorWidget;
});
