# Dockerfile for running the server itself
FROM node:6.2.2
MAINTAINER Brian Broll <brian.broll@gmail.com>

RUN echo '{"allow_root": true}' > /root/.bowerrc && mkdir -p /root/.config/configstore/ && \
    echo '{}' > /root/.config/configstore/bower-github.json

RUN mkdir /deepforge
ADD . /deepforge
WORKDIR /deepforge

RUN cd $(npm root -g)/npm \
    && npm install fs-extra \
    && sed -i -e s/graceful-fs/fs-extra/ -e s/fs.rename/fs.move/ ./lib/utils/rename.js

RUN rm -rf node_modules/ && npm install && ln -s /deepforge/bin/deepforge /usr/local/bin

EXPOSE 8888

# Set up torch
RUN apt-get update && apt-get install sudo && echo 'yes' | deepforge start -w && \
    . /root/.deepforge/torch/install/bin/torch-activate && \
    deepforge update -t

# Set up the data storage
RUN deepforge config blob.dir /data/blob && \
    deepforge config mongo.dir /data/db

ENTRYPOINT /bin/bash
CMD ["deepforge", "start", "--server"]
