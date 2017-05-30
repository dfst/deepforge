Dockerized Installation
-----------------------
Each of the components are also available as docker containers. This page outlines the running of each of the main components as docker containers and connecting them as necessary.

Database
~~~~~~~~
First, you can start the mongo container using:

.. code-block:: bash

    docker run -d -v /abs/path/to/data:/data/db mongo

where :code:`/abs/path/to/data` is the path to the mongo data location on the host. If running the database in a container, you will need to get the ip address of the given container:

.. code-block:: bash

    docker inspect <container id>  | grep IPAddr

The :code:`<container id>` is the value returned from the original :code:`docker run` command.

When running mongo in a docker container, it is important to mount an external volume (using the :code:`-v` flag) to be used for the actual data (otherwise the data will be lost when the container is stopped).

Server
~~~~~~
The DeepForge server can be started with

.. code-block:: bash

    docker run -d -v $HOME/.deepforge/blob:/data/blob \
    -p 8888:8888 -e MONGO_URI=mongodb://172.17.0.2:27017/deepforge \
    deepforge/server

where :code:`172.17.0.2` is the ip address of the mongo container and :code:`$HOME/.deepforge/blob` is the path to use for binary DeepForge data on the host. Of course, if the mongo instance is locating at a different location, :code:`MONGO_URI` can be set to this address as well. Also, the first port (:code:`8888`) can be replaced with the desired port to expose on the host.

Worker
~~~~~~
As workers may require GPU access, they will need to use the nvidia-docker plugin. Workers can be created using

.. code-block:: bash

    nvidia-docker run -d deepforge/worker http://172.17.0.1:8888

where :code:`http://172.17.0.1:8888` is the location of the DeepForge server to which to connect.

**Note**: The :code:`deepforge/worker` image is packaged with cuda 7.5. Depending upon your hardware and nvidia version, you may need to build your own docker image or run the worker natively.
