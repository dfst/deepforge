Operation Feedback
==================

Operations can provide real-time graph feedback. In the future, this will be extended to other forms of feedback such as image feedback.

Graphs
------
Real-time graphs can be created using `matplotlib`:

.. code-block:: python

    import matplotlib.pyplot as plt
    plt.plot([1, 4, 9, 16, 25])

    plt.draw()
    plt.show()

The graph can also be configured in regular matplotlib fashion:

.. code-block:: python

    plt.title('My First Plot')
    plt.xlabel('This is the x-axis')
    plt.ylabel('This is the y-axis')

    plt.draw()
    plt.show()

