FROM gw000/keras
MAINTAINER Brian Broll <brian.broll@gmail.com>

# Install the python dependencies
RUN pip install dill pillow matplotlib simplejson

# install nodejs v8
RUN apt-get update -yq \
    && apt-get install curl gnupg -yq \
    && curl -sL https://deb.nodesource.com/setup_8.x | bash \
    && apt-get install nodejs -yq

# install deepforge
RUN echo '{"allow_root": true}' > /root/.bowerrc && mkdir -p /root/.config/configstore/ && \
    echo '{}' > /root/.config/configstore/bower-github.json

RUN mkdir /deepforge
ADD . /deepforge
WORKDIR /deepforge

RUN npm install --production

RUN ln -s /deepforge/bin/deepforge /usr/local/bin

# configure the worker
RUN apt-get install -y unzip
RUN deepforge config blob.dir /data/blob && \
    deepforge config mongo.dir /data/db && \
    deepforge config worker.cache.useBlob false && \
    deepforge config worker.cache.dir /deepforge/worker-cache && \
    git config --global user.email "deepforge-worker@deepforge.org" && \
    git config --global user.name "deepforge-worker"

ENTRYPOINT ["deepforge", "start", "--worker"]
CMD ["http://172.17.0.1:8888"]
