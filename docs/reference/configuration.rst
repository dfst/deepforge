Configuration
=============

Configuration of deepforge is done through the `deepforge config` command from the command line interface. To see all config options, simply run `deepforge config` with no additional arguments. This will print a JSON representation of the configuration settings similar to:

.. code-block:: bash

    Current config:
    {
      "blob": {
        "dir": "/home/irishninja/.deepforge/blob"
      },
      "worker": {
        "cache": {
          "useBlob": true,
          "dir": "~/.deepforge/worker/cache"
        },
        "dir": "~/.deepforge/worker"
      },
      "mongo": {
        "dir": "~/.deepforge/data"
      }
    }

Setting an attribute, say `worker.cache.dir`, is done as follows

.. code-block:: bash

    deepforge config worker.cache.dir /tmp

Environment Variables
---------------------
Most settings have a corresponding environment variable which can be used to override the value set in the cli's configuration. This allows the values to be temporarily set for a single run. For example, starting a worker with a different cache than set in `worker.cache.dir` can be done with:

.. code-block:: bash

    DEEPFORGE_WORKER_CACHE=/tmp deepforge start -w

The complete list of the environment variable overrides for the configuration options can be found `here <https://github.com/deepforge-dev/deepforge/blob/master/bin/envConfig.json>`_.

Settings
--------

blob.dir
~~~~~~~~
The path to the blob (large file storage containing models, datasets, etc) to be used by the deepforge server.

This can be overridden with the `DEEPFORGE_BLOB_DIR` environment variable.

worker.dir
~~~~~~~~~~
The path to the directory used for worker executions. The workers will run the executions from this directory.

This can be overridden with the `DEEPFORGE_WORKER_DIR` environment variable.

mongo.dir
~~~~~~~~~
The path to use for the `--dbpath` option of mongo if starting mongo using the command line interface. That is, if the MONGO_URI is set to a local uri and the cli is starting the deepforge server, the cli will check to verify that an instance of mongo is running locally. If not, it will start it on the given port and use this setting for the `--dbpath` setting of mongod.

worker.cache.dir
~~~~~~~~~~~~~~~~
The path to the worker cache directory.

This can be overridden with the `DEEPFORGE_WORKER_CACHE` environment variable.

worker.cache.useBlob
~~~~~~~~~~~~~~~~~~~~
When running the worker on the same machine as the server, this allows the worker to use the blob as a cache and simply create symbolic links to the data (eg, training data, models) to prevent having to even perform a copy of the data on the given machine.

This can be overridden with the `DEEPFORGE_WORKER_USE_BLOB` environment variable.
