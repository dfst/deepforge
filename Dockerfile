# Dockerfile for running the server itself
FROM node:8.9.0
MAINTAINER Brian Broll <brian.broll@gmail.com>

RUN echo '{"allow_root": true}' > /root/.bowerrc && mkdir -p /root/.config/configstore/ && \
    echo '{}' > /root/.config/configstore/bower-github.json

RUN mkdir /deepforge
ADD . /deepforge
WORKDIR /deepforge

RUN npm install

RUN ln -s /deepforge/bin/deepforge /usr/local/bin

EXPOSE 8888

# Set up the data storage
RUN deepforge config blob.dir /data/blob && \
    deepforge config mongo.dir /data/db

CMD ["deepforge", "start", "--server"]
