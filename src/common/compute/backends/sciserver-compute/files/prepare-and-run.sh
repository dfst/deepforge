RESULTS_DIR=$(pwd)
JOB_DIR=$1

curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.35.3/install.sh | bash
export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm install 12

cd $JOB_DIR;
npm install requirejs@2.3.5 rimraf@^2.4.0 superagent@3.8.3 @babel/runtime@^7.7.2 q@1.5.1 node-fetch@2.6.0 agentkeepalive@3.4.1 aws-sdk@2.624.0 > /dev/null
pip install simplejson > /dev/null

node start.js
cp $JOB_DIR/results.json $RESULTS_DIR/results.json
