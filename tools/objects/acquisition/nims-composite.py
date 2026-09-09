"""Prepare the archive guide's RGB display from registered NIMS I/F cubes.

The pinned GeoTIFF CRS/affine are the registered grid, not the old COC backplane
coordinates or rounded PDS label tie points. Explicit inverse-coordinate lookup retains
source samples and missing values. Earlier observations have explicit priority;
there is no blending, gap fill, per-frame equalization or mineral inference.
"""
import hashlib
import json
import math
from pathlib import Path
import sys

import numpy as np
import rasterio
from rasterio.transform import from_origin
from pyproj import CRS, Transformer


def display(values, ranges):
    valid = np.isfinite(values).all(axis=0) & (np.abs(values) < 1e30).all(axis=0)
    rgb = np.zeros(values.shape, dtype='uint8')
    for channel, (low, high) in enumerate(ranges):
        if not low < high:
            raise ValueError('Invalid fixed I/F display range')
        scaled = np.clip((np.where(valid, values[channel], low)-low)/(high-low), 0, 1)
        # Code zero belongs solely to missing data; negative calibrated noise
        # stays valid and clips to the low display endpoint, like high outliers.
        rgb[channel] = np.where(valid, np.floor(1+254*scaled+.5), 0).astype('uint8')
    return rgb, valid


def project_native_cells(values, source_crs, source_transform, width, height):
    """Explicit inverse coordinates and native-cell lookup, in 32-row strips.

    A warp resampler can extend a nearby valid cell at the limb. Compute each
    geographic output center independently and take precisely its native cell;
    out-of-domain, out-of-bounds and missing cells never search for neighbors.
    """
    native_crs = CRS.from_user_input(source_crs)
    projection = Transformer.from_crs(native_crs.geodetic_crs, native_crs, always_xy=True)
    inverse = ~source_transform
    result = np.full((3, height, width), np.nan, dtype='float32')
    for first in range(0, height, 32):
        rows, cols = np.meshgrid(np.arange(first, min(height, first+32))+.5,
                                 np.arange(width)+.5, indexing='ij')
        longitude = cols*360/width-180
        latitude = 90-rows*180/height
        x, y = projection.transform(longitude, latitude, errcheck=False)
        finite = np.isfinite(x) & np.isfinite(y)
        x = np.where(finite, x, 0); y = np.where(finite, y, 0)
        col = np.floor(inverse.a*x + inverse.b*y + inverse.c).astype('int64')
        row = np.floor(inverse.d*x + inverse.e*y + inverse.f).astype('int64')
        valid = finite & (col >= 0) & (col < values.shape[2]) & (row >= 0) & (row < values.shape[1])
        strip = result[:, first:first+rows.shape[0]]
        strip[:, valid] = values[:, row[valid], col[valid]]
    return result


def prepare(path):
    plan = json.loads(path.read_text()); root = path.parent
    if plan['schema'] != 'cssearth-nims-composite@1':
        raise ValueError('Unsupported NIMS plan')
    for name, expected in plan['pins'].items():
        with (root/name).open('rb') as stream:
            if hashlib.file_digest(stream, 'sha256').hexdigest() != expected:
                raise ValueError('NIMS source changed: '+name)
    width, height = plan['width'], plan['height']
    if width != height*2 or width > 2048:
        raise ValueError('Expected bounded 2:1 grid')
    radius = plan['radiusMeters']; half = math.pi*radius
    transform = from_origin(-half, half/2, 2*half/width, half/height)
    # The canonical map has linear angular rows on a spherical EQC grid.
    # Native projection uses the source ellipsoid and its geographic latitudes
    # directly; no geocentric/geodetic reinterpretation or datum transformation.
    target_crs = f"+proj=eqc +R={radius} +lat_ts=0 +lon_0=0 +units=m +no_defs"
    rgb = np.zeros((3,height,width), dtype='uint8'); owners = np.zeros((height,width),dtype='uint8')
    reports = []
    with rasterio.Env(GDAL_CACHEMAX=32*1024*1024, GDAL_NUM_THREADS='1'):
        for index, observation in enumerate(plan['observations']):
            wavelengths = np.loadtxt(root/observation['wavelengths'])
            bands = observation['bands']
            if len(bands)!=3 or len({b%2 for b in bands})!=1 or not np.array_equal(wavelengths[np.array(bands)-1], observation['wavelengthMicrometers']):
                raise ValueError('Spectral correspondence changed')
            with rasterio.open(root/observation['path']) as source:
                if [source.width,source.height,source.count] != observation['shape'] or source.crs.to_wkt()!=observation['crsWkt'] or list(source.transform) != observation['transform'] or source.nodata != observation['noData'] or source.dtypes != ('float32',)*source.count:
                    raise ValueError('Registered grid changed')
                values = source.read(bands)
                _, valid = display(values,plan['displayRanges'])
                values[:,~valid] = np.nan
                projected = project_native_cells(values, source.crs, source.transform, width, height)
                colors, available = display(projected,plan['displayRanges'])
                selected = available & (owners==0)
                rgb[:,selected] = colors[:,selected];owners[selected] = index+1
                reports.append({'path':observation['path'],'bands':bands,'wavelengthMicrometers':observation['wavelengthMicrometers'],
                                'sourceValidPixels':int(valid.sum()),'sourcePixels':source.width*source.height,
                                'mappedPixels':int(available.sum()),'contributedPixels':int(selected.sum())})
    target = root/plan['output']
    with rasterio.open(target,'w',driver='GTiff',width=width,height=height,count=3,dtype='uint8',nodata=0,
                       crs=target_crs,transform=transform,compress='deflate',predictor=2,photometric='RGB') as output:
        output.write(rgb)
    receipt={'width':width,'height':height,'referenceRadiusMeters':radius,'origin':[transform.c,transform.f],
             'resolution':[transform.a,transform.e],'noData':0,'missingPixels':int((owners==0).sum()),
             'displayRanges':plan['displayRanges'],'observations':reports,'output':plan['output'],
             'sha256':hashlib.sha256(target.read_bytes()).hexdigest()}
    (root/plan['receipt']).write_text(json.dumps(receipt,indent=2)+'\n')
    print(json.dumps(receipt))


if __name__=='__main__':
    prepare(Path(sys.argv[1]).resolve())
