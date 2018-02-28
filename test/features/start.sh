export NODE_ENV=test
node app.js > server-test.log &  # suppress this stdout
./node_modules/.bin/chimp --mocha --path test/features
RESULT=$?
kill -SIGINT %1

exit $RESULT
