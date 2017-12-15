/* globals browser */
describe('Operations', function() {
    const PROJECT_NAME = `OperationTests${Date.now()}`;

    const testFixture = require('../../globals');
    const gmeConfig = testFixture.getGmeConfig();
    const utils = require('../utils');
    const URL = utils.getUrl(PROJECT_NAME);
    const logger = testFixture.logger.fork('ExecuteJob');
    const Operation = require('../../../src/common/OperationCode');
    const assert = require('assert');

    const S = require('../selectors');
    let storage;
    let gmeAuth;
    let project;
    let commitHash;

    this.timeout(20000);
    before(function(done) {
        testFixture.clearDBAndGetGMEAuth(gmeConfig, PROJECT_NAME)
            .then(function (gmeAuth_) {
                gmeAuth = gmeAuth_;
                // This uses in memory storage. Use testFixture.getMongoStorage to persist test to database.
                storage = testFixture.getMongoStorage(logger, gmeConfig, gmeAuth);
                return storage.openDatabase();
            })
            .then(function () {
                var importParam = {
                    projectSeed: testFixture.path.join(testFixture.DF_SEED_DIR, 'tests', 'tests.webgmex'),
                    projectName: PROJECT_NAME,
                    branchName: 'master',
                    logger: logger,
                    gmeConfig: gmeConfig
                };

                return testFixture.importProject(storage, importParam);
            })
            .then(function (importResult) {
                project = importResult.project;
                commitHash = importResult.commitHash;
                return project.createBranch('test', commitHash);
            })
            .nodeify(done);
    });

    after(function(done) {
        storage.closeDatabase()
            .then(function () {
                return gmeAuth.unload();
            })
            .nodeify(done);
    });

    describe.skip('creation', function() {
        let newOperationUrl = utils.getUrl(PROJECT_NAME, '/f/G');
        //beforeEach(function() {  // open the project
            //let projectBtn = '.project-list .open-link';
            //browser.url(URL);
            //browser.waitForVisible(projectBtn, 5000);
            //browser.click(projectBtn);
        //});

        it('should be able to create a new operation', function() {
            browser.url(URL);
            browser.waitForVisible('#pluginBtn', 10000);
            browser.click('#pluginBtn');
            browser.waitForVisible('.pipeline-editor', 1000);
        });
    });

    describe('editing', function() {
        let newOperationUrl = utils.getUrl(PROJECT_NAME, '/k/8', 'test');
        let existingOperationUrl = utils.getUrl(PROJECT_NAME, '/k/F', 'test');
        let getCurrentCode = function() {
            var ace = requirejs('ace/ace');
            var editor = ace.edit($('.ace_editor')[0]);
            
            return editor.getSession().getValue();
        };
        let setCurrentCode = function(code) {
            var ace = requirejs('ace/ace');
            var editor = ace.edit($('.ace_editor')[0]);
            return editor.getSession().setValue(code);
        };

        describe('interface editor', function() {
            beforeEach(function(done) {
                project.getBranchHash('test')
                    .then(commitHash => project.deleteBranch('test', commitHash))
                    .then(() => project.createBranch('test', commitHash))
                    .nodeify(done);
            });

            describe('add input', function() {
                before(function() {
                    browser.url(newOperationUrl);
                    browser.waitForVisible(S.INT.OPERATION, 10000);
                    browser.leftClick(S.INT.OPERATION);
                    browser.waitForVisible(S.INT.ADD_INPUT, 10000);
                    browser.leftClick(S.INT.ADD_INPUT);
                });

                it('should add input to interface', function() {
                    browser.waitForVisible(S.INT.INPUT, 2000);
                });

                it('should update code on add input', function() {
                    browser.waitForVisible(S.INT.INPUT, 2000);

                    // check the code value
                    let code = browser.execute(getCurrentCode).value;
                    let operation = new Operation(code);
                    let inputs = operation.getInputs();
                    assert.equal(inputs.length, 1);
                });
            });

            describe('add output', function() {

                before(function() {
                    browser.url(newOperationUrl);
                    browser.waitForVisible(S.INT.OPERATION, 10000);
                    browser.leftClick(S.INT.OPERATION);
                    browser.waitForVisible(S.INT.ADD_OUTPUT, 10000);
                    browser.leftClick(S.INT.ADD_OUTPUT);
                });

                it('should update interface on add output', function() {
                    browser.waitForVisible(S.INT.OUTPUT, 2000);
                });

                it('should update code on add output', function() {
                    // Check that the execute method now returns an output
                    let code = browser.execute(getCurrentCode).value;
                    let operation = new Operation(code);
                    assert.equal(operation.getOutputs().length, 1);
                });
            });

            describe('add attribute', function() {
                const attrName = 'newAttrName';
                before(function() {
                    browser.url(newOperationUrl);
                    browser.waitForVisible(S.INT.OPERATION, 10000);
                    browser.leftClick(S.INT.OPERATION);
                    browser.waitForVisible(S.INT.ADD_ATTR, 2000);
                    browser.leftClick(S.INT.ADD_ATTR);
                    browser.waitForVisible(S.INT.EDIT_ATTR.NAME, 10000);
                    browser.leftClick(S.INT.EDIT_ATTR.NAME);
                    browser.waitUntil(function() {
                        return browser.hasFocus(S.INT.EDIT_ATTR.NAME);
                    });
                    browser.keys(attrName);
                    browser.leftClick(S.INT.EDIT_ATTR.SAVE);
                });

                it('should add attribute to model', function() {
                    browser.leftClick(S.INT.OPERATION);
                    browser.waitForVisible(S.INT.CREATE_ATTR, 20000);
                    browser.waitUntil(function() {
                        return browser.isVisible(S.INT.ATTR_NAME);
                    }, 5000, 'attribute is not visible');
                });

                it('should add attribute to code', function() {
                    let code = browser.execute(getCurrentCode).value;
                    let operation = new Operation(code);
                    assert.equal(operation.getAttributes().length, 1);
                });
            });

            // remove input data
            describe('remove input', function() {
                before(function() {
                    browser.url(existingOperationUrl);
                    browser.waitForVisible(S.INT.INPUT, 10000);
                    browser.leftClick(S.INT.INPUT);
                    browser.waitForVisible(S.INT.DELETE, 10000);
                    browser.leftClick(S.INT.DELETE);
                });

                it('should remove input from interface', function() {
                    browser.waitUntil(function() {
                        return !browser.isVisible(S.INT.INPUT);
                    }, 5000, 'input is visible');
                });

                it('should remove input from code', function() {
                    let code = browser.execute(getCurrentCode).value;
                    let operation = new Operation(code);
                    assert.equal(operation.getInputs().length, 0);
                });
            });

            // remove output data
            describe('remove output', function() {
                before(function() {
                    browser.url(existingOperationUrl);
                    browser.waitForVisible(S.INT.OUTPUT, 10000);
                    browser.leftClick(S.INT.OUTPUT);
                    browser.waitForVisible(S.INT.DELETE, 10000);
                    browser.leftClick(S.INT.DELETE);
                });

                it('should remove output from interface', function() {
                    browser.waitUntil(function() {
                        return !browser.isVisible(S.INT.OUTPUT);
                    }, 5000, 'output is visible');
                });

                it('should remove output from code', function() {
                    let code = browser.execute(getCurrentCode).value;
                    let operation = new Operation(code);
                    assert.equal(operation.getOutputs().length, 0);
                });
            });

            // remove attribute
            describe('remove attribute', function() {
                let attr = 'iterations';
                before(function() {
                    browser.url(existingOperationUrl);
                    browser.waitForVisible(S.INT.OPERATION, 10000);
                    browser.leftClick(S.INT.OPERATION);
                    browser.waitForVisible(S.INT.ATTR_NAME, 10000);
                    browser.leftClick(S.INT.ATTR_NAME);

                    browser.waitForVisible(S.INT.EDIT_ATTR.DELETE, 10000);
                    attr = browser.getValue(S.INT.EDIT_ATTR.NAME);
                    browser.leftClick(S.INT.EDIT_ATTR.DELETE);
                });

                it('should remove output from interface', function() {
                    browser.waitForVisible(S.INT.ATTR_NAME, 10000);
                    browser.waitUntil(function() {
                        let attr = null;
                        try {
                            attr = browser.selectByVisibleText(S.INT.ATTR_NAME, `${attr}: `);
                        } catch (e) {
                            if (!e.message.includes('An element could not be located on the page')) {
                                throw e;
                            }
                        }
                        return !attr;
                    }, 5000, `${attr} attribute still exists in the model`);
                });

                it('should remove attribute from code', function() {
                    let code = browser.execute(getCurrentCode).value;
                    let operation = new Operation(code);
                    let attrNames = operation.getAttributes().map(attr => attr.name);

                    assert(!attrNames.includes(attr));
                });
            });

            // rename operation
            describe('rename operation', function() {
                const oldName = 'ExistingOperation';
                const newName = 'SomeNewName';
                before(function() {
                    browser.url(existingOperationUrl);
                    browser.waitForVisible(S.PANEL_TITLE, 10000);
                    browser.leftClick(S.PANEL_TITLE);
                    utils.sleep(100);
                    // delete current name
                    const deleteKeys = oldName.split('').map(() => 'Delete');
                    browser.keys(deleteKeys);
                    // enter new name
                    browser.keys(newName);
                    browser.keys(['Enter']);
                });

                it('should update the model', function() {
                    browser.waitUntil(function() {
                        const title = browser.getText(S.PANEL_TITLE);
                        return title === newName;
                    }, 15000, 'Expected output node to be removed within 1.5s');
                });

                it('should update the operation code', function() {
                    let code = browser.execute(getCurrentCode).value;
                    let operation = new Operation(code);
                    assert.equal(operation.getName(), newName);
                });
            });

            // add reference (only from int editor)
            // TODO

        });

        describe('code editor', function() {
            const updateOpCode = fn => {
                browser.waitForVisible('.operation-interface-editor', 20000);
                // wait until the code is showing
                let code = null;
                browser.waitUntil(function() {
                    code = browser.execute(getCurrentCode).value;
                    return !!code;
                }, 5000, 'Expected code to appear within 5s');

                // get the code from the editor
                let operation = new Operation(code);

                fn(operation);

                // set the code in the editor 
                code = operation.getCode();
                browser.execute(setCurrentCode, code).value;
            };

            beforeEach(function(done) {
                project.getBranchHash('test')
                    .then(commitHash => project.deleteBranch('test', commitHash))
                    .then(() => project.createBranch('test', commitHash))
                    .nodeify(done);
            });

            // Should I create all the branches at the beginning or import a new project each time?
            it('should add input to model', function() {
                browser.url(newOperationUrl);
                // add input to 'execute' method
                updateOpCode(operation => operation.addInput('newInput'));

                // check that it shows in the interface editor
                browser.waitForVisible(S.INT.INPUT, 20000);
            });

            it('should add output to model', function() {
                browser.url(newOperationUrl);
                // add output to 'execute' method
                updateOpCode(operation => operation.addOutput('result'));

                // check that it shows in the interface editor
                browser.waitForVisible(S.INT.OUTPUT, 20000);
            });

            it('should add attribute to model', function() {
                browser.url(newOperationUrl);

                updateOpCode(operation => operation.addAttribute('newAttribute'));

                // check that it shows in the interface editor
                browser.leftClick(S.INT.OPERATION);
                browser.waitForVisible(S.INT.ATTR_NAME, 20000);
            });

            // Set attribute default values
            it('should add attribute (w/ default) to model', function() {
                browser.url(newOperationUrl);

                updateOpCode(operation => operation.addAttribute('newAttribute', 10));

                browser.leftClick(S.INT.OPERATION);
                // check for the default value
                browser.waitForVisible(S.INT.ATTR_VALUE, 20000);
                let value = browser.getText(S.INT.ATTR_VALUE);
                assert.equal(value, '10');
            });

            // add attribute with 'self' set
            it('should ignore "self" when first arg in ctor', function() {
                browser.url(newOperationUrl);

                updateOpCode(operation => operation.addAttribute('self'));

                // check that there is no attribute in the interface editor
                browser.leftClick(S.INT.OPERATION);
                browser.waitForVisible(S.INT.CREATE_ATTR, 20000);
                assert(!browser.isVisible(S.INT.ATTR_NAME));
            });

            it('should remove attrs from model', function() {
                browser.url(existingOperationUrl);
                updateOpCode(operation => operation.removeAttribute('iterations'));

                browser.waitForVisible(S.INT.OPERATION, 20000);
                browser.leftClick(S.INT.OPERATION);
                browser.waitForVisible(S.INT.CREATE_ATTR, 20000);

                browser.waitUntil(function() {
                    let attr = null;
                    try {
                        attr = browser.selectByVisibleText(S.INT.ATTR_NAME, 'iterations: ');
                    } catch (e) {
                        if (!e.message.includes('An element could not be located on the page')) {
                            throw e;
                        }
                    }
                    return !attr;
                }, 5000, 'iterations attribute still exists in the model');
                //assert(!attr, 'iterations attribute still exists in the model');
            });

            it.skip('should change attr defaults from model', function() {
            });

            it('should remove input from model', function() {
                browser.url(existingOperationUrl);
                updateOpCode(operation => operation.removeInput('data'));

                browser.waitUntil(function() {
                    return !browser.isVisible(S.INT.INPUT);
                }, 1500, 'Expected input node to be removed within 1.5s');
            });


            // remove outputs (need a new test op)
            it('should remove output from model', function() {
                browser.url(existingOperationUrl);
                updateOpCode(operation => operation.removeOutput('result'));

                browser.waitUntil(function() {
                    return !browser.isVisible(S.INT.OUTPUT);
                }, 1500, 'Expected output node to be removed within 1.5s');
            });

            it('should update model on rename', function() {
                const newName = 'TestRename';
                browser.url(existingOperationUrl);
                updateOpCode(operation => operation.setName(newName));
                browser.waitUntil(function() {
                    const title = browser.getText(S.PANEL_TITLE);
                    return title === newName;
                }, 15000, 'Expected output node to be removed within 1.5s');
            });

            // remove reference (need a new test op)
            // TODO

        });
    });
});
