Quick Start
===========
The recommended (and easiest) way to get started with DeepForge is using docker-compose. First, install `docker <https://docs.docker.com/engine/installation/>`_ and `docker-compose <https://docs.docker.com/compose/install/>`_.

Next, download the docker-compose file for DeepForge:

.. code-block:: bash

    wget https://raw.githubusercontent.com/deepforge-dev/deepforge/master/docker/docker-compose.yml

Then start DeepForge using docker-compose:

.. code-block:: bash

    docker-compose up

and now DeepForge can be used by opening a browser to `http://localhost:8888 <http://localhost:8888>`_!

For detailed instructions about deployment installations, check out our `deployment installation instructions <../getting_started/configuration.rst>`_ An example of customizing a deployment using docker-compose can be found `here <https://github.com/deepforge-dev/deepforge/tree/master/.deployment>`_.
