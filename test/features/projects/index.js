/* globals browser */
describe.skip('projects', function() {
    const URL = `http://localhost:${process.env.port || 8888}`;
    const PROJECT_NAME = `OperationEditor${Date.now()}`;
    const assert = require('assert');
    const S = require('../selectors');

    before(function() {
    });

    after(function() {
    });

    // TODO: remove the project?

    describe('creation', function() {
        it('should create project', function() {
            browser.url(URL);
            // Create a new project
            browser.waitForVisible('.btn-create-new', 10000);
            browser.click('.btn-create-new');
            browser.setValue('.txt-project-name', PROJECT_NAME);
            browser.click('.btn-save');
            browser.waitForVisible('.btn-create-snap-shot', 10000);
            browser.click('.btn-create-snap-shot');
            browser.waitForVisible('.background-text', 10000);
            //var elements = browser.elements('.item-label.ng-binding').value;
            //var found = false;

            //for (var i = elements.length; i--;) {
                //if (elements[i].getText() === PROJECT_NAME) {
                    //found = true;
                //}
            //}
            //assert(found);
        });

        it.skip('should create a new project', function() {
            // TODO
        });
    });
});
