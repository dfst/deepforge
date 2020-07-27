"""
Plotly backend for matplotlib
"""
from __future__ import (absolute_import, division, print_function,
                        unicode_literals)
import six
import io
import base64
import math

import numpy as np
import numpy.ma as ma

import matplotlib
from matplotlib._pylab_helpers import Gcf
from matplotlib.backend_bases import (
     FigureCanvasBase, FigureManagerBase, GraphicsContextBase, RendererBase
)
import matplotlib.pyplot as plt
from matplotlib.figure import Figure
from matplotlib import transforms, collections
from matplotlib import ticker
from matplotlib.path import Path
from matplotlib.patches import PathPatch
from mpl_toolkits.mplot3d.axes3d import Axes3D
from mpl_toolkits.mplot3d.axis3d import ZAxis
from mpl_toolkits.mplot3d.art3d import Path3DCollection, Line3D

from PIL import Image

import plotly.graph_objects as go
from plotly.matplotlylib import mplexporter, PlotlyRenderer
from plotly.matplotlylib import mpltools


PLOTLY_3D_MARKER_SYMBOLS = (
    'square',
    'square-open',
    'diamond',
    'circle-open',
    'circle',
    'cross',
    'cross-open',
    'x'
)


def get_z_axes_properties(ax):
    """Parse figure z-axes parameter"""
    props = {}
    axis = ax.zaxis
    domain = ax.get_zlim()
    axname = 'z'
    lim = domain
    if isinstance(axis.converter, matplotlib.dates.DateConverter):
            scale = 'date'
            try:
                import pandas as pd
                from pandas.tseries.converter import PeriodConverter
            except ImportError:
                pd = None

            if (pd is not None and isinstance(axis.converter,
                                              PeriodConverter)):
                _dates = [pd.Period(ordinal=int(d), freq=axis.freq)
                          for d in domain]
                domain = [(d.year, d.month - 1, d.day,
                           d.hour, d.minute, d.second, 0)
                          for d in _dates]
            else:
                domain = [(d.year, d.month - 1, d.day,
                           d.hour, d.minute, d.second,
                           d.microsecond * 1E-3)
                          for d in matplotlib.dates.num2date(domain)]
    else:
        scale = axis.get_scale()

    if scale not in ['date', 'linear', 'log']:
        raise ValueError("Unknown axis scale: "
                            "{0}".format(axis.get_scale()))

    props[axname + 'scale'] = scale
    props[axname + 'lim'] = lim
    props[axname + 'domain'] = domain

    return props


def get_z_axis_properties(axis):
    """Return the property dictionary for a matplotlib.Axis instance"""
    props = {}
    label1On = axis._major_tick_kw.get('label1On', True)

    if isinstance(axis, ZAxis):
        if label1On:
            props['position'] = "bottom"
        else:
            props['position'] = "top"
    else:
        raise ValueError("{0} should be an ZAxis instance".format(axis))

    # Use tick values if appropriate
    locator = axis.get_major_locator()
    props['nticks'] = len(locator())
    if isinstance(locator, ticker.FixedLocator):
        props['tickvalues'] = list(locator())
    else:
        props['tickvalues'] = None

    # Find tick formats
    formatter = axis.get_major_formatter()
    if isinstance(formatter, ticker.NullFormatter):
        props['tickformat'] = ""
    elif isinstance(formatter, ticker.FixedFormatter):
        props['tickformat'] = list(formatter.seq)
    elif not any(label.get_visible() for label in axis.get_ticklabels()):
        props['tickformat'] = ""
    else:
        props['tickformat'] = None

    # Get axis scale
    props['scale'] = axis.get_scale()

    # Get major tick label size (assumes that's all we really care about!)
    labels = axis.get_ticklabels()
    if labels:
        props['fontsize'] = labels[0].get_fontsize()
    else:
        props['fontsize'] = None

    # Get associated grid
    props['grid'] = mplexporter.utils.get_grid_style(axis)

    # get axis visibility
    props['visible'] = axis.get_visible()

    return props


def get_symbol_3d(marker_symbol):
    """convert mpl marker symbols into supported plotly 3d symbols"""
    symbol = mpltools.convert_symbol(marker_symbol)
    if symbol not in PLOTLY_3D_MARKER_SYMBOLS:
        return 'circle'


def convert_z_domain(mpl_plot_bounds, mpl_max_z_bounds):
    """Get domain bounds for a 3d-ZAxis matplotlib"""
    mpl_z_dom =  [mpl_plot_bounds[2], mpl_plot_bounds[2] + mpl_plot_bounds[3]]
    plotting_depth = mpl_max_z_bounds[1] - mpl_max_z_bounds[0]
    z0 = (mpl_z_dom[0] - mpl_max_z_bounds[0]) / plotting_depth
    z1 = (mpl_z_dom[1] - mpl_max_z_bounds[0]) / plotting_depth
    return [z0, z1]


def prep_xyz_axis(ax, props, x_bounds, y_bounds, z_bounds):
    """Crawl properties for a  matplotlib Axes3D"""
    xaxis = dict(
        type=props['axes'][0]['scale'],
        range=list(props['xlim']),
        domain=mpltools.convert_x_domain(props['bounds'], x_bounds),
        side=props['axes'][0]['position'],
        tickfont=dict(size=props['axes'][0]['fontsize'])
    )
    xaxis.update(mpltools.prep_ticks(ax, 0, 'x', props))

    yaxis = dict(
        type=props["axes"][1]["scale"],
        range=list(props["ylim"]),
        showgrid=props["axes"][1]["grid"]["gridOn"],
        domain=mpltools.convert_y_domain(props["bounds"], y_bounds),
        side=props["axes"][1]["position"],
        tickfont=dict(size=props["axes"][1]["fontsize"]),
    )

    yaxis.update(mpltools.prep_ticks(ax, 1, "y", props))

    zaxis = dict(
        type=props['axes'][2]['scale'],
        range=list(props['zlim']),
        showgrid=props['axes'][1]['grid']['gridOn'],
        side=props['axes'][2]['position'],
        tickfont=dict(size=props['axes'][2]['fontsize'])
    )

    zaxis.update(mpltools.prep_ticks(ax, 2, "z", props))

    return xaxis, yaxis, zaxis


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
    renderer.crawl_3d_labels(fig)
    return renderer.plotly_fig


class DeepforgePlotlyRenderer(PlotlyRenderer):
    """PlotlyRenderer capable of handling images, 3D Plots

    Notes
    -----
    Currently only supports handling images
    """

    def draw_image(self, **props):
        """Write base64 encoded images into plotly figure"""
        imdata = props['imdata']
        base64_decoded = base64.b64decode(imdata)
        image = Image.open(io.BytesIO(base64_decoded))
        image_np = np.array(image)
        self.plotly_fig.add_trace(
            go.Image(
                z=image_np,
                xaxis='x{0}'.format(self.axis_ct),
                yaxis='y{0}'.format(self.axis_ct),
            ),
        )

    def get_3d_array(self, masked_array_tuple):
        """convert a masked array into an array of 3d-coordinates"""
        values = []
        for array in masked_array_tuple:
            values.append(ma.getdata(array))
        return np.transpose(np.asarray(values))

    def draw_path_collection(self, **props):
        """Open path_collection to support 3d Objects from matplotlib figure"""
        if props['offset_coordinates'] == 'data':
            markerstyle = mpltools.get_markerstyle_from_collection(props)
            scatter_props = {
                'coordinates': 'data',
                'data': props['offsets'],
                'label': None,
                'markerstyle': markerstyle,
                'linestyle': None,
            }
            if isinstance(props['mplobj'], Path3DCollection): # Support for scatter3d plots
                scatter_props['data'] = self.get_3d_array(props['mplobj']._offsets3d)
                self.draw_3d_collection(**scatter_props)

            else:
                self.msg += '    Drawing path collection as markers\n'
                self.draw_marked_line(**scatter_props)
        else:
            self.msg += '    Path collection not linked to "data", ' 'not drawing\n'
            warnings.warn(
                'Dang! That path collection is out of this '
                'world. I totally don\'t know what to do with '
                'it yet! Plotly can only import path '
                'collections linked to "data" coordinates'
            )

    def draw_marked_line(self, **props):
        """Add support for Line3d matplotlib objects to the plotly renderer"""
        if isinstance(props.get('mplobj'), Line3D): # 3D Line Plots
            props['data'] = np.transpose(props['mplobj'].get_data_3d())
            self.draw_3d_collection(**props)
        else:
            super().draw_marked_line(**props)

    def draw_3d_collection(self, **props):
        """Draw 3D collection for scatter plots"""
        line, marker = {}, {}
        if props['linestyle'] and props['markerstyle']:
            mode = 'lines+markers'
        elif props['linestyle']:
            mode = 'lines'
        elif props['markerstyle']:
            mode = 'markers'
        if props['linestyle']:
            color = mpltools.merge_color_and_opacity(
                props['linestyle']['color'], props['linestyle']['alpha']
            )
            line = go.scatter3d.Line(
                color=color,
                width=props['linestyle']['linewidth'],
                dash=mpltools.convert_dash(props["linestyle"]["dasharray"])
            )

        if props['markerstyle']:
            marker = go.scatter3d.Marker(
                opacity=props["markerstyle"]["alpha"],
                color=props["markerstyle"]["facecolor"],
                symbol=get_symbol_3d(props["markerstyle"]["marker"]),
                size=props["markerstyle"]["markersize"],
                line=dict(
                    color=props["markerstyle"]["edgecolor"],
                    width=props["markerstyle"]["edgewidth"],
                ),
            )

        if props["coordinates"] == "data":
            scatter_plot = go.Scatter3d(
                mode=mode,
                name=(
                    str(props["label"])
                    if isinstance(props["label"], six.string_types)
                    else props["label"]
                ),
                x=[xyz_pair[0] for xyz_pair in props["data"]],
                y=[xyz_pair[1] for xyz_pair in props["data"]],
                z=[xyz_pair[2] for xyz_pair in props["data"]],
                scene='scene{}'.format(self.axis_ct),
                line=line,
                marker=marker,
            )
            if self.x_is_mpl_date:
                formatter = (
                    self.current_mpl_ax.get_xaxis()
                    .get_major_formatter()
                    .__class__.__name__
                )

                scatter_plot["x"] = mpltools.mpl_dates_to_datestrings(
                    scatter_plot["x"], formatter
                )

            self.plotly_fig.add_trace(
                scatter_plot
            )

    def crawl_3d_labels(self, fig):
        """Crawl labels for 3d axes in matplotlib"""
        for i, axes in enumerate(fig.axes):
            if isinstance(axes, Axes3D):
                for (text, ttype) in [
                    (axes.xaxis.label, 'xlabel', ),
                    (axes.yaxis.label, 'ylabel'),
                    (axes.zaxis.label, 'zlabel'),
                ]:
                    content = text.get_text()
                    if content:
                        transform = text.get_transform()
                        position = text.get_position()
                        coords, position = self.process_transfrom(
                            transform,
                            axes,
                            position,
                            force_trans=axes.transAxes
                        )
                        style = mplexporter.utils.get_text_style(text)
                        method = getattr(
                            self,
                            f'draw_3d_{ttype}'
                        )
                        method(
                            text=content,
                            position=position,
                            coordinates=coords,
                            text_type=ttype,
                            mplobj=text,
                            style=style,
                            scene_id=i+1
                        )

    def open_axes(self, ax, props):
        """Open axes to support matplotlib Axes3D"""
        if isinstance(ax, Axes3D):
            props['axes'].append(get_z_axis_properties(ax.zaxis))
            self.axis_ct += 1
            self.bar_containers = [
                c
                for c in ax.containers  # empty is OK
                if c.__class__.__name__ == "BarContainer"
            ]
            props.update(get_z_axes_properties(ax))
            self.current_mpl_ax = ax
            xaxis = go.layout.scene.XAxis(
                   zeroline=False,
                   ticks='inside'
            )
            yaxis = go.layout.scene.YAxis(
                   zeroline=False,
                   ticks='inside'
            )
            zaxis = go.layout.scene.ZAxis(
                zeroline=False,
                ticks='inside'
            )
            mpl_xaxis, mpl_yaxis, mpl_zaxis = prep_xyz_axis(
                ax=ax,
                props=props,
                x_bounds=self.mpl_x_bounds,
                y_bounds=self.mpl_y_bounds,
                z_bounds=(0, 1)
            )
            xaxis['range'] = mpl_xaxis['range']
            yaxis['range'] = mpl_yaxis['range']
            zaxis['range'] = mpl_zaxis['range']

            scene = go.layout.Scene(
                xaxis=xaxis,
                yaxis=yaxis,
                zaxis=zaxis
            )
            scene['domain'] = {
                'x': mpl_xaxis.pop('domain'),
                'y': mpl_yaxis.pop('domain')
            }
            mpl_xaxis.pop('side')
            mpl_yaxis.pop('side')
            mpl_zaxis.pop('side')
            xaxis.update(mpl_xaxis)
            yaxis.update(mpl_yaxis)
            zaxis.update(mpl_zaxis)
            self.plotly_fig['layout'][f'scene{self.axis_ct}']  = scene
        else:
            super().open_axes(ax, props)

    def draw_text(self, **props):
        """support zlabel for matplotlib Axes3D"""
        if props['text_type'] == 'zlabel':
            self.draw_3d_zlabel(**props)
        else:
            super().draw_text(**props)

    def draw_xlabel(self, **props):
        try:
            super().draw_xlabel(**props)
        except KeyError:
            self.draw_3d_xlabel(**props)

    def draw_3d_xlabel(self, **props):
        scene_key = f'scene{self.axis_ct}'
        self.plotly_fig['layout'][scene_key]['xaxis']['title'] = props['text']
        titlefont = dict(size=props["style"]["fontsize"], color=props["style"]["color"])
        self.plotly_fig["layout"][scene_key]['xaxis']["titlefont"] = titlefont

    def draw_ylabel(self, **props):
        try:
            super().draw_ylabel(**props)
        except KeyError:
            self.draw_3d_ylabel(**props)

    def draw_3d_ylabel(self, **props):
        scene_key = f'scene{self.axis_ct}'
        self.plotly_fig['layout'][scene_key]['yaxis']['title'] = props['text']
        titlefont = dict(size=props["style"]["fontsize"], color=props["style"]["color"])
        self.plotly_fig["layout"][scene_key]['yaxis']["titlefont"] = titlefont

    def draw_3d_zlabel(self, **props):
        scene_key = f'scene{props["scene_id"]}'
        self.plotly_fig['layout'][scene_key]['zaxis']['title'] = props['text']
        titlefont = dict(size=props["style"]["fontsize"], color=props["style"]["color"])
        self.plotly_fig["layout"][scene_key]['zaxis']["titlefont"] = titlefont

    @staticmethod
    def process_transfrom(transform,
                          ax=None,
                          data=None,
                          return_trans=False,
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
