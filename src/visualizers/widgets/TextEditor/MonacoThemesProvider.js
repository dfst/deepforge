/* globals monaco, define */

define(['text!./Themes/themelist.json'], function (ThemeList) {
    const DEFAULT_THEMES = ['vs-dark', 'vs', 'hc-black'];
    ThemeList = JSON.parse(ThemeList);

    class MonacoThemesProvider {
        constructor() {
            this.importedThemes = DEFAULT_THEMES;
            this.themes = DEFAULT_THEMES.concat(Object.keys(ThemeList));
        }

        async setTheme(theme) {
            if (this.importedThemes.includes(theme)){
                monaco.editor.setTheme(theme);
            } else if (this.themes.includes(theme)){
                const themeData = await this._importTheme(theme);
                monaco.editor.defineTheme(theme, themeData);
                monaco.editor.setTheme(theme);
            } else {
                monaco.editor.setTheme(DEFAULT_THEMES[0]);
            }
        }

        async _importTheme(theme) {
            return new Promise((resolve, reject) => {
                const importName = `text!widgets/TextEditor/Themes/${(ThemeList[theme])}.json`;
                require([importName], (themeJSON) => {
                    resolve(JSON.parse(themeJSON));
                }, reject);
            });
        }
    }

    return MonacoThemesProvider;
});
