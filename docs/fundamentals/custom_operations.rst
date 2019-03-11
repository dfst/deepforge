Custom Operations
=================

In this document we will outline the basics of custom operations including the operation editor and operation feedback utilities.

The Basics
----------
Operations are used in pipelines and have named inputs and outputs. When creating a pipeline, if you don't currently find an operation for the given task, you can easily create your own by selecting the `New Operation...` operation from the add operation dialog. This will create a new operation definition and open it in the operation editor. The operation editor has two main parts, the interface editor and the implementation editor.

.. figure:: operation_editor.png
    :align: center
    :scale: 45 %

    Editing the "Train" operation from the "CIFAR10" example

The interface editor is provided on the left and presents the interface as a diagram showing the input data and output data as objects flowing into or out of the given operation. Selecting the operation node in the operation interface editor will expand the node and allow the user to add or edit attributes for the given operation. These attributes are exposed when using this operation in a pipeline and can be set at design time - that is, these are set when creating the given pipeline. The interface diagram may also contain light blue nodes flowing into the operation. These nodes represent "references" that the operation accepts as input before running. When using the operation, references will appear alongside the attributes but will allow the user to select from a list of all possible targets when clicked.

.. figure:: operation_interface.png
    :align: center
    :scale: 85 %

    The train operation accepts training data, a model and attributes for shuffling data, setting the batch size, and the number of epochs.

On the right of the operation editor is the implementation editor. The implementation editor is a code editor specially tailored for programming the implementations of operations in DeepForge. It also is synchronized with the interface editor. A section of the implementation is shown below:

.. code:: python
    import keras
    from matplotlib import pyplot as plt

    class Train():
        def __init__(self, model, shuffle=True, epochs=100, batch_size=32):
            self.model = model
            
            self.epochs = epochs
            self.shuffle = shuffle
            self.batch_size = batch_size
            return


        def execute(self, training_data):
            (x_train, y_train) = training_data
            opt = keras.optimizers.rmsprop(lr=0.0001, decay=1e-6)
            self.model.compile(loss='categorical_crossentropy',
                               optimizer=opt,
                               metrics=['accuracy'])
            plot_losses = PlotLosses()
            self.model.fit(x_train, y_train,
                           self.batch_size,
                           epochs=self.epochs,
                           callbacks=[plot_losses],
                           shuffle=self.shuffle)
            
            model = self.model
            return model

The "Train" operation uses capabilities from the :code:`keras` package to train the neural network. This operation sets all the parameters using values provided to the operation as either attributes or references. In the implementation, attributes are provided as arguments to the constructor making the user defined attributes accessible from within the implementation. References are treated similarly to operation inputs and are also arguments to the constructor. This can be seen with the :code:`model` constructor argument. Finally, operations return their outputs in the :code:`execute` method; in this example, it returns a single output named :code:`model`, that is, the trained neural network.

After defining the interface and implementation, we can now use the "Train" operation in our pipelines! An example is shown below.

.. figure:: train_operation.png
    :align: center
    :scale: 85 %

    Using the "Train" operation in a pipeline

Operation feedback
------------------
Operations in DeepForge can generate metadata about its execution. This metadata is generated during the execution and provided back to the user in real-time. An example of this includes providing real-time plotting feedback. When implementing an operation in DeepForge, this metadata can be created using the :code:`matplotlib` plotting capabilities.

.. figure:: graph_example.png
    :align: center
    :scale: 75 %

    An example graph of the loss function while training a neural network

Detailed information about the available operation metadata types can be found in the `reference <reference/feedback_mechanisms.rst>`_.
