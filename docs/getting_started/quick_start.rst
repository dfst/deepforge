Quick Start
===========
Before we can start with the examples, we will first install DeepForge locally.

Dependencies
------------
First, install `NodeJS <https://nodejs.org/en/>`_ (v6) and `MongoDB <https://www.mongodb.org/>`_. You may also need to install git if you haven't already.

Next, you can install DeepForge using npm:

.. code-block:: bash

    npm install -g deepforge

Now, you can check that it installed correctly:

.. code-block:: bash

    deepforge --version

DeepForge can now be started with:

.. code-block:: bash

    deepforge start

However, the first time DeepForge is started, it will make sure that the deep learning framework is installed (if it isn't found on the host system). This may require you to start DeepForge a couple times; the first time it starts it will install Torch7 and require a terminal restart to update a couple environment variables (like `PATH`). The second time it starts it will install additional torch packages but will not require a terminal restart. Finally, DeepForge will start with all the required dependencies.

For detailed instructions about deployment installations, check out our `deployment installation instructions <getting_started/configuration.rst>`_
