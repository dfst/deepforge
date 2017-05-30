Operation Feedback
==================

DeepForge provides the `deepforge` global object in operation implementations for providing feedback during the execution. The various types of metadata are provided and discussed below.

Graphs
------
Real-time graphs can be created using the graph constructor:

.. code-block:: lua

    local graph = deepforge.Graph('My Graph')  -- created a new graph called "My Graph"

After creating a graph, lines can be added similarly.

.. code-block:: lua

    local line1 = graph:line('first line')  -- created a new line called "first line"
    local line2 = graph:line('second line')  -- created a second line called "second line"

Finally, points can be added to the lines by calling the `:add` method on the line and passing the x and y values for the given point.

.. code-block:: lua

    line1:add(1, 3)  -- adding point (1, 3) to line1
    line2:add(1, 4)  -- adding point (1, 4) to line2

    line1:add(2, 5)  -- adding point (2, 5) to line1
    line2:add(2, 6)  -- adding point (2, 6) to line2

Graphs can then label their axis as follows:

.. code-block:: lua

    graph:xlabel('x axis')  -- label the x axis "x axis"
    graph:ylabel('y axis')  -- label the y axis "y axis"


Images
------
Images can be created using:

.. code-block:: lua

    local image = deepforge.Image('My Example Image', imageTensor)

The first argument is the title of the image and the second argument is the tensor for the image (optional). Both the title and the tensor can be updated during execution as follows.

.. code-block:: lua

    image:title('My New Title')  -- updating the image title
    image:update(newTensor)  -- updating the displayed image

