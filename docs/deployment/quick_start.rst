Quick Start
===========
The recommended (and easiest) way to get started with DeepForge is using docker-compose. First, install `docker <https://docs.docker.com/engine/installation/>`_ and `docker-compose <https://docs.docker.com/compose/install/>`_.

Next, download the docker-compose file for DeepForge:

.. code-block:: bash

    wget https://raw.githubusercontent.com/deepforge-dev/deepforge/master/docker/docker-compose.yml

Next, you must decide if you would like authentication to be enabled. For production deployments, this is certainly recommended. However, if you just want to spin up DeepForge to "kick the tires", this is certainly not necessary.

Without User Accounts
---------------------
Start the docker containers with ``docker-compose run`` :

.. code-block:: bash

    docker-compose --file docker-compose.yml run -p 8888:8888 -p 8889:8889 -e "NODE_ENV=default" server

User Authentication Enabled
---------------------------
First, generate a public and private key pair

.. code-block:: bash

    mkdir -p deepforge_keys
    openssl genrsa -out deepforge_keys/private_key
    openssl rsa -in deepforge_keys/private_key -pubout > deepforge_keys/public_key
    export TOKEN_KEYS_DIR="$(pwd)/deepforge_keys"

Then start DeepForge using ``docker-compose run``:

.. code-block:: bash

    docker-compose --file docker-compose.yml run -v "${TOKEN_KEYS_DIR}:/token_keys" -p  8888:8888 -p 8889:8889 server

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
