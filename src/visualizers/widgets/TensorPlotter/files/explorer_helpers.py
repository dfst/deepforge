import json

def metadata(name, data):
    info = {}
    info['name'] = name
    if type(data) is dict:
        info['entries'] = [metadata(k, v) for (k, v) in data.items()]
    else:
        info['shape'] = data.shape

    return info

def tolist(array):
    depth = len(array.shape)
    if depth == 1:
        return [float(i) for i in array]
    else:
        return [tolist(i) for i in array]

def scale_colors(array, start_color, end_color):
    array = set_range_0_to_1(array)
    red = project_to_range(array, int(start_color[0:2], 16), int(end_color[0:2], 16))
    green = project_to_range(array, int(start_color[2:4], 16), int(end_color[2:4], 16))
    blue = project_to_range(array, int(start_color[4:6], 16), int(end_color[4:6], 16))
    return [ color_string(r, g, b) for (r, g, b) in zip(red, green, blue) ]

def color_string(r, g, b):
    colors = [ hex(int(num))[2:].rjust(2, '0') for num in (r,g,b) ]
    return '#' + ''.join(colors)

def project_to_range(array, start, end):
    size = end - start
    return (array * size) + start

def set_range_0_to_1(array):
    array = array - array.min()
    array = array / array.max()
    return array

def print_points(data):
    print(json.dumps(tolist(data)))

def print_colors(data, start_color, end_color):
    colors = scale_colors(data, start_color, end_color)
    print(json.dumps(colors))

def print_metadata(name, data):
    print(json.dumps(metadata(name, data)))
