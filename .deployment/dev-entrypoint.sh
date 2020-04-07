#!/bin/bash
# Remove pypi tensorflow from deepforge-server
source activate deepforge-server
pip uninstall tensorflow -y
conda install tensorflow==1.14 -y

# Install jq and remove local from config/components.json file
sudo apt-get install jq --yes
< config/components.json  jq '.Compute.backends=(.Compute.backends | map(select(. != "local")))' \
> config/components2.json && mv config/components2.json config/components.json

deepforge start --server
