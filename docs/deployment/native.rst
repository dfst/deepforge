Native Installation
===================

Database
~~~~~~~~
Download and install MongoDB from the `website <https://www.mongodb.org/>`_. If you are planning on running MongoDB locally on the same machine as DeepForge, simply start `mongod` and continue to setting up DeepForge.

If you are planning on running MongoDB remotely, set the environment variable "MONGO_URI" to the URI of the Mongo instance that DeepForge will be using:

.. code-block:: bash

    MONGO_URI="mongodb://pathToMyMongo.com:27017/myCollection" deepforge start

Server
~~~~~~
The DeepForge server is included with the deepforge cli and can be started simply with 

.. code-block:: bash

    deepforge start --server

By default, DeepForge will start on `http://localhost:8888`. However, the port can be specified with the `--port` option. For example:

.. code-block:: bash

    deepforge start --server --port 3000

Worker
~~~~~~
The DeepForge worker can be started with

.. code-block:: bash

    deepforge start --worker

The worker will install dependencies the first time it is run (including torch, if it is not already installed). 

To connect to a remote deepforge instance, add the url of the DeepForge server:

.. code-block:: bash

    deepforge start --worker http://myaddress.com:1234

Updating
~~~~~~~~
DeepForge can be updated with the command line interface rather simply:

.. code-block:: bash

    deepforge update

By default, this will update both DeepForge and the local torch installation. To only update DeepForge, add the `--server` flag:

.. code-block:: bash

    deepforge update --server

For more update options, check out `deepforge update --help`!

Manual Installation (Development)
---------------------------------
Installing DeepForge for development is essentially cloning the repository and then using `npm` (node package manager) to run the various start, test, etc, commands (including starting the individual components). The deepforge cli can still be used but must be referenced from `./bin/deepforge`. That is, `deepforge start` becomes `./bin/deepforge start` (from the project root).

DeepForge Server
~~~~~~~~~~~~~~~~
First, clone the repository:

.. code-block:: bash

    git clone https://github.com/dfst/deepforge.git

Then install the project dependencies:

.. code-block:: bash

    npm install

To run all components locally start with 

.. code-block:: bash

    ./bin/deepforge start

and navigate to `http://localhost:8888` to start using DeepForge!

Alternatively, if jobs are going to be executed on an external worker, run `./bin/deepforge start -s` locally and navigate to `http://localhost:8888`.

DeepForge Worker
~~~~~~~~~~~~~~~~
If you are using `./bin/deepforge start -s` you will need to set up a DeepForge worker (`./bin/deepforge start` starts a local worker for you!). DeepForge workers are slave machines connected to DeepForge which execute the provided jobs. This allows the jobs to access the GPU, etc, and provides a number of benefits over trying to perform deep learning tasks in the browser.

Once DeepForge is installed on the worker, start it with

.. code-block:: bash

    ./bin/deepforge start -w

Note: If you are running the worker on a different machine, put the address of the DeepForge server as an argument to the command. For example:

.. code-block:: bash

    ./bin/deepforge start -w http://myaddress.com:1234

Updating
~~~~~~~~
Updating can be done the same as any other git project; that is, by running `git pull` from the project root. Sometimes, the dependencies need to be updated so it is recommended to run `npm install` following `git pull`.
