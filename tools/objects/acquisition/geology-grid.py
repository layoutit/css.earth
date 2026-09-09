"""Offline GIS intake into the existing single-band scientific GeoTIFF recipe.

Run with a body-owned JSON plan. Dependencies: rasterio 1.4.3, pyshp 2.3.1.
Stream one source polygon at a time; use pixel-center inclusion, retain holes,
and withhold conflicting units instead of selecting the last polygon drawn.
The original shapefile and its attributes remain the scientific source.
"""
import hashlib
import json
import math
import pathlib
import sys

import numpy as np
import rasterio
from rasterio.features import rasterize
from rasterio.transform import from_origin
from rasterio.windows import Window, transform as window_transform
import shapefile


def pin(path, expected):
    with path.open('rb') as stream:
        actual = hashlib.file_digest(stream, 'sha256').hexdigest()
    if actual != expected:
        raise ValueError(f'Source pin changed: {path}')


def paint_polygon(grid, geometry, bounds, transform, category):
    """Accumulate one footprint without inventing values at overlaps or holes."""
    left, bottom, right, top = bounds
    inv = ~transform
    x0, y0 = inv * (left, top)
    x1, y1 = inv * (right, bottom)
    x0, y0 = max(0, math.floor(x0)), max(0, math.floor(y0))
    x1, y1 = min(grid.shape[1], math.ceil(x1)), min(grid.shape[0], math.ceil(y1))
    if x1 <= x0 or y1 <= y0:
        return
    window = Window(x0, y0, x1 - x0, y1 - y0)
    hit = rasterize([(geometry, 1)], out_shape=(y1-y0, x1-x0),
                    transform=window_transform(window, transform), fill=0,
                    all_touched=False, dtype='uint8').astype(bool)
    target = grid[y0:y1, x0:x1]
    conflict = hit & (target != -1) & (target != category)
    target[hit & (target == -1)] = category
    target[conflict] = -2


def prepare(plan_path):
    plan = json.loads(plan_path.read_text())
    root = plan_path.parent
    for path, expected in plan['pins'].items():
        pin(root / path, expected)
    if (root / plan['projectionPath']).read_text().strip() != plan['projectionWkt']:
        raise ValueError('Source coordinate system changed')
    width, height, radius = plan['width'], plan['height'], plan['radiusMeters']
    if width != height * 2 or not 32 <= width <= 4096:
        raise ValueError('Expected a bounded 2:1 scientific input grid')
    half = math.pi * radius
    # Both supported source systems use a sphere, zero central meridian and
    # east-positive longitude. Rasterize in source coordinates without fitting.
    if plan['coordinateUnits'] == 'degrees':
        transform = from_origin(-180, 90, 360 / width, 180 / height)
    elif plan['coordinateUnits'] == 'equirectangular-meters':
        transform = from_origin(-half, half / 2, 2 * half / width, half / height)
    else:
        raise ValueError('Unsupported source coordinates')
    categories = {entry['value']: i for i, entry in enumerate(plan['categories'])}
    if len(categories) != len(plan['categories']) or len(categories) > 127:
        raise ValueError('Duplicate or excessive categories')
    grid = np.full((height, width), -1, dtype='int16')
    counts = {}
    with shapefile.Reader(shp=str(root / plan['shapePath']),
                          dbf=str(root / plan['attributePath'])) as source:
        if len(source) != plan['expectedRecords']:
            raise ValueError('Source polygon count changed')
        with rasterio.Env(GDAL_CACHEMAX=32 * 1024 * 1024, GDAL_NUM_THREADS='1'):
            for feature in source.iterShapeRecords():
                value = feature.record[plan['field']]
                if value not in categories and value not in plan['unknownValues']:
                    raise ValueError(f'Unmapped source category: {value}')
                counts[value] = counts.get(value, 0) + 1
                if not feature.shape.points:
                    continue
                category = categories.get(value, -2)
                paint_polygon(grid, feature.shape.__geo_interface__, feature.shape.bbox,
                              transform, category)
    conflict_pixels = int((grid == -2).sum())
    grid[grid < 0] = -32768
    output_transform = from_origin(-half, half / 2, 2 * half / width, half / height)
    output = root / plan['output']
    with rasterio.open(output, 'w', driver='GTiff', width=width, height=height,
                       count=1, dtype='int16', nodata=-32768, compress='deflate',
                       predictor=2, crs=f'+proj=eqc +R={radius} +lat_ts=0 +lon_0=0 +units=m +no_defs',
                       transform=output_transform) as target:
        target.write(grid, 1)
    receipt = dict(sourceRecords=counts, width=width, height=height,
                   unknownOrConflictingPixels=conflict_pixels,
                   missingPixels=int((grid == -32768).sum()),
                   categories=plan['categories'], output=plan['output'],
                   sha256=hashlib.sha256(output.read_bytes()).hexdigest(),
                   transform=list(output_transform)[:6], radiusMeters=radius,
                   policy='Pixel-center polygon inclusion; holes preserved; unknown or conflicting units withheld; source edges clipped by global raster extent.')
    (root / plan['receipt']).write_text(json.dumps(receipt, indent=2) + '\n')
    print(json.dumps({key: value for key, value in receipt.items() if key != 'categories'}))


if __name__ == '__main__':
    prepare(pathlib.Path(sys.argv[1]).resolve())
