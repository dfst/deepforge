/* globals define, $ */
define([
    'q',
    'css!./TextPrompter.css'
], function(
    Q
) {

    const TextPrompter = function (help) {
        this.$el = $(`<div class="spotlight spotlight-overlay">
          <div class="spotlight-searchbar">
            <input class="spotlight-input empty" placeholder="${help}"></div>
          </div>
        </div>`);
        this.$input = this.$el.find('input');

        $(document.body).append(this.$el);
        this.$input.focus();
        this.$input.on('keyup', e => {
            if (e.keyCode === 13) {  // enter pressed
                const name = this.$input.val();
                this.onsubmit(name);
                this.$el[0].remove();
            } else if (e.keyCode === 27) {
                this.onexit(name);
                this.$el[0].remove();
            }
        });
    };

    TextPrompter.prototype.onexit =
    TextPrompter.prototype.onsubmit = () => {};

    TextPrompter.prompt = name => {
        const deferred = Q.defer();
        const prompter = new TextPrompter(name);

        prompter.onexit = deferred.reject;
        prompter.onsubmit = deferred.resolve;

        return deferred.promise;
    };

    return TextPrompter;
});
