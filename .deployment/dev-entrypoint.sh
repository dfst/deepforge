#!/bin/bash
# Remove pypi tensorflow in favor of conda installation
source activate deepforge
pip uninstall tensorflow -y
conda install tensorflow==1.14 -y
conda env export -n deepforge > src/plugins/GenerateJob/templates/environment.worker.yml

source activate deepforge-server
pip uninstall tensorflow -y
conda install tensorflow==1.14 -y

# Install jq and remove local from config/components.json file
wget https://github.com/stedolan/jq/releases/download/jq-1.6/jq-linux64 -O jq && chmod +x jq

< config/components.json  ./jq '.Compute.backends=(.Compute.backends | map(select(. != "local")))' \
> config/components2.json
< config/components2.json  ./jq '.Storage.backends=(.Storage.backends | map(select(. != "gme")))' \
> config/components.json
rm config/components2.json

deepforge start --server

