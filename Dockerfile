# This docker file is to create a public deployment of a deepforge server
FROM node:10

EXPOSE 8888

LABEL maintainer1.name="Brain Broll"\
      maintainer1.email="brian.broll@gmail.com"

LABEL maintainer2.name="Umesh Timalsina"\
      maintainer2.email="umesh.timalsina@vanderbilt.edu"

SHELL ["/bin/bash", "-c"]

ENV MINICONDA Miniconda3-latest-Linux-x86_64.sh

ADD . /deepforge

WORKDIR /tmp

RUN curl -O  https://repo.continuum.io/miniconda/$MINICONDA && bash $MINICONDA -b && rm -f $MINICONDA

ENV PATH /root/miniconda3/bin:$PATH

WORKDIR /deepforge

RUN conda update conda -yq && conda env create -f deepforge-environment.yml && echo "source activate deepforge" > ~/.bashrc


RUN echo '{"allow_root": true}' > /root/.bowerrc && mkdir -p /root/.config/configstore/ && \
    echo '{}' > /root/.config/configstore/bower-github.json

RUN npm install -g npm

RUN  npm config set unsafe-perm true && npm install && ln -s /deepforge/bin/deepforge /usr/local/bin

#Set up the data storage
RUN deepforge config blob.dir /data/blob && \
    deepforge config mongo.dir /data/db

ENTRYPOINT source activate deepforge && NODE_ENV=production deepforge start --server
