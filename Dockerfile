# Start with Ubuntu base image
FROM node:6.2.2
MAINTAINER Brian Broll <brian.broll@gmail.com>

# Install basic required tools
RUN apt-get update && apt-get install -y git

RUN echo '{"allow_root": true}' > /root/.bowerrc && mkdir -p /root/.config/configstore/ && \
    echo '{}' > /root/.config/configstore/bower-github.json

RUN mkdir /deepforge
ADD . /deepforge
WORKDIR /deepforge

RUN cd $(npm root -g)/npm \
    && npm install fs-extra \
    && sed -i -e s/graceful-fs/fs-extra/ -e s/fs.rename/fs.move/ ./lib/utils/rename.js

RUN rm -rf node_modules/ && npm install

EXPOSE 8888

# Why does this next command fail?
CMD ['./bin/deepforge', 'start', '-s']

#RUN . $HOME/.deepforge/torch/install/bin/torch-activate && deepforge update -t

# mongodb
# TODO: Make sure we are mounting /data/db!

# add th to the path
# TODO

#WORKDIR /root/
