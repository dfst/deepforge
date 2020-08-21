RESULTS_DIR=$(pwd)
JOB_DIR=$1

source activate deepforge;
export NODE_PATH=/home/idies/miniconda3/envs/deepforge/lib/node_modules:$NODE_PATH
cd $JOB_DIR;
CMD=$(conda run -n deepforge node -e 'console.log(require("./executor_config.json").cmd)')
ARGS=$(conda run -n deepforge node -e 'console.log(require("./executor_config.json").args.join(" "))')
conda run -n deepforge $CMD $ARGS
cp $JOB_DIR/results.json $RESULTS_DIR/results.json
