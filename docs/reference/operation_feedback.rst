Operation Feedback
==================

Operations can provide real-time graph feedback. DeepForge provides support for subplots, basic 2D and 3D scatter and line plots and images from :code:`matplotlib`.


Graphs
------
Real-time graphs can be created using `matplotlib`. Following example shows a sample 3D Scatter plot and its rendering in `DeepForge`.

.. code-block:: python

    import matplotlib.pyplot as plt
    import numpy as np
    from mpl_toolkits.mplot3d import Axes3D

    class Scatter3DPlots():

        def execute(self):
            # Fixing random state for reproducibility
            np.random.seed(19680801)


            def randrange(n, vmin, vmax):
                '''
                Helper function to make an array of random numbers having shape (n, )
                with each number distributed Uniform(vmin, vmax).
                '''
                return (vmax - vmin)*np.random.rand(n) + vmin

            fig = plt.figure()
            ax = fig.add_subplot(111, projection='3d')

            n = 100

            # For each set of style and range settings, plot n random points in the box
            # defined by x in [23, 32], y in [0, 100], z in [zlow, zhigh].
            for m, zlow, zhigh in [('o', -50, -25), ('^', -30, -5)]:
                xs = randrange(n, 23, 32)
                ys = randrange(n, 0, 100)
                zs = randrange(n, zlow, zhigh)
                ax.scatter(xs, ys, zs, marker=m)

            ax.set_xlabel('X Label')
            ax.set_ylabel('Y Label')
            ax.set_zlabel('Z Label')
            plt.show()

.. figure:: 3d_graph.png
    :align: center

    An example rendering for a 3D Plot from matplotlib in DeepForge

Images
------
Image plots from `matplotlib` are supported. The following example shows image plots from the `MNIST fashion dataset`.

.. code-block:: python

    from matplotlib import pyplot
    from keras.datasets import fashion_mnist

    class MnistFashion():

        def execute(self):

            # load dataset
            (trainX, trainy), (testX, testy) = fashion_mnist.load_data()
            # summarize loaded dataset
            print('Train: X=%s, y=%s' % (trainX.shape, trainy.shape))
            print('Test: X=%s, y=%s' % (testX.shape, testy.shape))
            # plot first few images
            for i in range(9):
                # define subplot
                pyplot.subplot(330 + 1 + i)
                # plot raw pixel data
                pyplot.imshow(trainX[i], cmap=pyplot.get_cmap('gray'))
            # show the figure
            pyplot.show()

.. figure:: mnist_fashion.png
    :align: center

    MNIST fashion dataset images as rendered in deepforge
