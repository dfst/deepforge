#!/bin/bash
# Remove pypi tensorflow in favor of conda installation
source activate deepforge
pip uninstall tensorflow -y
conda install tensorflow==1.14 -y
conda env export -n deepforge > src/plugins/GenerateJob/templates/environment.worker.yml

source activate deepforge-server
pip uninstall tensorflow -y
conda install tensorflow==1.14 -y


deepforge start --server

