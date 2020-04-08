Quick Start
===========
There are two ways to give DeepForge a try: visit the public deployment at https://editor.deepforge.org, or `spin up your own deployment locally <../deployment/quick_start.html>`_.

Connecting to the Public Deployment
-----------------------------------
**As of this writing, registration is not yet open to the public and is only available upon request.**

After getting an account for https://editor.deepforge.org, the only thing required to get up and running with DeepForge is to determine the `compute and storage adapters <../fundamentals/integration.html>`_ to use. If you already have an account with one of the existing integrations, then you should be able to use those without any further setup!

If not, the easiest way to get started is to connect your own desktop to use for compute and to use the S3 adapter to storage data and trained model weights. Connect your own desktop for computation using the following command (using docker):

.. code-block:: bash

    docker run -it deepforge/worker:latest --host https://dev.deepforge.org -t <access token>

where `<access token>` is an access token for your user (created from the profile page of https://editor.deepforge.org).

After connecting a machine to use for computation, you can start creating and running pipelines w/o input or output operations! To save artifacts in DeepForge, you will need to connect a storage adapter such as the S3 adapter.

To easily create a custom storage location, `minio <https://min.io>`_ is recommended. Simply `spin up an instance of minio <https://docs.min.io/docs/minio-quickstart-guide.html>`_ on a machine publicly accessible from the internet. Providing the public IP address of the machine (along with any configured credentials) to DeepForge when executing a pipeline will enable you to save any generated artifacts, such as trained model weights, to the minio instance and register it within DeepForge.

