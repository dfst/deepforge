# This docker file is to create a docker Image of a deepforge server
FROM node:12

EXPOSE 8888

LABEL maintainer1.name="Brian Broll"\
      maintainer1.email="brian.broll@gmail.com"

LABEL maintainer2.name="Umesh Timalsina"\
      maintainer2.email="umesh.timalsina@vanderbilt.edu"

SHELL ["/bin/bash", "-c"]

ENV MINICONDA Miniconda3-latest-Linux-x86_64.sh

ADD . /deepforge

WORKDIR /tmp

RUN curl -O  https://repo.anaconda.com/miniconda/$MINICONDA && bash $MINICONDA -b && rm -f $MINICONDA

ENV PATH /root/miniconda3/bin:$PATH
ENV NODE_ENV production

WORKDIR /deepforge

RUN conda update conda -yq

RUN echo '{"allow_root": true}' > /root/.bowerrc && mkdir -p /root/.config/configstore/ && \
    echo '{}' > /root/.config/configstore/bower-github.json

RUN npm install -g npm

RUN npm config set unsafe-perm true && npm install && ln -s /deepforge/bin/deepforge /usr/local/bin

#Set up the data storage
RUN deepforge config blob.dir /data/blob && \
    deepforge config mongo.dir /data/db

ENTRYPOINT deepforge start --server
