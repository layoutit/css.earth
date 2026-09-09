"""Reproject pinned PIA03456 processed color; no radiometric or reference-map fill.

Requires Python 3, numpy, Pillow and rasterio. The normal body bake consumes the
checked-in GeoTIFF; this source conversion is separate from the shared preparer.
"""
from pathlib import Path
import argparse
import hashlib
import json
import math
import numpy as np
from PIL import Image
import rasterio
from rasterio.transform import from_bounds


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def pinned(root, entry):
    path = (root / entry['path']).resolve()
    if not path.is_relative_to(root.resolve()):
        raise ValueError('Source path escapes package')
    if path.stat().st_size != entry['bytes'] or sha256(path) != entry['sha256']:
        raise ValueError(f"Source pin differs: {entry['path']}")
    return path


def project(longitude, latitude, camera):
    """East-positive geographic sphere to zero-based, row-down plate centers."""
    a, b, roll = np.radians([camera['observerLatitudeDegrees'],
        camera['observerEastLongitudeDegrees'], camera['northAzimuthDegrees']])
    radius, distance = camera['radiusMeters'], camera['distanceMeters']
    focal = camera['projectedRadiusPixels'] * distance / radius
    observer = np.array([np.cos(a)*np.cos(b), np.cos(a)*np.sin(b), np.sin(a)])
    east = np.array([-np.sin(b), np.cos(b), 0])
    north = np.cross(observer, east)
    lon, lat = np.radians(longitude), np.radians(latitude)
    normal = np.array([np.cos(lat)*np.cos(lon), np.cos(lat)*np.sin(lon), np.sin(lat)*np.ones_like(lon)])
    point = normal * radius
    depth = distance - observer @ point
    e, n = east @ point, north @ point
    x = camera['centerSample'] + focal * (e*np.cos(roll)+n*np.sin(roll)) / depth
    y = camera['centerLine'] + focal * (e*np.sin(roll)-n*np.cos(roll)) / depth
    view = observer[:, None]*distance-point
    view /= np.linalg.norm(view, axis=0)
    cosine_emission = np.sum(normal*view, axis=0)
    return x, y, cosine_emission


def sample(image, x, y):
    """Bilinear bytes; each contributing source alpha must be exactly opaque."""
    ix, iy = np.floor(x).astype(int), np.floor(y).astype(int)
    u, v = x-ix, y-iy
    result = np.zeros((len(x), 3), dtype=float)
    valid = np.ones(len(x), dtype=bool)
    for dx, dy in [(0, 0), (1, 0), (0, 1), (1, 1)]:
        weight = (u if dx else 1-u)*(v if dy else 1-v)
        pixels = image[iy+dy, ix+dx]
        valid &= (weight == 0) | (pixels[:, 3] == 255)
        result += pixels[:, :3]*weight[:, None]
    return np.rint(result).astype(np.uint8), valid


def convert(recipe_path, output_directory=None):
    recipe = json.loads(recipe_path.read_text())
    root = recipe_path.parent.parent
    if recipe['schema'] != 'cssearth-callisto-processed-color@1':
        raise ValueError('Unexpected conversion recipe')
    image_path = pinned(root, recipe['input'])
    registration_path = pinned(root, recipe['registration'])
    registration = json.loads(registration_path.read_text())
    camera = registration['camera']
    if registration['status'] != 'accepted fixed camera for partial processed color':
        raise ValueError('Camera registration has not been accepted')
    image = np.array(Image.open(image_path))
    if list(image.shape) != [653, 646, 4] or image.dtype != np.uint8:
        raise ValueError('Original RGBA plate dimensions or storage changed')
    width, height = recipe['output']['width'], recipe['output']['height']
    if width != 1440 or height != 720 or recipe['maximumEmissionDegrees'] != 65:
        raise ValueError('Reviewed output grid or emission boundary changed')
    out = np.zeros((height, width, 4), dtype=np.uint8)
    longitude = (np.arange(width)+.5)*360/width
    cutoff = math.cos(math.radians(recipe['maximumEmissionDegrees']))
    for y in range(height):
        latitude = 90-(y+.5)*180/height
        x, line, cosine_emission = project(longitude, latitude, camera)
        # Retain the reviewed inner-frame guard; never extrapolate source pixels.
        supported = (cosine_emission >= cutoff) & (x >= 1) & (line >= 1) & (x < image.shape[1]-2) & (line < image.shape[0]-2)
        indices = np.flatnonzero(supported)
        rgb, opaque = sample(image, x[indices], line[indices])
        if np.any(np.all(rgb[opaque] == 0, axis=1)):
            raise ValueError('Observed all-zero pixel collides with the reserved output no-data code')
        out[y, indices[opaque], :3] = rgb[opaque]
        out[y, indices[opaque], 3] = 255
    output_root = output_directory or root
    destination = output_root / recipe['output']['path']
    destination.parent.mkdir(parents=True, exist_ok=True)
    extent = math.pi*camera['radiusMeters']
    with rasterio.open(destination, 'w', driver='GTiff', width=width, height=height,
            count=4, dtype='uint8', compress='deflate', photometric='RGB', nodata=0,
            crs=f"+proj=eqc +lat_ts=0 +lat_0=0 +lon_0=180 +R={camera['radiusMeters']} +units=m +no_defs",
            transform=from_bounds(-extent, -extent/2, extent, extent/2, width, height)) as target:
        target.write(out.transpose(2, 0, 1))
        target.colorinterp = (rasterio.enums.ColorInterp.red, rasterio.enums.ColorInterp.green,
            rasterio.enums.ColorInterp.blue, rasterio.enums.ColorInterp.alpha)
    weights = np.cos(np.radians(90-(np.arange(height)+.5)*180/height))
    report = {'schema':'cssearth-callisto-color-conversion-proof@1',
        'input':recipe['input'], 'registration':recipe['registration'],
        'recipeSha256':sha256(recipe_path), 'generatorSha256':sha256(Path(__file__)),
        'output':{'path':recipe['output']['path'], 'bytes':destination.stat().st_size,
            'sha256':sha256(destination), 'rgbaSha256':hashlib.sha256(out.tobytes()).hexdigest(),
            'width':width, 'height':height, 'referenceRadiusMeters':camera['radiusMeters'],
            'noData':0, 'validPixels':int(np.sum(out[:, :, 3] == 255)),
            'sphereCoverageFraction':float(((out[:, :, 3] > 0).sum(axis=1)*weights).sum()/(width*weights.sum()))},
        'processing':'Original display RGB, bilinear in byte space, nearest-even integer rounding; all nonzero-weight source contributors alpha=255; no brightness mask, new radiometry, map fill or holdout refit.',
        'maximumEmissionDegrees':recipe['maximumEmissionDegrees'],
        'versions':{'numpy':np.__version__, 'rasterio':rasterio.__version__, 'gdal':rasterio.__gdal_version__}}
    report_path = output_root / recipe['output']['reportPath']
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps(report['output'], indent=2))
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('recipe', nargs='?', type=Path,
        default=Path(__file__).resolve().with_name('galileo-color-conversion.json'))
    parser.add_argument('--output-directory', type=Path)
    args = parser.parse_args()
    convert(args.recipe.resolve(), args.output_directory)
