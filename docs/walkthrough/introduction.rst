Introduction
============
This tutorial provides detailed instructions for creating a complete DeepForge project from scratch. The motivating examples for this walkthrough will be a simple image classification task using `CIFAR-10 <https://www.cs.toronto.edu/~kriz/cifar.html>`_ as our dataset and a more complex astronomical redshift estimation task using `Sloan Digital Sky Survey <https://www.sdss.org/dr13/>`_ as our dataset.

The overall process of creating projects is centered around the creation of data processing **pipelines** that will be executed to generate the data, visualizations, models, etc. that we need. This guide begins with a detailed walkthrough on how to create pipelines and all their constituent parts. After this introductory walkthrough will be detailed walkthroughs on how to create a pair of useful pipelines using the motivating examples.

.. figure:: images/pipelines-view.png
    :align: center