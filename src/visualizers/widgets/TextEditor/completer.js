/*globals define*/
// Given a global object/lib, provide the keys to autocomplete
define([
    'q',
    'text!./deepforge.json'
], function(
    Q,
    DeepForgeMethods
) {
    var MethodsByClass = JSON.parse(DeepForgeMethods),
        CommentRegex = /(--.*\n|\[\[--(.\n\s)*--\]\])/gm;
    var MethodCompleter = function(completers) {
        this._defaultCompleters = completers;
        this.completionsByClass = {};
        Object.keys(MethodsByClass).forEach(object => {
            this.completionsByClass[object] = MethodsByClass[object].map(method => {
                return {
                    name: method,
                    value: method,
                    score: 4,
                    meta: object
                };
            });
        });
    };

    MethodCompleter.prototype.getCompletions = function(editor, session, pos, prefix, callback) {
        // If adding a method (static or class) to an object, try to look up the
        // object and retrieve the methods/fields. Otherwise, fall back to default
        // completers
        var prevChar = session.getTokenAt(pos.row, pos.column-1),
            prevTextRange,
            obj,
            completions;

        if (prevChar && (prevChar.value === '.' || prevChar.value === ':')) {
            prevTextRange = session.getAWordRange(pos.row, pos.column - (prefix.length+1));
            obj = session.getTextRange(prevTextRange);

            completions = this.getCompletionsFor(obj, session, pos);
            if (completions) {
                return callback(null, completions);
            }
        }

        return this.getDefaultCompletions.apply(this, arguments);
    };

    MethodCompleter.prototype.getCompletionsFor = function(obj/*, session, pos*/) {
        return this.completionsByClass[obj];
    };

    MethodCompleter.prototype.getDefaultCompletions = function(editor, session, pos, prefix, callback) {
        var completePromises = this._defaultCompleters.map(completer =>
            Q.ninvoke(completer, 'getCompletions', editor, session, pos, prefix));

        Q.all(completePromises).then(completions => {
            callback(null, this.filterCompletions(editor, completions.reduce((l1, l2) => l1.concat(l2), [])));
        })
        .fail(err => callback(err));

    };

    MethodCompleter.prototype.filterCompletions = function(editor, completions) {
        var text = editor.getValue(),
            code = text.replace(CommentRegex, '');

        // Remove words that only show up in comments
        return completions.filter(completion => code.indexOf(completion.value) !== -1);
    };

    return MethodCompleter;
});
