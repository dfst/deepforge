Native Installation
===================

Dependencies
------------
First, install `NodeJS <https://nodejs.org/en/>`_ (LTS) and `MongoDB <https://www.mongodb.org/>`_. You may also need to install git if you haven't already.

Next, you can install DeepForge using npm:

.. code-block:: bash

    npm install -g deepforge

Now, you can check that it installed correctly:

.. code-block:: bash

    deepforge --version

After installing DeepForge, it is recommended to install the `deepforge-keras <https://github.com/deepforge-dev/deepforge-keras>`_ extension which provides capabilities for modeling neural network architectures:

.. code-block:: bash

    deepforge extensions add deepforge-dev/deepforge-keras

DeepForge can now be started with:

.. code-block:: bash

    deepforge start

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
The DeepForge worker (used with WebGME compute) can be used to enable users to connect their own machines to use for any required computation. This can be installed from `https://github.com/deepforge-dev/worker`. It is recommended to install `Conda <https://conda.io/en/latest/>`_ on the worker machine so any dependencies can be automatically installed.

Updating
~~~~~~~~
DeepForge can be updated with the command line interface rather simply:

.. code-block:: bash

    deepforge update

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

Updating
~~~~~~~~
Updating can be done the same as any other git project; that is, by running `git pull` from the project root. Sometimes, the dependencies need to be updated so it is recommended to run `npm install` following `git pull`.

Manual Installation (Production)
---------------------------------------
To deploy a deepforge server in a production environment, follow the following steps.
These steps are for using a Linux server and if you are using a platform other than Linux,
we recommend using a dockerized deployment.

1. Make sure you have a working installation of `Conda <https://conda.io/en/latest/>`_  in your server.

2. Clone this repository to your production server.

.. code-block:: bash

    git clone https://github.com/deepforge-dev/deepforge.git

3. Install dependencies and add extensions:

.. code-block:: bash

    cd deepforge && npm install
    ./bin/deepforge extensions add deepforge-dev/deepforge-keras

2. Generate token keys for user-management (required for user management).

.. code-block:: bash

    chmod +x utils/generate_token_keys.sh
    ./utils/generate_token_keys.sh


.. warning::

    The token keys are generated in the root of the project by default.
    If the token keys are stored in the project root, they are accessible via `/extlib`,
    which is a security risk. So, please make sure you move the created token keys out of the project root.

3. Configure your environment variables:

.. code-block:: bash

    export MONGO_URI=mongodb://mongo:port/deepforge_database_name
    export DEEPFORGE_HOST=https://url.of.server
    export DEEPFORGE_PUBLIC_KEY=/path/to/public_key
    export DEEPFORGE_PRIVATE_KEY=/path/to/private_key

4. Add a site-admin account by using ``deepforge-users`` command:

.. code-block:: bash

    ./bin/deepforge-users useradd -c -s admin_username admin_email admin_password

5. Now you should be ready to deploy a production server which can be done using ``deepforge`` command.

.. code-block:: bash

    NODE_ENV=production ./bin/deepforge start --server


.. note::

    The default port for a deepforge server is 8888. It can be changed using the option `-p` in the command above.
