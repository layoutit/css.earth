"""Prepare a bounded scalar grid from published TIFF values and coordinate grids.

Verify all coordinate cells against the supplied row/column coordinates. Select
the nearest observed scalar cell; never infer coordinates from image dimensions
or fill gaps by interpolation. Read input strips, not full coordinate arrays.
"""
import hashlib
import json
import math
from pathlib import Path
import sys
from contextlib import ExitStack

import numpy as np
import rasterio
from rasterio.transform import from_origin
from rasterio.windows import Window


def nearest(axis, values):
    positions = np.searchsorted(axis, values).clip(1, len(axis)-1)
    return np.where(values-axis[positions-1] <= axis[positions]-values, positions-1, positions)


def prepare(path):
    plan = json.loads(path.read_text())
    root = path.parent
    for name, pin in plan['pins'].items():
        with (root / name).open('rb') as source:
            if hashlib.file_digest(source, 'sha256').hexdigest() != pin:
                raise ValueError('Source TIFF changed: ' + name)
    with ExitStack() as stack:
        stack.enter_context(rasterio.Env(GDAL_CACHEMAX=32 * 1024 * 1024, GDAL_NUM_THREADS='1'))
        data, lat, lon = [stack.enter_context(rasterio.open(root / plan[k])) for k in ['input', 'latitude', 'longitude']]
        for source in [data, lat, lon]:
            if [source.width, source.height] != plan['sourceShape'] or source.count != 1 or source.dtypes != ('float32',):
                raise ValueError('Source TIFF layout changed')
        xs = lon.read(1, window=Window(0, 0, lon.width, 1))[0]
        ys = lat.read(1, window=Window(0, 0, 1, lat.height))[:, 0]
        if not np.all(np.diff(xs) > 0) or not np.all(np.diff(ys) < 0) or [float(xs[0]), float(xs[-1]), float(ys[0]), float(ys[-1])] != plan['coordinateBounds']:
            raise ValueError('Coordinate axes changed')
        valid_count = invalid_count = 0
        minimum, maximum = math.inf, -math.inf
        for row in range(0, data.height, 64):
            window = Window(0, row, data.width, min(64, data.height-row))
            if not np.array_equal(lon.read(1, window=window), np.broadcast_to(xs, (int(window.height), data.width))) or not np.array_equal(lat.read(1, window=window), np.broadcast_to(ys[row:row+int(window.height), None], (int(window.height), data.width))):
                raise ValueError('Coordinate grid is not separable')
            values = data.read(1, window=window)
            valid = np.isfinite(values) & (values > 0)
            valid_count += int(valid.sum()); invalid_count += int((~valid).sum())
            if valid.any():
                minimum = min(minimum, float(values[valid].min()))
                maximum = max(maximum, float(values[valid].max()))
        width, height = plan['width'], plan['height']
        if width != height*2 or width > 4096:
            raise ValueError('Expected bounded global map')
        out = np.full((height, width), -9999, dtype='float32')
        output_x = (np.arange(width)+.5)*360/width-180
        output_y = 90-(np.arange(height)+.5)*180/height
        ix = nearest(xs, output_x)
        iy = len(ys)-1-nearest(ys[::-1], output_y)
        for y, latitude in enumerate(output_y):
            if latitude > ys[0] or latitude < ys[-1]:
                continue
            source = data.read(1, window=Window(0, int(iy[y]), data.width, 1))[0][ix]
            valid = np.isfinite(source) & (source > 0)
            out[y, valid] = source[valid]
    radius = plan['radiusMeters']; half = math.pi * radius
    transform = from_origin(-half, half/2, 2*half/width, half/height)
    with rasterio.open(root / plan['output'], 'w', driver='GTiff', width=width,
                       height=height, count=1, dtype='float32', nodata=-9999,
                       compress='deflate', predictor=3, transform=transform,
                       crs=f'+proj=eqc +R={radius} +lat_ts=0 +lon_0=0 +units=m +no_defs') as target:
        target.write(out, 1)
    receipt = {'width': width, 'height': height, 'noData': -9999,
               'origin': [transform.c, transform.f], 'resolution': [transform.a, transform.e],
               'referenceRadiusMeters': radius, 'sourceValidPixels': valid_count,
               'sourceInvalidPixels': invalid_count, 'sourceMinimum': minimum, 'sourceMaximum': maximum,
               'missingPixels': int((out == -9999).sum()),
               'coordinatesVerified': 'Every latitude and longitude cell matches the published axes exactly.',
               'sampling': 'Nearest published coordinate; finite positive wavelengths only; no gap fill.',
               'output': plan['output'], 'sha256': hashlib.sha256((root / plan['output']).read_bytes()).hexdigest()}
    (root / plan['receipt']).write_text(json.dumps(receipt, indent=2)+'\n')
    print(json.dumps(receipt))


if __name__ == '__main__':
    prepare(Path(sys.argv[1]).resolve())
