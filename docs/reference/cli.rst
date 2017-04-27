Command Line Interface
======================

This document outlines the functionality of the deepforge command line interface (provided after installing deepforge with :code:`npm install -g deepforge`).

- Installation Configuration
- Starting DeepForge or Components
- Installing and Upgrading Torch
- Update or Uninstall DeepForge
- Managing Extensions

Installation Configuration
--------------------------
Installation configuration including the installation location of Torch7 and data storage locations. These can be edited using the :code:`deepforge config` command as shown in the following examples:

Printing all the configuration settings:

.. code-block:: bash

    deepforge config


Printing the value of a configuration setting:

.. code-block:: bash

    deepforge config torch.dir


Setting a configuration option, such as :code:`torch.dir` can be done with:

.. code-block:: bash

    deepforge config torch.dir /some/new/directory


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

Installing and Upgrading Torch7
-------------------------------
Torch7 is lazily installed when starting a worker (if torch isn't already installed) with the rnn package. This installation can be manually updated as described in the update and installation section.

Update/Uninstall DeepForge
--------------------------
DeepForge can be updated or uninstalled using

.. code-block:: bash

    deepforge update


The torch installation can be updated using

.. code-block:: bash

    deepforge update --torch


DeepForge can be uninstalled using :code:`deepforge uninstall`

Managing Extensions
-------------------
DeepForge extensions can be installed and removed using the :code:`deepforge extensions` subcommand. Extensions can be added, removed and listed as shown below

.. code-block:: bash

    deepforge extensions add https://github.com/example/some-extension
    deepforge extensions remove some-extension
    deepforge extensions list

