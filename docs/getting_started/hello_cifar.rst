First Steps
===========
DeepForge provides an example project for creating a classifier using the `CIFAR10 <https://www.kaggle.com/c/cifar-10>`_ dataset.

When first opening DeepForge in your browser (at `http://localhost:8888` if following the instructions from the `quick start <getting_started/installation.rst>`_), you will be prompted with a list of projects to open and provided the option to create a new project. For this example, let's click "Create new..." and name our project "hello_cifar".

Clicking "Create" will bring us to a prompt for the "seed" for our project. Select "cifar10" from the dropdown and click "Create". This will now create our new project based on the cifar10 example provided with DeepForge.

In this example, we have three main pipelines: `download-normalize`, `train` and `test`. `download-normalize` downloads and prepares our data. The `train` pipeline trains a neural network model on the cifar10 dataset and the `test` pipeline tests our trained model on our test set from the cifar10 dataset.

.. First, we will 

.. Explain how to run your first model...
