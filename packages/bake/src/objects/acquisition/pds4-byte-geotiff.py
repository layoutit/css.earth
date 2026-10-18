"""Lossless offline wrapping of declared PDS4 byte maps for the GeoTIFF reader.

The output retains DN values and missing constants. The scientific dataset applies
the explicitly recorded physical scale; no enhancement or resampling occurs.
"""
import json
from pathlib import Path
import sys
import xml.etree.ElementTree as ET

import numpy as np
import rasterio
from rasterio.transform import from_origin


def prepare(path):
    plan = json.loads(path.read_text())
    if 'pins' in plan:
        raise ValueError(f'{path}: the "pins" field is retired; recipes declare inputs by path')
    root = path.parent
    missing = [f'{k} = {plan[k]}' for k in ('label', 'input') if not (root / plan[k]).is_file()]
    if missing:
        raise ValueError(f'{path}: missing PDS sources: ' + ', '.join(missing))
    label = (root / plan['label']).read_text()
    if '<!DOCTYPE' in label or '<!ENTITY' in label:
        raise ValueError('Unsupported XML')
    tree = ET.fromstring(label)

    def field(element, name):
        found = element.findall('.//{*}' + name)
        if len(found) != 1:
            raise ValueError('Missing or ambiguous PDS field: ' + name)
        return found[0]

    for name, expected in plan['fields'].items():
        value = field(tree, name)
        actual = value.text.strip()
        if isinstance(expected, dict):
            if value.attrib.get('unit') != expected['unit'] or float(actual) != expected['value']:
                raise ValueError('PDS quantity changed: ' + name)
        elif actual != expected:
            raise ValueError('PDS field changed: ' + name)
    # A migrated PDS3 map is an Array_2D_Image; its cartography still sits in the label's Cartography area.
    arrays = tree.findall('.//{*}Array_2D_Map') + tree.findall('.//{*}Array_2D_Image')
    if len(arrays) != 1:
        raise ValueError('Missing or ambiguous PDS field: Array_2D_Map or Array_2D_Image')
    array = arrays[0]
    identity = field(tree, 'Identification_Area')
    lidvid = field(identity, 'logical_identifier').text.strip() + '::' + identity.find('{*}version_id').text.strip()
    if lidvid != plan['lidvid']:
        raise ValueError('PDS identity changed')
    axes = array.findall('{*}Axis_Array')
    if len(axes) != 2:
        raise ValueError('Expected two map axes')
    sizes = []
    for i, axis in enumerate(axes):
        if field(axis, 'axis_name').text != ['Line', 'Sample'][i] or int(field(axis, 'sequence_number').text) != i + 1:
            raise ValueError('PDS map axis order changed')
        sizes.append(int(field(axis, 'elements').text))
    height, width = sizes
    data = np.fromfile(root / plan['input'], dtype='uint8')
    if data.size != width * height or sizes != plan['shape']:
        raise ValueError('PDS raster dimensions changed')
    scale = float(field(array, 'scaling_factor').text)
    if scale != plan['scale']:
        raise ValueError('PDS physical scale changed')
    # Older cartography labels name the sphere's radius a_axis_radius, newer ones semi_major_radius; either carries its unit.
    named = tree.findall('.//{*}a_axis_radius') or tree.findall('.//{*}semi_major_radius')
    if len(named) != 1 or named[0].attrib.get('unit') not in ('m', 'km'):
        raise ValueError('Missing or ambiguous PDS field: a_axis_radius or semi_major_radius')
    radius = float(named[0].text) * (1000 if named[0].attrib['unit'] == 'km' else 1)
    dx = float(field(tree, 'pixel_resolution_x').text)
    x = float(field(tree, 'upperleft_corner_x').text)
    y = float(field(tree, 'upperleft_corner_y').text)
    missing = int(field(array, 'missing_constant').text)
    with rasterio.open(root / plan['output'], 'w', driver='GTiff', width=width,
                       height=height, count=1, dtype='uint8', nodata=missing,
                       compress='deflate', transform=from_origin(x, y, dx, dx),
                       crs=f'+proj=eqc +R={radius} +lat_ts=0 +lon_0=0 +units=m +no_defs') as out:
        out.write(data.reshape(height, width), 1)
    valid = data[data != missing]
    receipt = {'lidvid': lidvid, 'width': width, 'height': height, 'noData': missing,
               'origin': [x, y], 'resolution': [dx, -dx], 'referenceRadiusMeters': radius,
               'scale': scale, 'validPixels': int(valid.size), 'missingPixels': int(data.size-valid.size),
               'minimum': float(valid.min()) * scale, 'maximum': float(valid.max()) * scale,
               'output': plan['output'], 'bytes': (root / plan['output']).stat().st_size}
    (root / plan['receipt']).write_text(json.dumps(receipt, indent=2) + '\n')
    print(json.dumps(receipt))


if __name__ == '__main__':
    prepare(Path(sys.argv[1]).resolve())
