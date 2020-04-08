#!/bin/bash
MINICONDA=Miniconda3-latest-Linux-x86_64.sh
if [[ "$TRAVIS_OS_NAME" == "osx" ]];   then MINICONDA=Miniconda3-latest-MacOSX-x86_64.sh; fi
if [[ "$TRAVIS_OS_NAME" == "linux" ]]; then MINICONDA=Miniconda3-latest-Linux-x86_64.sh;  fi

MINICONDA_MD5=$(curl -s https://repo.anaconda.com/miniconda/ | grep -A3 $MINICONDA | sed -n '4p' | sed -n 's/ *<td>\(.*\)<\/td> */\1/p')
curl -O https://repo.anaconda.com/miniconda/$MINICONDA
MD5SUM=$(md5sum $MINICONDA | cut -d ' ' -f 1)
if [[ $MINICONDA_MD5 !=  $MD5SUM ]]; then
    echo "Miniconda MD5 mismatch"
    echo $MINICONDA_MD5
    echo $MD5SUM
    exit 1
fi
bash $MINICONDA -b
rm -f $MINICONDA

export PATH=$HOME/miniconda3/bin:$PATH

conda update -yq conda
