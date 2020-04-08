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

    deepforge config blob.dir


Setting a configuration option, such as :code:`blob.dir` can be done with:

.. code-block:: bash

    deepforge config blob.dir /some/new/directory


For more information about the configuration settings, check out the `configuration <configuration.rst>`_ page.


Starting DeepForge Components
-----------------------------
The DeepForge server can be started with the :code:`deepforge start` command. By default, this command will start both the server and a mongo database (if applicable).

The server can be started by itself using

.. code-block:: bash

    deepforge start --server

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

