"""Offline GIS intake into the existing single-band scientific GeoTIFF recipe.

Run with a body-owned JSON plan. Dependencies: rasterio 1.4.3, pyshp 2.3.1.
A layer is either a shapefile pair or an ArcGIS REST polygon query response
(`esriJsonPath`); both become the same pyshp polygon before rasterization.
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
    return (y0, x0, hit)


def resolve_nested(grid, footprints):
    """Give each withheld pixel to the smallest unit covering it.

    A source that draws units inside a larger polygon without cutting holes for them leaves both covering the same
    pixels; drawing smaller units on top is what its authors' own rendering does. Only plans that declare
    `"nestedUnits": "inner"` use this; every other plan keeps conflicting pixels withheld."""
    order = sorted(range(len(footprints)), key=lambda i: int(footprints[i][1][2].sum()), reverse=True)
    withheld = grid == -2
    resolved = np.full(grid.shape, -1, dtype='int16')
    for i in order:  # largest first, so a smaller footprint painted later takes the shared pixels
        category, (y0, x0, hit) = footprints[i]
        window = resolved[y0:y0 + hit.shape[0], x0:x0 + hit.shape[1]]
        window[hit] = category
    grid[withheld] = resolved[withheld]


def esri_json_records(root, layer, plan):
    """Yield (attributes, shape) from an ArcGIS REST polygon query response."""
    data = json.loads((root / layer['esriJsonPath']).read_text())
    if (data.get('geometryType') != 'esriGeometryPolygon' or data.get('exceededTransferLimit')
            or data.get('spatialReference', {}).get('wkt') != plan['projectionWkt']):
        raise ValueError('ArcGIS polygon response or coordinate system changed')
    for feature in data['features']:
        parts, points = [], []
        for ring in (feature.get('geometry') or {}).get('rings', []):
            parts.append(len(points))
            points.extend((float(x), float(y)) for x, y, *_ in ring)
        shape = shapefile.Shape(shapeType=shapefile.POLYGON, points=points, parts=parts)
        if points:
            xs, ys = [p[0] for p in points], [p[1] for p in points]
            shape.bbox = [min(xs), min(ys), max(xs), max(ys)]
        yield feature['attributes'], shape


def layer_records(root, layer, plan):
    """Check the record count first, then stream one polygon at a time."""
    if 'esriJsonPath' in layer:
        records = list(esri_json_records(root, layer, plan))
        if len(records) != layer['expectedRecords']:
            raise ValueError('Source polygon count changed')
        yield from records
        return
    with shapefile.Reader(shp=str(root / layer['shapePath']),
                          dbf=str(root / layer['attributePath'])) as source:
        if len(source) != layer['expectedRecords']:
            raise ValueError('Source polygon count changed')
        for feature in source.iterShapeRecords():
            yield feature.record, feature.shape


def prepare(plan_path):
    plan = json.loads(plan_path.read_text())
    root = plan_path.parent
    for path, expected in plan.get('pins', {}).items():
        pin(root / path, expected)
    if 'projectionPath' in plan and (root / plan['projectionPath']).read_text().strip() != plan['projectionWkt']:
        raise ValueError('Source coordinate system changed')
    center = plan.get('centerLongitude', 0)
    width, height, radius = plan['width'], plan['height'], plan['radiusMeters']
    if width != height * 2 or not 32 <= width <= 4096:
        raise ValueError('Expected a bounded 2:1 scientific input grid')
    half = math.pi * radius
    # Both supported source systems use a sphere and east-positive longitude.
    # Projected meters keep their declared central meridian in the output CRS.
    # Rasterize in source coordinates without fitting.
    if f'SPHEROID[' not in plan['projectionWkt'] or f',{float(radius)},0.0]' not in plan['projectionWkt']:
        raise ValueError('Plan radius differs from the source sphere')
    if plan['coordinateUnits'] == 'degrees' and center == 0:
        transform = from_origin(-180, 90, 360 / width, 180 / height)
    elif (plan['coordinateUnits'] == 'equirectangular-meters' and
          f'parameter["central_meridian",{float(center)}]' in plan['projectionWkt'].lower()):
        transform = from_origin(-half, half / 2, 2 * half / width, half / height)
    else:
        raise ValueError('Unsupported source coordinates')
    categories = {entry['value']: i for i, entry in enumerate(plan['categories'])}
    if len(categories) != len(plan['categories']) or len(categories) > 127:
        raise ValueError('Duplicate or excessive categories')
    grid = np.full((height, width), -1, dtype='int16')
    counts = {}
    # Some authors distribute one shapefile per mapped unit. Keep those
    # original layers and apply the same overlap rule across the entire set.
    # A plan may declare that its source draws some units inside a larger polygon without cutting a hole for them
    # (`"nestedUnits": "inner"`). Only then are footprints kept so a withheld pixel can go to the inner unit.
    nested = plan.get('nestedUnits') == 'inner'
    if plan.get('nestedUnits') not in (None, 'inner'):
        raise ValueError('nestedUnits must be "inner" when present')
    footprints = []
    for layer in plan.get('layers', [plan]):
        with rasterio.Env(GDAL_CACHEMAX=32 * 1024 * 1024, GDAL_NUM_THREADS='1'):
            for record, shape in layer_records(root, layer, plan):
                value = record[plan['field']]
                if value not in categories and value not in plan['unknownValues']:
                    raise ValueError(f'Unmapped source category: {value}')
                counts[value] = counts.get(value, 0) + 1
                if not shape.points:
                    continue
                category = categories.get(value, -2)
                footprint = paint_polygon(grid, shape.__geo_interface__, shape.bbox, transform, category)
                if nested and footprint is not None:
                    footprints.append((category, footprint))
    if nested:
        resolve_nested(grid, footprints)
    conflict_pixels = int((grid == -2).sum())
    grid[grid < 0] = -32768
    output_transform = from_origin(-half, half / 2, 2 * half / width, half / height)
    output = root / plan['output']
    with rasterio.open(output, 'w', driver='GTiff', width=width, height=height,
                       count=1, dtype='int16', nodata=-32768, compress='deflate',
                       predictor=2, crs=f'+proj=eqc +R={radius} +lat_ts=0 +lon_0={center} +units=m +no_defs',
                       transform=output_transform) as target:
        target.write(grid, 1)
    receipt = dict(sourceRecords=counts, width=width, height=height,
                   unknownOrConflictingPixels=conflict_pixels,
                   missingPixels=int((grid == -32768).sum()),
                   categories=plan['categories'], output=plan['output'],
                   sha256=hashlib.sha256(output.read_bytes()).hexdigest(),
                   transform=list(output_transform)[:6], radiusMeters=radius,
                   policy='Pixel-center polygon inclusion; holes preserved; unknown or conflicting units withheld' + ('; the smallest unit covering a withheld pixel takes it (nestedUnits inner)' if nested else '') + '; source edges clipped by global raster extent.')
    if center:
        receipt['centerLongitude'] = center
    (root / plan['receipt']).write_text(json.dumps(receipt, indent=2) + '\n')
    print(json.dumps({key: value for key, value in receipt.items() if key != 'categories'}))


if __name__ == '__main__':
    prepare(pathlib.Path(sys.argv[1]).resolve())
