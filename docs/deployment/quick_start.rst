Quick Start
===========
The recommended (and easiest) way to get started with DeepForge is using docker-compose. First, install `docker <https://docs.docker.com/engine/installation/>`_ and `docker-compose <https://docs.docker.com/compose/install/>`_.

Next, download the docker-compose file for DeepForge:

.. code-block:: bash

    wget https://raw.githubusercontent.com/deepforge-dev/deepforge/master/docker/docker-compose.yml

Next, you must decide if you would like authentication to be enabled. For production deployments, this is certainly recommended. However, if you just want to spin up DeepForge to "kick the tires", this is certainly not necessary.

Without User Accounts
---------------------
Open the docker-compose file and add the following environment variable to the server:

.. code-block:: bash

    NODE_ENV=default

and delete the volume for the server's keys (used for signing JWTs):

.. code-block:: bash

    - "${TOKEN_KEYS_DIR}:/token_keys"

Next, start the docker containers with

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

Then start DeepForge using docker-compose:

.. code-block:: bash

    docker-compose up

Finally, create the admin user by connecting to the server's docker container. First, get the ID of the container using:

.. code-block:: bash

    docker ps

Then, connect to the running container:

.. code-block:: bash

    docker -it exec <container ID> /bin/bash

and create the admin account

.. code-block:: bash

    ./bin/deepforge users useradd admin <admin email> <password> -c -s

After setting up DeepForge (with or without user accounts), it can be used by opening a browser to `http://localhost:8888 <http://localhost:8888>`_!

For detailed instructions about deployment installations, check out our `deployment installation instructions <../getting_started/configuration.rst>`_ An example of customizing a deployment using docker-compose can be found `here <https://github.com/deepforge-dev/deepforge/tree/master/.deployment>`_.
