Storage and Compute Adapters
============================
With any deeplearning endeavor, there are two biggest challenges that new comers to the field face:

1. As any deeplearning algorithm requires a lot of data, storing the data in local workstation is not feasible.
2. The computational power required to run a deeplearning algorithm could go well beyond the local workstation for a user.

With this is mind, DeepForge introduces the concept of `Storage` and `Compute` adapters. The abstract goal of these adapters
is to provide a uniform interface to distributed locations between data and computational resources and couple any `Storage`
resource with a `Computational` resource while running a DeepForge pipeline.

Storage Adapters
----------------
The storage adapters provide a uniform access to a storage resource, like a S3 Server or any other File service to
store/access artifacts to and from a storage server. Currently, we support three avenues
for storage:

1. WebGME Blob Server : Blob Storage of a `WebGME <https://webgme.org/>`_ server
2. SciServer Files Service : Files Service from `SciServer <https://sciserver.org>`_
3. S3 Storage: An `S3` Server like `minio <https://play.min.io>`_, `AWS S3 <https://aws.amazon.com/s3/>`_

With these options, an `artifact` like a deeplearning dataset or results of a training operation can be stored in avenues
listed above.


Compute Adapters
----------------
DeepForge `compute adapters` provide flexibility to integrate various computing platforms available to the user.
With compute adapters, users can run a pipeline in various compute platforms/ machines available to users.
For example, a user could design a pipeline in DeepForge, execute it in a `local` compute for testing and once satisfied, execute the same pipeline in a more powerful
compute infrastructure available to the user.

Currently, we support three forms of compute support:

1. WebGME Worker: A user machine to run jobs via the `WebGME Executor Framework <https://github.com/webgme/webgme/wiki/GME-Executor-Framework>`_
2. SciServer-Compute: Compute service offered by `SciServer <https://sciserver.org>`_
3. Local Compute: Local machine in which server is deployed

