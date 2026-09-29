#!/usr/bin/env python3
"""Convert pinned page-coordinate GIS polygons to a categorical moon GeoTIFF.

Preparation only. Python 3.12, fiona 1.10.1, shapely 2.1.2, numpy 2.5.3,
rasterio 1.5.1. Registration and overlap precedence belong to the source recipe.
Equal or unrelated overlapping units remain missing, including polygon holes.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import tempfile
import zipfile

import fiona
import numpy as np
import rasterio
from rasterio.features import rasterize
from rasterio.transform import from_bounds
from shapely.geometry import shape


def pinned(root, spec):
    path = (root / spec['path']).resolve()
    if not path.is_relative_to(root.resolve()):
        raise ValueError('Source path escapes body package')
    data = path.read_bytes()
    if len(data) != spec['bytes'] or hashlib.sha256(data).hexdigest() != spec['sha256']:
        raise ValueError(f'Source pin changed: {path}')
    return path


def prepare(recipe_path):
    recipe = json.loads(recipe_path.read_text())
    root = recipe_path.parent.parent
    if recipe['schema'] != 'cssearth-geologic-page-conversion@1':
        raise ValueError('Unsupported geologic conversion recipe')
    archive = pinned(root, recipe['archive'])
    support = {spec['path']: pinned(root, spec) for spec in recipe['supportingInputs']}
    registration = json.loads(pinned(root, recipe['registration']).read_text())
    matrix = np.array(registration['matrix'], dtype=float)
    translation = np.array(registration['translation'], dtype=float)
    if matrix.shape != (2, 2) or translation.shape != (2,) or not np.isfinite(matrix).all() or np.linalg.det(matrix) <= 0:
        raise ValueError('Invalid geographic-to-page registration')
    categories = recipe['categories']
    if not 2 <= len(categories) <= 24 or len({c['dataset'] for c in categories}) != len(categories):
        raise ValueError('Invalid category dictionary')
    indices = {c['dataset']: i for i, c in enumerate(categories)}
    # A partial order, not an arbitrary paint order. Unrelated overlaps stay unknown.
    dominates = np.eye(len(categories), dtype=bool)
    for precedence in recipe['precedence']:
        evidence = json.loads(support[precedence['evidence']].read_text())
        matches = [pair for pair in evidence if {pair['a'], pair['b']} == {precedence['above'], precedence['below']}]
        if len(matches) != 1 or matches[0]['winner'] != precedence['above']:
            raise ValueError('Layer precedence differs from pinned publisher-preview evidence')
        dominates[indices[precedence['above']], indices[precedence['below']]] = True
    for k in range(len(categories)):
        dominates |= dominates[:, k, None] & dominates[None, k, :]
    if np.any((dominates & dominates.T) & ~np.eye(len(categories), dtype=bool)):
        raise ValueError('Cyclic source layer precedence')
    size = recipe['pageRaster']['size']
    bounds = recipe['pageRaster']['bounds']
    page_transform = from_bounds(*bounds, size, size)
    membership = np.zeros((size, size), dtype=np.uint32)
    source_counts = {}
    with tempfile.TemporaryDirectory(prefix='cssearth-geology-') as temp:
        target = Path(temp).resolve()
        with zipfile.ZipFile(archive) as zipped:
            for member in zipped.infolist():
                if not (target / member.filename).resolve().is_relative_to(target):
                    raise ValueError('Unsafe GIS archive path')
            zipped.extractall(target)
        gdb = target / recipe['database']
        for i, category in enumerate(categories):
            with fiona.open(gdb, layer=category['dataset']) as source:
                if source.crs_wkt != recipe['archivedCrsWkt']:
                    raise ValueError('Archived page CRS changed; do not apply it as moon geography')
                geometries = [shape(feature.geometry) for feature in source if feature.geometry]
            if len(geometries) != category['expectedFeatures']:
                raise ValueError(f"Feature population changed: {category['dataset']}")
            # Source Z is not elevation. Rasterization uses only the original XY rings.
            mask = rasterize([(g, 1) for g in geometries], out_shape=(size, size), transform=page_transform).astype(bool)
            membership[mask] |= np.uint32(1 << i)
            source_counts[category['dataset']] = int(mask.sum())
    combinations, inverse = np.unique(membership, return_inverse=True)
    resolved = np.full(len(combinations), 65535, dtype=np.uint16)
    ambiguous = []
    for j, combination in enumerate(combinations):
        candidates = [i for i in range(len(categories)) if int(combination) & (1 << i)]
        winners = [i for i in candidates if all(dominates[i, other] for other in candidates)]
        if len(winners) == 1:
            resolved[j] = winners[0]
        elif len(candidates) > 1:
            ambiguous.append(int(combination))
    page = resolved[inverse].reshape(size, size)
    width, height = recipe['output']['width'], recipe['output']['height']
    result = np.full((height, width), 65535, dtype=np.uint16)
    longitude = np.radians((np.arange(width) + .5) * 360 / width)
    xmin, ymin, xmax, ymax = bounds
    # Work in row strips; no full-size floating coordinate banks are needed.
    for y in range(height):
        latitude = 90 - (y + .5) * 180 / height
        if latitude > recipe['maximumLatitude']:
            continue
        radius = math.tan(math.pi / 4 + math.radians(latitude) / 2)
        polar = np.array([radius * np.sin(longitude), radius * np.cos(longitude)])
        xy = matrix @ polar + translation[:, None]
        px = np.floor((xy[0] - xmin) / (xmax - xmin) * size).astype(int)
        py = np.floor((ymax - xy[1]) / (ymax - ymin) * size).astype(int)
        valid = (px >= 0) & (px < size) & (py >= 0) & (py < size)
        result[y, valid] = page[py[valid], px[valid]]
    radius_m = recipe['referenceRadiusMeters']
    extent = math.pi * radius_m
    output = (root / recipe['output']['path']).resolve()
    if not output.is_relative_to(root.resolve()):
        raise ValueError('Output escapes body source directory')
    output.parent.mkdir(parents=True, exist_ok=True)
    with rasterio.open(output, 'w', driver='GTiff', width=width, height=height,
                       count=1, dtype='uint16', nodata=65535, compress='deflate',
                       crs=f'+proj=eqc +lat_ts=0 +lat_0=0 +lon_0=180 +R={radius_m} +units=m +no_defs',
                       transform=from_bounds(-extent, -extent / 2, extent, extent / 2, width, height)) as dataset:
        dataset.write(result, 1)
    weights = np.cos(np.radians(90 - (np.arange(height) + .5) * 180 / height))
    report = dict(schema='cssearth-geologic-conversion-receipt@1',
                  sourceArchive=recipe['archive'], registration=recipe['registration'],
                  supportingInputs=recipe['supportingInputs'],
                  output=dict(path=recipe['output']['path'], bytes=output.stat().st_size,
                              sha256=hashlib.sha256(output.read_bytes()).hexdigest()),
                  sourcePlanarPixelCounts=source_counts, ambiguousCombinations=ambiguous,
                  missingCode=65535, validPixels=int((result != 65535).sum()),
                  sampledSphereCoverage=float(((result != 65535).sum(axis=1) * weights).sum() / (width * weights.sum())),
                  interpretation='Historical interpreted map; categorical nearest-neighbor conversion, not measured composition or newly controlled geology.')
    output.with_suffix('.receipt.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('recipe', type=Path)
    prepare(parser.parse_args().recipe.resolve())
