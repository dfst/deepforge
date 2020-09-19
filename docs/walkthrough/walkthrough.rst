Walkthrough
===========
This tutorial provides detailed instructions for creating a complete DeepForge project from scratch. The motivating examples for this walkthrough will be a simple image classification task using `CIFAR-10 <https://www.cs.toronto.edu/~kriz/cifar.html>`_ as our dataset and a more complex astronomical redshift estimation task using `Sloan Digital Sky Survey <https://www.sdss.org/dr13/>`_ as our dataset.

The overall process of creating projects is centered around the creation of data processing **pipelines** that will be executed to generate the data, visualizations, models, etc. that we need. This guide begins with a detailed walkthrough on how to create pipelines and all their constituent parts. After this introductory walkthrough will be detailed walkthroughs on how to create a pair of useful pipelines using the motivating examples.

.. figure:: images/pipelines-view.png
    :align: center

Index
-----

* `Creating Pipelines <creating-pipelines.rst>`_
* `Creating Operations <creating-operations.rst>`_

  * `Graphical Editing <creating-operations.rst#editing-the-operation-interface>`_
  * `Implementing the Operation <creating-operations.rst#implementing-the-operation>`_
  * `Importing Libraries <creating-operations.rst#importing-libraries>`_

* `Creating Neural Networks <creating-neural-networks.rst>`_

  * `Importing Resource Libraries <creating-neural-networks.rst#importing-resource-libraries>`_
  * `Creating a New Architecture <creating-neural-networks.rst#creating-a-new-architecture>`_
  * `Editing Network Layers <creating-neural-networks.rst#editing-network-layers>`_
  * `Adding Additional Layers <creating-neural-networks.rst#adding-additional-layers>`_
  * `Connections Between Layers <creating-neural-networks.rst#connections-between-layers>`_
  * `Exporting Architectures <creating-neural-networks.rst#exporting-architectures>`_

* `Executing Pipelines <executing-pipelines.rst>`_

  * `Executing within DeepForge <executing-pipelines.rst#executing-within-deepForge>`_
  * `Manual Execution <executing-pipelines.rst#manual-execution>`_

* `Viewing Executions <viewing-executions.rst>`_

  * `Monitoring Executions <viewing-executions.rst#monitoring-executions>`_
  * `Execution Status Tracker <viewing-executions.rst#viewing-executions>`_
  * `Viewing the Compute Dashboard <viewing-executions.rst#viewing-the-compute-dashboard>`_
  * `Viewing Execution Output <viewing-executions.rst#viewing-execution-output>`_

* `Introductory Example: CIFAR-10 Classifier <CIFAR-10-classifier.rst>`_

* `Advanced Example: Cosmological Redshift Estimator <redshift-estimator.rst>`_





