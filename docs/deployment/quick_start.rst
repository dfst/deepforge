Quick Start
===========
The recommended (and easiest) way to get started with DeepForge is using docker-compose. First, install `docker <https://docs.docker.com/engine/installation/>`_ and `docker-compose <https://docs.docker.com/compose/install/>`_.

Next, download the docker-compose file for DeepForge:

.. code-block:: bash

    wget https://raw.githubusercontent.com/deepforge-dev/deepforge/master/docker/docker-compose.yml

Next, you must decide if you would like authentication to be enabled. For production deployments, this is certainly recommended. However, if you just want to spin up DeepForge to "kick the tires", this is certainly not necessary.

Without User Accounts
---------------------
Start the docker containers with

.. code-block:: bash

    docker-compose up

User Authentication Enabled
---------------------------
First, generate a public and private key pair

.. code-block:: bash

    mkdir -p deepforge_keys
    openssl genrsa -out deepforge_keys/private_key
    openssl rsa -in deepforge_keys/private_key -pubout > deepforge_keys/public_key
    export TOKEN_KEYS_DIR="$(pwd)/deepforge_keys"

Then create file called ``production-docker-compose.yml`` (for using the keys generated above) with the following
content:

.. code-block:: yaml

    version: "3"
    services:
      mongo:
        image: mongo
        volumes:
          - "$HOME/.deepforge/data:/data/db"
      server:
        environment:
          - "MONGO_URI=mongodb://mongo:27017/deepforge"
          - "DEEPFORGE_PUBLIC_KEY=/token_keys/public_key"
          - "DEEPFORGE_PRIVATE_KEY=/token_keys/private_key"
        image: deepforge/kitchen-sink:latest
        ports:
          - "8888:8888"
          - "8889:8889"
        volumes:
          - "$HOME/.deepforge/blob:/data/blob"
          - "${TOKEN_KEYS_DIR}:/token_keys"
        depends_on:
          - mongo

Then start DeepForge using docker-compose:

.. code-block:: bash

    docker-compose --file production-docker-compose.yml up

Finally, create the admin user by connecting to the server's docker container. First, get the ID of the container using:

.. code-block:: bash

    docker ps

Then, connect to the running container:

.. code-block:: bash

    docker exec -it <container ID> /bin/bash

and create the admin account

.. code-block:: bash

    ./bin/deepforge users useradd admin <admin email> <password> -c -s

After setting up DeepForge (with or without user accounts), it can be used by opening a browser to `http://localhost:8888 <http://localhost:8888>`_!

For detailed instructions about deployment installations, check out our `deployment installation instructions <../getting_started/configuration.rst>`_ An example of customizing a deployment using docker-compose can be found `here <https://github.com/deepforge-dev/deepforge/tree/master/.deployment>`_.
