Command Line Interface
======================

This document outlines the functionality of the deepforge command line interface (provided after installing deepforge with :code:`npm install -g deepforge`).

- Installation Configuration
- Starting DeepForge or Components
- Update or Uninstall DeepForge
- Managing Extensions

Installation Configuration
--------------------------
Installation configuration can be edited using the :code:`deepforge config` command as shown in the following examples:

Printing all the configuration settings:

.. code-block:: bash

    deepforge config


Printing the value of a configuration setting:

.. code-block:: bash

    deepforge config worker.dir


Setting a configuration option, such as :code:`worker.dir` can be done with:

.. code-block:: bash

    deepforge config worker.dir /some/new/directory


For more information about the configuration settings, check out the `configuration <configuration.rst>`_ page.


Starting DeepForge Components
-----------------------------
DeepForge components, such as the server or the workers, can be started with the :code:`deepforge start` command. By default, this command will start all the necessary components to run including the server, a mongo database (if applicable) and a worker.

The server can be started by itself using

.. code-block:: bash

    deepforge start --server


The worker can be started by itself using

.. code-block:: bash

    deepforge start --worker http://154.95.87.1:7543


where `http://154.95.87.1:7543` is the url of the deepforge server.

Update/Uninstall DeepForge
--------------------------
DeepForge can be updated or uninstalled using

.. code-block:: bash

    deepforge update


DeepForge can be uninstalled using :code:`deepforge uninstall`

Managing Extensions
-------------------
DeepForge extensions can be installed and removed using the :code:`deepforge extensions` subcommand. Extensions can be added, removed and listed as shown below

.. code-block:: bash

    deepforge extensions add https://github.com/example/some-extension
    deepforge extensions remove some-extension
    deepforge extensions list

