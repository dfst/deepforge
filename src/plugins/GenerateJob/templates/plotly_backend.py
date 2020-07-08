"""
Plotly backend for matplotlib
"""
from __future__ import (absolute_import, division, print_function,
                        unicode_literals)
import io
import base64
import math

import numpy as np

from matplotlib._pylab_helpers import Gcf
from matplotlib.backend_bases import (
     FigureCanvasBase, FigureManagerBase, GraphicsContextBase, RendererBase)
from mpl_toolkits.mplot3d.art3d import Line3D, Path3DCollection
from PIL import Image
import plotly.graph_objects as go
from matplotlib.figure import Figure
from plotly.matplotlylib import mplexporter, PlotlyRenderer


def mpl_to_plotly(fig):
    """Convert matplotlib figure to a plotly figure

    Parameters
    ----------
    fig : matplotlib.pyplot.Figure
        The matplotlib figure

    Returns
    -------
    plotly.graph_objects.Figure
        The converted plotly Figure
    """
    renderer = DeepforgePlotlyRenderer()
    exporter = mplexporter.Exporter(renderer)
    exporter.run(fig)
    return renderer.plotly_fig

class DeepforgePlotlyRenderer(PlotlyRenderer):
    """PlotlyRenderer capable of handling images, 3D Plots

    Notes
    -----
    Currently only supports handling images
    """

    def draw_image(self, **props):
        imdata = props['imdata']
        base64_decoded = base64.b64decode(imdata)
        image = Image.open(io.BytesIO(base64_decoded))
        image_np = np.array(image)
        self.plotly_fig.add_trace(
            go.Image(
                z=image_np,
                xaxis="x{0}".format(self.axis_ct),
                yaxis="y{0}".format(self.axis_ct),
            ),
        )


class RendererTemplate(RendererBase):
    """
    The renderer handles drawing/rendering operations.

    This is a minimal do-nothing class that can be used to get started when
    writing a new backend. Refer to backend_bases.RendererBase for
    documentation of the classes methods.
    """
    def __init__(self, dpi):
        self.dpi = dpi

    def draw_path(self, gc, path, transform, rgbFace=None):
        pass

    # draw_markers is optional, and we get more correct relative
    # timings by leaving it out.  backend implementers concerned with
    # performance will probably want to implement it
#     def draw_markers(self, gc, marker_path, marker_trans, path, trans,
#                      rgbFace=None):
#         pass

    # draw_path_collection is optional, and we get more correct
    # relative timings by leaving it out. backend implementers concerned with
    # performance will probably want to implement it
#     def draw_path_collection(self, gc, master_transform, paths,
#                              all_transforms, offsets, offsetTrans,
#                              facecolors, edgecolors, linewidths, linestyles,
#                              antialiaseds):
#         pass

    # draw_quad_mesh is optional, and we get more correct
    # relative timings by leaving it out.  backend implementers concerned with
    # performance will probably want to implement it
#     def draw_quad_mesh(self, gc, master_transform, meshWidth, meshHeight,
#                        coordinates, offsets, offsetTrans, facecolors,
#                        antialiased, edgecolors):
#         pass

    def draw_image(self, gc, x, y, im):
        pass

    def draw_text(self, gc, x, y, s, prop, angle, ismath=False, mtext=None):
        pass

    def flipy(self):
        return True

    def get_canvas_width_height(self):
        return 100, 100

    def get_text_width_height_descent(self, s, prop, ismath):
        return 1, 1, 1

    def new_gc(self):
        return GraphicsContextTemplate()

    def points_to_pixels(self, points):
        # if backend doesn't have dpi, e.g., postscript or svg
        return points
        # elif backend assumes a value for pixels_per_inch
        #return points/72.0 * self.dpi.get() * pixels_per_inch/72.0
        # else
        #return points/72.0 * self.dpi.get()


class GraphicsContextTemplate(GraphicsContextBase):
    """
    The graphics context provides the color, line styles, etc...  See the gtk
    and postscript backends for examples of mapping the graphics context
    attributes (cap styles, join styles, line widths, colors) to a particular
    backend.  In GTK this is done by wrapping a gtk.gdk.GC object and
    forwarding the appropriate calls to it using a dictionary mapping styles
    to gdk constants.  In Postscript, all the work is done by the renderer,
    mapping line styles to postscript calls.

    If it's more appropriate to do the mapping at the renderer level (as in
    the postscript backend), you don't need to override any of the GC methods.
    If it's more appropriate to wrap an instance (as in the GTK backend) and
    do the mapping here, you'll need to override several of the setter
    methods.

    The base GraphicsContext stores colors as a RGB tuple on the unit
    interval, e.g., (0.5, 0.0, 1.0). You may need to map this to colors
    appropriate for your backend.
    """
    pass



########################################################################
#
# The following functions and classes are for pylab and implement
# window/figure managers, etc...
#
########################################################################

def draw_if_interactive():
    """
    For image backends - is not required
    For GUI backends - this should be overridden if drawing should be done in
    interactive python mode
    """


def show(block=None):
    """
    For image backends - is not required
    For GUI backends - show() is usually the last line of a pylab script and
    tells the backend that it is time to draw.  In interactive mode, this may
    be a do nothing func.  See the GTK backend for an example of how to handle
    interactive versus batch mode
    """
    for manager in Gcf.get_all_fig_managers():
        manager.canvas.send_deepforge_update()
        pass


def new_figure_manager(num, *args, **kwargs):
    """
    Create a new figure manager instance
    """
    # May be implemented via the `_new_figure_manager_template` helper.
    # If a main-level app must be created, this (and
    # new_figure_manager_given_figure) is the usual place to do it -- see
    # backend_wx, backend_wxagg and backend_tkagg for examples.  Not all GUIs
    # require explicit instantiation of a main-level app (egg backend_gtk,
    # backend_gtkagg) for pylab.
    FigureClass = kwargs.pop('FigureClass', Figure)
    thisFig = FigureClass(*args, **kwargs)
    return new_figure_manager_given_figure(num, thisFig)


def new_figure_manager_given_figure(num, figure):
    """
    Create a new figure manager instance for the given figure.
    """
    # May be implemented via the `_new_figure_manager_template` helper.
    canvas = FigureCanvasTemplate(figure)
    manager = FigureManagerTemplate(canvas, num)
    return manager


class FigureCanvasTemplate(FigureCanvasBase):
    """
    The canvas the figure renders into.  Calls the draw and print fig
    methods, creates the renderers, etc...

    Note GUI templates will want to connect events for button presses,
    mouse movements and key presses to functions that call the base
    class methods button_press_event, button_release_event,
    motion_notify_event, key_press_event, and key_release_event.  See,
    e.g., backend_gtk.py, backend_wx.py and backend_tkagg.py

    Attributes
    ----------
    figure : `matplotlib.figure.Figure`
        A high-level Figure instance

    """

    def draw(self):
        """
        Draw the figure using the renderer
        """
        self.send_deepforge_update()
        renderer = RendererTemplate(self.figure.dpi)
        self.figure.draw(renderer)

    def send_deepforge_update(self):
        state = self.figure_to_state()
        # Probably should do some diff-ing if the state hasn't changed...
        # TODO
        print('deepforge-cmd PLOT ' + state)

    def figure_to_state(self):
        figure = self.figure
        plotly_figure = mpl_to_plotly(
            figure
        )

        return plotly_figure.to_json()

    # You should provide a print_xxx function for every file format
    # you can write.

    # If the file type is not in the base set of filetypes,
    # you should add it to the class-scope filetypes dictionary as follows:
    filetypes = FigureCanvasBase.filetypes.copy()
    filetypes['foo'] = 'My magic Foo format'

    def print_foo(self, filename, *args, **kwargs):
        """
        Write out format foo.  The dpi, facecolor and edgecolor are restored
        to their original values after this call, so you don't need to
        save and restore them.
        """
        pass

    def get_default_filetype(self):
        return 'foo'


class FigureManagerTemplate(FigureManagerBase):
    """
    Wrap everything up into a window for the pylab interface

    For non interactive backends, the base class does all the work
    """
    pass

########################################################################
#
# Now just provide the standard names that backend.__init__ is expecting
#
########################################################################

FigureCanvas = FigureCanvasTemplate
FigureManager = FigureManagerTemplate