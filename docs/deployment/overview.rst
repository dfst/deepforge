Overview
========

DeepForge Component Overview
----------------------------
DeepForge is composed of four main elements:

- *Server*: Main component hosting all the project information and is connected to by the clients
- *Database*: MongoDB database containing DeepForge, job queue for the workers, etc
- *Worker*: Slave machine performing the actual machine learning computation
- *Client*: The connected browsers working on DeepForge projects.

Of course, only the *Server*, *Database* (MongoDB) and *Worker* need to be installed. If you are not going to execute any machine learning pipelines, installing the *Worker* can be skipped.

Component Dependencies
----------------------
The following dependencies are required for each component:

- *Server* (NodeJS v6.2.1)
- *Database* (MongoDB v3.0.7)
- *Worker*: NodeJS v6.2.1 (used for job management logic) and `Torch <http://torch.ch/docs/getting-started.html#>`_ (this will be installed automatically by the cli when needed)
- *Client*: We recommend using Google Chrome and are not supporting other browsers (for now). In other words, other browsers can be used at your own risk.

Configuration
-------------
After installing DeepForge, it can be helpful to check out `configuring DeepForge <getting_started/configuration.rst>`_
