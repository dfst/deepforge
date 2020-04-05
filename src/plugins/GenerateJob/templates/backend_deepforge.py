"""
This is a fully functional do nothing backend to provide a template to
backend writers.  It is fully functional in that you can select it as
a backend with

  import matplotlib
  matplotlib.use('Template')

and your matplotlib scripts will (should!) run without error, though
no output is produced.  This provides a nice starting point for
backend writers because you can selectively implement methods
(draw_rectangle, draw_lines, etc...) and slowly see your figure come
to life w/o having to have a full blown implementation before getting
any results.

Copy this to backend_xxx.py and replace all instances of 'template'
with 'xxx'.  Then implement the class methods and functions below, and
add 'xxx' to the switchyard in matplotlib/backends/__init__.py and
'xxx' to the backends list in the validate_backend methon in
matplotlib/__init__.py and you're off.  You can use your backend with::

  import matplotlib
  matplotlib.use('xxx')
  from pylab import *
  plot([1,2,3])
  show()

matplotlib also supports external backends, so you can place you can
use any module in your PYTHONPATH with the syntax::

  import matplotlib
  matplotlib.use('module://my_backend')

where my_backend.py is your module name.  This syntax is also
recognized in the rc file and in the -d argument in pylab, e.g.,::

  python simple_plot.py -dmodule://my_backend

If your backend implements support for saving figures (i.e. has a print_xyz()
method) you can register it as the default handler for a given file type

  from matplotlib.backend_bases import register_backend
  register_backend('xyz', 'my_backend', 'XYZ File Format')
  ...
  plt.savefig("figure.xyz")

The files that are most relevant to backend_writers are

  matplotlib/backends/backend_your_backend.py
  matplotlib/backend_bases.py
  matplotlib/backends/__init__.py
  matplotlib/__init__.py
  matplotlib/_pylab_helpers.py

Naming Conventions

  * classes Upper or MixedUpperCase

  * variables lower or lowerUpper

  * functions lower or underscore_separated

"""

from __future__ import (absolute_import, division, print_function,
                        unicode_literals)
import math
import base64
import io
import itertools
import six

import numpy as np
import numpy.ma as ma

from matplotlib._pylab_helpers import Gcf
from matplotlib.backend_bases import (
     FigureCanvasBase, FigureManagerBase, GraphicsContextBase, RendererBase)
from matplotlib.figure import Figure
from matplotlib.colors import to_hex
from matplotlib import transforms, collections
from matplotlib.collections import LineCollection, PathCollection
from matplotlib.path import Path
from mpl_toolkits.mplot3d import Axes3D
from mpl_toolkits.mplot3d.art3d import Line3D, Path3DCollection
from matplotlib.pyplot import gcf, close
import simplejson as json

# The following functions are used as they are from the mplexporter library
# Available at: https://github.com/mpld3/mplexporter
PATH_DICT = {Path.LINETO: 'L',
             Path.MOVETO: 'M',
             Path.CURVE3: 'S',
             Path.CURVE4: 'C',
             Path.CLOSEPOLY: 'Z'}

def SVG_path(path, transform=None, simplify=False):
    """Construct the vertices and SVG codes for the path

    Parameters
    ----------
    path : matplotlib.Path object

    transform : matplotlib transform (optional)
        if specified, the path will be transformed before computing the output.

    Returns
    -------
    vertices : array
        The shape (M, 2) array of vertices of the Path. Note that some Path
        codes require multiple vertices, so the length of these vertices may
        be longer than the list of path codes.
    path_codes : list
        A length N list of single-character path codes, N <= M. Each code is
        a single character, in ['L','M','S','C','Z']. See the standard SVG
        path specification for a description of these.
    """
    if transform is not None:
        path = path.transformed(transform)

    vc_tuples = [(vertices if path_code != Path.CLOSEPOLY else [],
                  PATH_DICT[path_code])
                 for (vertices, path_code)
                 in path.iter_segments(simplify=simplify)]

    if not vc_tuples:
        # empty path is a special case
        return np.zeros((0, 2)), []
    else:
        vertices, codes = zip(*vc_tuples)
        vertices = np.array(list(itertools.chain(*vertices))).reshape(-1, 2)
        return vertices, list(codes)

def process_transform(transform, ax=None, data=None, return_trans=False,
                      force_trans=None):
    """Process the transform and convert data to figure or data coordinates

    Parameters
    ----------
    transform : matplotlib Transform object
        The transform applied to the data
    ax : matplotlib Axes object (optional)
        The axes the data is associated with
    data : ndarray (optional)
        The array of data to be transformed.
    return_trans : bool (optional)
        If true, return the final transform of the data
    force_trans : matplotlib.transform instance (optional)
        If supplied, first force the data to this transform

    Returns
    -------
    code : string
        Code is either "data", "axes", "figure", or "display", indicating
        the type of coordinates output.
    transform : matplotlib transform
        the transform used to map input data to output data.
        Returned only if return_trans is True
    new_data : ndarray
        Data transformed to match the given coordinate code.
        Returned only if data is specified
    """
    if isinstance(transform, transforms.BlendedGenericTransform):
        warnings.warn("Blended transforms not yet supported. "
                      "Zoom behavior may not work as expected.")

    if force_trans is not None:
        if data is not None:
            data = (transform - force_trans).transform(data)
        transform = force_trans

    code = "display"
    if ax is not None:
        for (c, trans) in [("data", ax.transData),
                           ("axes", ax.transAxes),
                           ("figure", ax.figure.transFigure),
                           ("display", transforms.IdentityTransform())]:
            if transform.contains_branch(trans):
                code, transform = (c, transform - trans)
                break

    if data is not None:
        if return_trans:
            return code, transform.transform(data), transform
        else:
            return code, transform.transform(data)
    else:
        if return_trans:
            return code, transform
        else:
            return code

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
        print('deepforge-cmd PLOT ' + json.dumps(state, ignore_nan=True))

    def figure_to_state(self):
        figure = self.figure
        state = {}
        state['id'] = self.manager.num
        state['title'] = ''
        if self.figure._suptitle:
            state['title'] = self.figure._suptitle.get_text()

        state['axes'] = []
        # Get the data points
        for axes in figure.get_axes():
            axes_data = {}
            axes_data['title'] = axes.get_title()
            axes_data['xlabel'] = axes.get_xlabel()
            axes_data['ylabel'] = axes.get_ylabel()
            axes_data['xlim'] = axes.get_xlim()
            axes_data['ylim'] = axes.get_ylim()
            axes_data['is3D'] = False
            if hasattr(axes, 'get_zlabel'):
                axes_data['zlim'] = axes.get_zlim()
                axes_data['zlabel'] = axes.get_zlabel()
                axes_data['is3D'] = True

            axes_data['lines'] = []
            axes_data['images'] = []
            axes_data['scatterPoints'] = []

            # Line Data
            for i, line in enumerate(axes.lines):
                lineDict = {}
                if isinstance(line, Line3D):
                    points = line.get_data_3d()
                    lineDict['points'] = np.transpose(points).tolist()
                else:
                    lineDict['points'] = line.get_xydata().tolist()
                lineDict['label'] = ''
                lineDict['color'] = to_hex(line.get_color())
                lineDict['marker'] = line.get_marker()
                lineDict['lineStyle'] = line.get_ls()
                lineDict['lineWidth'] = line.get_lw()
                default_label = ('_line' + str(i))
                if line.get_label() != default_label:
                    lineDict['label'] = line.get_label()
                axes_data['lines'].append(lineDict)
                if lineDict['marker'] is None or lineDict['marker'] == 'None':
                    lineDict['marker'] = ''
            # Line Collections
            for collection in axes.collections:
                if isinstance(collection, LineCollection):
                    axes_data['lines'].extend(self.process_line_collection(collection))
                if isinstance(collection, PathCollection):
                    axes_data['scatterPoints'].append(self.process_collection(axes, collection, force_pathtrans=axes.transAxes))

            # Image data
            for i, image in enumerate(axes.images):
                imageDict = {}
                properties_dict = image.properties()
                imageDict['height'] = properties_dict['size'][0]
                imageDict['width'] = properties_dict['size'][1]
                imageDict['visible'] = properties_dict['visible']
                (imageDict['rgbaMatrix'], imageDict['numChannels']) = self.umask_b64_encode(properties_dict['array'])

                axes_data['images'].append(imageDict)

            state['axes'].append(axes_data)
        return state

    def process_line_collection(self, collection):
        line_collections = []
        colors = collection.get_colors()
        ls = collection.get_dashes()
        lw = collection.get_linewidths()

        for i, segment  in enumerate(collection.get_segments()):
            line_collection_data = dict()
            line_collection_data['points'] = segment.tolist()
            label = collection.get_label()
            if label is None:
                line_collection_data['label'] = ''
            else:
                line_collection_data['label'] = label
            line_collection_data['color'] = to_hex(colors[i%len(colors)])
            line_collection_data['lineStyle'] = 'solid'
            line_collection_data['lineWidth'] = lw[i%len(lw)]
            line_collection_data['marker'] = '.'
            line_collections.append(line_collection_data)
        return line_collections

    def process_collection(self, ax, collection,
                           force_pathtrans=None,
                           force_offsettrans=None):
        fig = gcf()
        fig.savefig(io.BytesIO(), format='png', dpi=fig.dpi)
        close(fig)

        (transform, transOffset,
                 offsets, paths) = collection._prepare_points()
        offset_coords, offsets = process_transform(
                    transOffset, ax, offsets, force_trans=force_offsettrans)
        processed_paths = [SVG_path(path) for path in paths]
        processed_paths = [(process_transform(
                    transform, ax, path[0], force_trans=force_pathtrans)[1], path[1])
                                   for path in processed_paths]
        path_transforms = collection.get_transforms()
        styles = {'linewidth': collection.get_linewidths(),
                  'facecolor': collection.get_facecolors(),
                  'edgecolor': collection.get_edgecolors(),
                  'alpha': collection._alpha,
                  'zorder': collection.get_zorder()}

        offset_dict = {"data": "before",
                       "screen": "after"}
        offset_order = offset_dict[collection.get_offset_position()]
        coll_offsets = offsets
        if isinstance(collection, Path3DCollection):
            coll_offsets = self.get_3d_array(collection._offsets3d)

        return {
            'color': self.colors_to_hex(styles['facecolor'].tolist()),
            'points': coll_offsets.tolist(),
            'marker': '.',      #TODO: Detect markers from Paths
            'label': '',
            'width': self.convert_size_array(collection.get_sizes())
        }

    def get_3d_array(self, masked_array_tuple):
        values = []
        for array in masked_array_tuple:
            values.append(ma.getdata(array))
        return np.transpose(np.asarray(values))


    def convert_size_array(self, size_array):
        size = [math.sqrt(s) for s in size_array]
        if len(size) == 1:
            return size[0]
        else:
            return size

    def colors_to_hex(self, colors_list):
        hex_colors = []
        for color in colors_list:
            hex_colors.append(to_hex(color, keep_alpha=True))
        if len(hex_colors) == 1:
            return hex_colors[0]
        return hex_colors

    def umask_b64_encode(self, masked_array):
        # Unmask invalid data if present
        if masked_array.mask:
            masked_array.fill_value = 0
        image_array = masked_array.filled()
        if np.all(np.where(image_array <= 1, True, False)):
            array = (image_array * 255).astype(np.uint8)
        else:
            array = image_array.astype(np.uint8)
        if not array.flags['C_CONTIGUOUS']:  # Needed for base64 encoding
            array = array.copy(order='c')
        if len(array.shape) == 2:  # In Case a grayscale Image
            array = np.stack((array, array, array), axis=-1)
        encoded_array = base64.b64encode(array)
        return encoded_array, array.shape[-1]

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
