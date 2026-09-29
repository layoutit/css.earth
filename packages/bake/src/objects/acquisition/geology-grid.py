"""Offline GIS intake into the existing single-band scientific GeoTIFF recipe.

Run with a body-owned JSON plan. Dependencies: rasterio 1.4.3, pyshp 2.3.1.
A layer is either a shapefile pair or an ArcGIS REST polygon query response
(`esriJsonPath`); both become the same pyshp polygon before rasterization.
Stream one source polygon at a time; use pixel-center inclusion, retain holes,
and withhold conflicting units instead of selecting the last polygon drawn.
The original shapefile and its attributes remain the scientific source.

A plan may declare `outputFrame` when the source's longitudes are in another prime-meridian convention of the same
body frame (same pole, meridian moved by a whole angle). The grid is rasterized in the source's own coordinates and
the output GeoTIFF names the target central meridian, source centre plus `targetMinusSourceLongitudeDegrees`. Eastings
from the central meridian are unchanged, so no pixel moves or is resampled; only the meridian the file declares does.

A plan may instead declare `"cellPresence": "point"` or `"cellPresence": "polyline"` for an ArcGIS point or polyline
catalogue that publishes no footprint or width. A point then marks the one grid cell holding it and a polyline every
cell it crosses. The grid states presence at its own resolution; it never gives a feature a size of its own.

`"cellPresence": "circle"` is for a point catalogue that publishes each feature's angular radius (a crater catalogue):
`radiusField` names that attribute, in degrees of arc on the plan's sphere. Every cell the small circle of that radius
around the point crosses is marked, and so is the cell holding the point, so a feature smaller than a cell still marks
one. The catalogue's own radius is the size drawn; the grid adds none.
"""
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


def require_inputs(plan_path, plan):
    """Name every declared source file the plan reads that is not on disk."""
    root = plan_path.parent
    declared = [('projectionPath', plan['projectionPath'])] if 'projectionPath' in plan else []
    for index, layer in enumerate(plan.get('layers', [plan])):
        for key in ('esriJsonPath', 'shapePath', 'attributePath'):
            if key in layer:
                declared.append((f'layers[{index}].{key}' if 'layers' in plan else key, layer[key]))
    missing = [f'{field} = {name}' for field, name in declared if not (root / name).is_file()]
    if missing:
        raise ValueError(f'{plan_path}: missing geology sources: ' + ', '.join(missing))


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


def circle_paths(x, y, radius, steps):
    """The small circle of `radius` degrees of arc around (x, y) east longitude and latitude, as unwrapped polyline paths.

    Longitudes stay continuous around the circle, so a circle over the antimeridian or around a pole is one path; the
    copies shifted by 360 degrees draw the part that falls off either side of the grid."""
    lat1, lon1, d = math.radians(y), math.radians(x), math.radians(radius)
    points, previous = [], None
    for k in range(steps + 1):
        bearing = 2 * math.pi * k / steps
        lat2 = math.asin(math.sin(lat1) * math.cos(d) + math.cos(lat1) * math.sin(d) * math.cos(bearing))
        lon2 = lon1 + math.atan2(math.sin(bearing) * math.sin(d) * math.cos(lat1), math.cos(d) - math.sin(lat1) * math.sin(lat2))
        lon = math.degrees(lon2)
        if previous is not None:
            lon += 360 * round((previous - lon) / 360)
        points.append((lon, math.degrees(lat2)))
        previous = lon
    return [[(lon + shift, lat) for lon, lat in points] for shift in (-360, 0, 360)]


def paint_presence(grid, geometry, transform, category, kind, shared=-2, radius=None):
    """Mark the cell holding a point, or every cell a polyline crosses, under the same overlap rule as polygons.

    A cell two categories reach is withheld, or takes the plan's declared `sharedCellCategory` (a true statement:
    the cell holds catalogued features of more than one class)."""
    if kind in ('point', 'circle'):
        x, y = float(geometry['x']), float(geometry['y'])
        col, row = (~transform) * (x, y)
        col, row = min(grid.shape[1] - 1, math.floor(col)), min(grid.shape[0] - 1, math.floor(row))
        if not (0 <= col and 0 <= row):
            raise ValueError(f'Point outside the grid: {x}, {y}')
        hit = np.zeros(grid.shape, dtype=bool); hit[row, col] = True
        if kind == 'circle':
            if not (isinstance(radius, (int, float)) and 0 < radius < 90):
                raise ValueError(f'Circle radius must be a positive angle under 90 degrees, not {radius} at {x}, {y}')
            # Vertices at most a quarter cell apart along the circle, so all_touched follows it cell by cell.
            cell = min(abs(transform.a), abs(transform.e))
            steps = max(16, math.ceil(2 * math.pi * radius / (cell / 4)))
            lines = {'type': 'MultiLineString', 'coordinates': circle_paths(x, y, radius, steps)}
            hit |= rasterize([(lines, 1)], out_shape=grid.shape, transform=transform, fill=0,
                             all_touched=True, dtype='uint8').astype(bool)
    else:
        lines = {'type': 'MultiLineString', 'coordinates': geometry['paths']}
        hit = rasterize([(lines, 1)], out_shape=grid.shape, transform=transform, fill=0,
                        all_touched=True, dtype='uint8').astype(bool)
    conflict = hit & (grid != -1) & (grid != category)
    grid[hit & (grid == -1)] = category
    grid[conflict] = shared


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


CELL_PRESENCE = {'point': 'esriGeometryPoint', 'polyline': 'esriGeometryPolyline', 'circle': 'esriGeometryPoint'}


def esri_json_records(root, layer, plan):
    """Yield (attributes, shape) from an ArcGIS REST polygon query response."""
    data = json.loads((root / layer['esriJsonPath']).read_text())
    expected = CELL_PRESENCE.get(plan.get('cellPresence'), 'esriGeometryPolygon')
    if (data.get('geometryType') != expected or data.get('exceededTransferLimit')
            or data.get('spatialReference', {}).get('wkt') != plan['projectionWkt']):
        raise ValueError(f'ArcGIS {expected} response or coordinate system changed')
    if expected != 'esriGeometryPolygon':
        yield from ((feature['attributes'], feature.get('geometry')) for feature in data['features'])
        return
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
    if 'pins' in plan:
        raise ValueError(f'{plan_path}: the "pins" field is retired; recipes declare inputs by path')
    root = plan_path.parent
    require_inputs(plan_path, plan)
    if 'projectionPath' in plan and (root / plan['projectionPath']).read_text().strip() != plan['projectionWkt']:
        raise ValueError('Source coordinate system changed')
    center = plan.get('centerLongitude', 0)
    frame = plan.get('outputFrame')
    if frame is not None and (set(frame) != {'source', 'target', 'targetMinusSourceLongitudeDegrees', 'evidence'}
                              or not isinstance(frame['targetMinusSourceLongitudeDegrees'], (int, float))
                              or not frame['evidence']):
        raise ValueError('outputFrame needs source, target, targetMinusSourceLongitudeDegrees and evidence')
    shift = frame['targetMinusSourceLongitudeDegrees'] if frame else 0
    output_center = (center + shift + 180) % 360 - 180 if frame else center  # a plan without a frame keeps its meridian as written
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
    presence = plan.get('cellPresence')
    shared = plan.get('sharedCellCategory')
    if (plan['field'] is None or shared is not None) and not presence or plan['field'] is None and len(plan['categories']) != 1 \
            or shared is not None and shared not in categories:
        raise ValueError('A null field needs cellPresence and exactly one category; sharedCellCategory needs cellPresence and a declared category')
    shared_index = -2 if shared is None else categories[shared]
    if presence not in (None, *CELL_PRESENCE) or presence and (nested or any('esriJsonPath' not in layer for layer in plan.get('layers', [plan]))):
        raise ValueError('cellPresence must be "point", "polyline" or "circle", on ArcGIS layers (one per page), without nestedUnits')
    radius_field = plan.get('radiusField')
    if (presence == 'circle') != isinstance(radius_field, str):
        raise ValueError('radiusField names the angular radius attribute of a "circle" presence plan, and only of one')
    if plan.get('nestedUnits') not in (None, 'inner'):
        raise ValueError('nestedUnits must be "inner" when present')
    footprints = []
    for layer in plan.get('layers', [plan]):
        with rasterio.Env(GDAL_CACHEMAX=32 * 1024 * 1024, GDAL_NUM_THREADS='1'):
            for record, shape in layer_records(root, layer, plan):
                # A presence layer with one class and no class field (valley networks) names no field: every record is that class.
                value = plan['categories'][0]['value'] if plan['field'] is None else record[plan['field']]
                value = value if isinstance(value, str) else str(value)  # integer class fields (Strahler order)
                if value not in categories and value not in plan['unknownValues']:
                    raise ValueError(f'Unmapped source category: {value}')
                counts[value] = counts.get(value, 0) + 1
                if not presence and not shape.points:
                    continue
                category = categories.get(value, -2)
                if presence:
                    if shape:
                        paint_presence(grid, shape, transform, category, presence, shared_index,
                                       radius=record[radius_field] if radius_field else None)
                    continue
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
                       predictor=2, crs=f'+proj=eqc +R={radius} +lat_ts=0 +lon_0={output_center} +units=m +no_defs',
                       transform=output_transform) as target:
        target.write(grid, 1)
    receipt = dict(sourceRecords=counts, width=width, height=height,
                   unknownOrConflictingPixels=conflict_pixels,
                   missingPixels=int((grid == -32768).sum()),
                   categories=plan['categories'], output=plan['output'],
                   bytes=output.stat().st_size,
                   transform=list(output_transform)[:6], radiusMeters=radius,
                   policy=({'point': 'One cell per catalogued point; no feature size or width drawn', 'polyline': 'Every cell a catalogued polyline crosses; no feature size or width drawn',
                            'circle': 'Every cell the catalogued circle (centre and published angular radius) crosses, and the cell holding its centre'}[presence] + '; cells holding two categories withheld' if presence else 'Pixel-center polygon inclusion; holes preserved; unknown or conflicting units withheld') + ('; the smallest unit covering a withheld pixel takes it (nestedUnits inner)' if nested else '') + '; source edges clipped by global raster extent.')
    if center:
        receipt['centerLongitude'] = center
    if frame:
        receipt['outputFrame'] = dict(frame, outputCenterLongitude=output_center)
    (root / plan['receipt']).write_text(json.dumps(receipt, indent=2) + '\n')
    print(json.dumps({key: value for key, value in receipt.items() if key != 'categories'}))


if __name__ == '__main__':
    prepare(pathlib.Path(sys.argv[1]).resolve())
