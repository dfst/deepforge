#!/bin/bash
# Remove pypi tensorflow from deepforge
source activate deepforge
pip uninstall tensorflow -y

# Install tensorlfow from conda
conda install tensorflow==1.14 -y

# Remove pypi tensorflow from deepforge-server
source activate deepforge-server
pip uninstall tensorflow -y
conda install tensorflow==1.14 -y

source activate ${DEEPFORGE_CONDA_ENV} && deepforge start --server
