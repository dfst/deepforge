var mockery = require('mockery'),
    assert = require('assert'),
    path = require('path'),
    nop = () => {},
    cli;

var callRegister = {
    childProcess: {
        execSync: []
    }
};

var mocks = {
    childProcess: {},
    rimraf: {},
    forever: {}
};

var childProcess = {
    execSync: function(cmd) {
        callRegister.childProcess.execSync.push(cmd);
        if (mocks.childProcess.execSync) {
            return mocks.childProcess.execSync.apply(this, arguments);
        }
    },
    spawn: function() {
        if (mocks.childProcess.spawn) {
            mocks.childProcess.spawn.apply(this, arguments);
        }
        return {
            on: () => {},
            stdout: {
                on: () => {}
            },
            stderr: {
                on: () => {}
            }
        };
    }
};
var forever = {};
forever.Monitor = function() {
    var res = {};
    res.on = nop;
    res.start = nop;
    if (mocks.forever.Monitor) {
        mocks.forever.Monitor.apply(this, arguments);
    }
    return res;
};
var rimraf = {};
rimraf.sync = function() {
    if (mocks.rimraf.sync) {
        mocks.rimraf.sync.apply(this, arguments);
    }
};

describe('cli', function() {
    before(function() {
        // create the mocks
        mockery.enable({
            warnOnReplace: false,
            warnOnUnregistered: false
        });
        mockery.registerMock('child_process', childProcess);
        mockery.registerMock('forever-monitor', forever);
        mockery.registerMock('rimraf', rimraf);
        cli = require('../../bin/deepforge');
    });

    it('should display help message if no args', function() {
        // TODO
    });

    describe('start', function() {
        afterEach(function() {
            callRegister.childProcess.execSync = [];
            mocks.childProcess.execSync = nop;
            mocks.childProcess.spawn = nop;
            mocks.forever.Monitor = nop;
            mocks.rimraf.sync = nop;
        });

        it('should check for running mongo', function() {
            var calls;
            callRegister.childProcess.execSync = [];
            cli('start');
            calls = callRegister.childProcess.execSync;
            assert.notEqual(calls.indexOf('pgrep mongod'), -1);
        });

        it('should start mongo if no running mongo', function() {
            mocks.childProcess.execSync = (cmd) => {
                if (cmd === 'pgrep mongod') {
                    throw 'No pIds';
                }
            };

            // Check that mongo is started
            mocks.childProcess.spawn = cmd => {
                assert.equal(cmd, 'mongod');
            };
            cli('start');
        });

        it('should start mongo w/ dbpath', function() {
            // Check that mongo is started
            mocks.childProcess.spawn = (cmd, args) => {
                assert.equal(cmd, 'mongod');
                assert.equal(args[0], '--dbpath');
                assert.equal(args.length, 2);
            };
            cli('start --mongo');
        });

        it('should start local deepforge by default', function() {
            mocks.forever.Monitor = main =>
                assert.notEqual(main.indexOf('start-local.js'), -1);
            cli('start');
        });

        it('should start normal deepforge if --server set', function() {
            mocks.forever.Monitor = main =>
                assert.notEqual(main.indexOf('app.js'), -1);
            cli('start --server');
        });

        it('should start worker if --worker set', function(done) {
            mocks.forever.Monitor = main => {
                if (main.indexOf('start-worker.js') !== -1) {
                    done();
                }
            };
            cli('start --worker');
        });
    });

    describe('uninstall', function() {
        it('should only remove \'torch\' if --torch option set', function() {
            mocks.rimraf.sync = path => assert.notEqual(path.indexOf('torch'), -1);
            cli('uninstall --torch');
        });

        it('should uninstall deepforge w/ npm', function() {
            mocks.childProcess.spawn = (cmd, args) => {
                assert.equal(cmd, 'npm');
                assert.equal(args[0], 'uninstall');
                assert.notEqual(args.indexOf('deepforge'), -1);
            };
            cli('uninstall');
        });

        it('should remove ~/.deepforge if --clean option set', function(done) {
            mocks.rimraf.sync = dir => {
                if (dir === path.join(process.env.HOME, '.deepforge')) {
                    done();
                }
            };
            cli('uninstall --clean');
        });
    });

    describe('update', function() {
        it('should update deepforge w/ npm', function() {
            mocks.childProcess.spawn = (cmd, args) => {
                assert.equal(cmd, 'npm');
                assert.equal(args[0], 'install');
                assert.notEqual(args.indexOf('deepforge'), -1);
                assert.notEqual(args.indexOf('-g'), -1);
            };
            cli('update');
        });

        it('should update deepforge from git if --git set w/ npm', function() {
            mocks.childProcess.spawn = (cmd, args) => {
                assert.notEqual(args.indexOf('dfst/deepforge'), -1);
            };
            cli('update --git');
        });

        it('should update torch if --torch', function() {
            mocks.childProcess.spawn = (cmd, args) => {
                assert.equal(cmd, 'bash');
                assert.equal(args[0], './update.sh');
            };
            cli('update --torch');
        });
    });

    after(function() {
        mockery.disable();
    });
});
