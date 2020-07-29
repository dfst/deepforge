RESULTS_DIR=$(pwd)
JOB_DIR=$1

source activate deepforge;
cd $JOB_DIR;
CMD=$(conda run -n deepforge node -e 'console.log(require("./executor_config.json").cmd)')
ARGS=$(conda run -n deepforge node -e 'console.log(require("./executor_config.json").args.join(" "))')
conda run -n deepforge $CMD $ARGS
cp $JOB_DIR/results.json $RESULTS_DIR/results.json
