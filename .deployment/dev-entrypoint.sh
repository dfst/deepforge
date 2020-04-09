#!/bin/bash
# Remove pypi tensorflow from deepforge-server
source activate deepforge-server
pip uninstall tensorflow -y
conda install tensorflow==1.14 -y

# Install jq and remove local from config/components.json file
wget https://github.com/stedolan/jq/releases/download/jq-1.6/jq-linux64 -O jq && chmod +x jq

< config/components.json  ./jq '.Compute.backends=(.Compute.backends | map(select(. != "local")))' \
> config/components2.json
< config/components2.json  ./jq '.Storage.backends=(.Storage.backends | map(select(. != "gme")))' \
> config/components.json

deepforge start --server

