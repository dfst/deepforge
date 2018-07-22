Overview
========

DeepForge Component Overview
----------------------------
DeepForge is composed of four main elements:

- *Server*: Main component hosting all the project information and is connected to by the clients.
- *Database*: MongoDB database containing DeepForge, job queue for the workers, etc.
- *Worker*: Slave machine performing the actual machine learning computation.
- *Client*: The connected browsers working on DeepForge projects.

Of course, only the *Server*, *Database* (MongoDB) and *Worker* need to be installed. If you are not going to execute any machine learning pipelines, installing the *Worker* can be skipped.

Component Dependencies
----------------------
The following dependencies are required for each component:

- *Server* (NodeJS v8.11.3)
- *Database* (MongoDB v3.0.7)
- *Worker*: NodeJS v8.11.3 (used for job management logic) and Python 3. If you are using the deepforge-keras extension, you will also need Keras and `TensorFlow <https://tensorflow.org>`_ installed.
- *Client*: We recommend using Google Chrome and are not supporting other browsers (for now). In other words, other browsers can be used at your own risk.

Configuration
-------------
After installing DeepForge, it can be helpful to check out `configuring DeepForge <getting_started/configuration.rst>`_
