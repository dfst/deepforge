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

        this._el = container;
        this._el.css({height: '100%'});
        this._el.append($(TAB_NAV));

        this.$editor = $('<div/>');
        this.$editor.css({height: '100%'});
        this._el.append(this.$editor[0]);

        // register context menu to display settings and ComponentSettings
        this._registerContextMenu();

        // register languages to the monaco editor
        this._registerLanguages();

        // Create editor with value provided by constructor
        const value = config.value  || "def dummy_python_func():\n\tpass";
        this.editor = this._createEditor(value);



        this._el = container;

        this.nodes = {};
        this._initialize();

        this._logger.debug('ctor finished');
    }

    MonacoEditorWidget.prototype._createEditor = function (value) {
        console.log(this.displaySettings);
        const editor = monaco.editor.create(
            this.$editor[0],
            {
                model: monaco.editor.createModel(value, this.language, this.monacoURI),
                automaticLayout: true,
                lightbulb: {
                    enabled: true
                },
                theme: this.displaySettings.theme,
                fontSize: this.displaySettings.fontSize
            }
        );
        this.setNavColor(this.displaySettings.navColor);
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
        const fontSizes = [8, 10, 11, 12, 14],
            themes = DEFAULT_THEMES.concat(Object.keys(ThemeList)),
            keybindings = [
                'default',
                'vim',
                'emacs'
            ],
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

                        this.displaySettings.theme = name;
                        this.onUpdateDisplaySettings();
                    }
                },
                className: 'vs-dark'
            };
        });

        keybindings.forEach(name => {
            const handler = name.toLowerCase().replace(/ /g, '_'),
                isSet = handler === this.displaySettings.keybindings;

            if (isSet) {
                name = '<span style="font-weight: bold">' + name + '</span>';
            }

            menuItems.setKeybindings.items[handler] = {
                name: name,
                isHtmlName: isSet,
                callback: () => {},
                className: 'vs-dark',
            };
        });

        return menuItems;
    };

    MonacoEditorWidget.prototype.setNavColor = function (color) {
        const $tabNav = this._el.find('.nav-display-menu');
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
                this.$b.show();
            }
        });

    };

    MonacoEditorWidget.prototype.onWidgetContainerResize = function (width, height) {
        this._logger.debug('Widget is resizing...');
    };

    // Adding/Removing/Updating items
    MonacoEditorWidget.prototype.addNode = function (desc) {
        if (desc) {
            // Add node to a table of nodes
            var node = document.createElement('div'),
                label = 'children';

            if (desc.childrenIds.length === 1) {
                label = 'child';
            }

            this.nodes[desc.id] = desc;
            node.innerHTML = 'Adding node "' + desc.name + '" (click to view). It has ' +
                desc.childrenIds.length + ' ' + label + '.';

            this._el.append(node);
            node.onclick = this.onNodeClick.bind(this, desc.id);
        }
    };

    MonacoEditorWidget.prototype.removeNode = function (gmeId) {
        // if(this.activeNode == )
    };

    MonacoEditorWidget.prototype.getText = function () {
        const model = monaco.editor.getModel(this.monacoURI);
        return model.getValue();
    };

    MonacoEditorWidget.prototype.saveText = function () {

    };

    MonacoEditorWidget.prototype.getComponentId = function () {
        return 'MonacoEditorWidget';
    };

    MonacoEditorWidget.prototype.updateNode = function (desc) {
        if (desc) {
            this._logger.debug('Updating node:', desc);
            this._el.append('<div>Updating node "' + desc.name + '"</div>');
        }
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
            // model: monaco.editor.createModel(this.modelURI),
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

    /* * * * * * * * Visualizer event handlers * * * * * * * */

    MonacoEditorWidget.prototype.onNodeClick = function (/*id*/) {
        // This currently changes the active node to the given id and
        // this is overridden in the controller.
    };

    MonacoEditorWidget.prototype.onBackgroundDblClick = function () {
        this._el.append('<div>Background was double-clicked!!</div>');
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
