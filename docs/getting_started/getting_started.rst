Getting Started
===============

.. _Torch: http://torch.ch

Installation instructions to come!

- `What is DeepForge? <#id1>`_
- `Design Goals <#design-goals>`_
- `Features <#overview-and-features>`_
- `Installation <installation_guide.rst>`_
- `Configuration <configuration.rst>`_

What is DeepForge?
------------------
Deep learning is a very promising, yet complex, area of machine learning. This complexity can both create a barrier to entry for those wanting to get involved in deep learning as well as slow the development of those already comfortable in deep learning.

DeepForge is a development environment for deep learning focused on alleviating these problems. Leveraging the flexibility of Torch_, DeepForge is able to reduce the complexity of using deep learning while still providing advanced features such as defining custom layers.

Design Goals
------------
As mentioned above, DeepForge focuses on two main goals:

1. **Improving the efficiency** of experienced data scientists/researchers in deep learning
2. **Lowering the barrier to entry** for newcomers to deep learning

It is important to highlight that although one of the goals is focused on lowering the barrier to entry, DeepForge is intended to be more than simply an educational tool; that is, it is important not to compromise on flexibility and effectiveness as a research/industry tool in order to provide an easier experience for beginners (that's what forks are for!).

Overview and Features
---------------------
DeepForge provides a collaborative, distributed development environment for deep learning. The development environment is a hybrid visual and textual programming environment. Higher levels of abstraction, such as creating architectures, use visual environments to capture the overall structure of the task while lower levels of abstraction, such as defining custom layers, utilize text environments to maintain the flexibility provided by torch.

Concepts and Terminology
~~~~~~~~~~~~~~~~~~~~~~~~
- *Architecture* - neural network architecture composed of torch defined layers
- *Operation* - essentially a function written in torch (such as `SGD`)
- *Pipeline* - directed acyclic graph composed of operations
  - eg, a training pipeline may retrieve and normalize data, train an architecture and return the trained model
- *Execution* - when a pipeline is run, an "execution" is created and reports the status of each operation as it is run (distributed over a number of worker machines)
- *Artifact* - an artifact represents some data (either user uploaded or created during an execution)
