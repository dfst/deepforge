/* globals browser */
describe('OperationEditor', function() {
    const URL = `http://localhost:${process.env.port || 8888}`;
    const PROJECT_NAME = `OperationEditor${Date.now()}`;
    const assert = require('assert');
    const S = require('./selectors');

    before(function() {
        browser.url(URL);
        // Create a new project
        browser.waitForVisible('.btn-create-new', 10000);
        browser.click('.btn-create-new');
        browser.setValue('.txt-project-name', PROJECT_NAME);
        browser.click('.btn-save');
        browser.waitForVisible('.btn-create-snap-shot', 10000);
        browser.click('.btn-create-snap-shot');
        browser.waitForVisible('.background-text', 10000);
    });

    after(function() {
    });

    // TODO: remove the project?

    describe('basic operations', function() {
        it('should display project name', function() {
            var elements = browser.elements('.item-label.ng-binding').value;
            var found = false;

            for (var i = elements.length; i--;) {
                if (elements[i].getText() === PROJECT_NAME) {
                    found = true;
                }
            }
            assert(found);
        });

        it.skip('should create a new project', function() {
            // TODO
        });
    });

    describe('visual-textual sync', function() {
        before(function() {
            // Create the operation
            browser.click(S.ACTION_BTN);
            browser.click(S.ACTION_BTN);
            browser.waitForEnabled(S.NEW_OPERATION, 10000);
            browser.click(S.NEW_OPERATION);
            browser.waitForEnabled(S.INT.OPERATION, 10000);
        });

        it('should add textual input on adding visual input', function() {
            browser.click(S.INT.OPERATION);
            // TODO: add textual input
        });
    });
});
