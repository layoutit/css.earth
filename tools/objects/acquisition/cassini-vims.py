"""Extract pinned Cassini VIMS mosaic planes into prepared scientific maps.

This is source preparation, not a new calibration or a compositional inversion.
The guide's one-degree angular bins are an explicit interpretation: the archive's
projected registration has a documented source-pixel ambiguity. No interpolation,
neighbor search, gap fill, spectral normalization or photometric correction is
applied here. Only six native BSQ planes are read, individually.
"""
import hashlib
import json
import math
from pathlib import Path
import re
import sys
import xml.etree.ElementTree as ET

import numpy as np
import rasterio
from rasterio.transform import from_origin


NS = {'p': 'http://pds.nasa.gov/pds4/pds/v1', 'c': 'http://pds.nasa.gov/pds4/cart/v1'}
SCHEMA = 'cssearth-cassini-vims@1'


def sha256(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def label_metadata(path):
    label = ET.parse(path).getroot()
    array = label.find('p:File_Area_Observational/p:Array_3D_Spectrum', NS)
    if array is None:
        raise ValueError('Missing PDS4 spectral array')
    axes = [(a.findtext('p:axis_name', namespaces=NS),
             int(a.findtext('p:elements', namespaces=NS)),
             int(a.findtext('p:sequence_number', namespaces=NS)))
            for a in array.findall('p:Axis_Array', NS)]
    if (axes != [('Band', 256, 1), ('Line', 180, 2), ('Sample', 360, 3)]
            or array.findtext('p:axis_index_order', namespaces=NS) != 'Last Index Fastest'
            or array.findtext('p:Element_Array/p:data_type', namespaces=NS) != 'IEEE754LSBSingle'
            or array.findtext('p:Element_Array/p:unit', namespaces=NS) != 'Reflectance'
            or float(array.findtext('p:offset', namespaces=NS)) != 0):
        raise ValueError('Unsupported VIMS native layout')
    missing = float(array.findtext('p:Special_Constants/p:missing_constant', namespaces=NS))
    target = label.findtext('p:Observation_Area/p:Target_Identification/p:name', namespaces=NS)
    if target not in ('Dione', 'Rhea') or missing != -999:
        raise ValueError('Unsupported VIMS target or special pixel')
    def cart(name):
        node = label.find('.//c:' + name, NS)
        if node is None:
            raise ValueError('Missing PDS4 cartography: ' + name)
        return node.text
    if cart('longitude_direction') != 'Positive East' or cart('latitude_type') != 'Planetocentric':
        raise ValueError('Unexpected longitude or latitude convention')
    radius = float(cart('a_axis_radius'))
    if radius != float(cart('b_axis_radius')) or radius != float(cart('c_axis_radius')):
        raise ValueError('Expected published spherical reference')
    x, y = [float(cart(k)) for k in ('upperleft_corner_x', 'upperleft_corner_y')]
    dx, dy = [float(cart(k)) for k in ('pixel_resolution_x', 'pixel_resolution_y')]
    center = float(cart('longitude_of_central_meridian'))
    degrees = 180 / (math.pi * radius)
    return {'target': target.lower(), 'width': 360, 'height': 180, 'bands': 256,
            'fileName': label.findtext('p:File_Area_Observational/p:File/p:file_name', namespaces=NS),
            'fileBytes': int(label.findtext('p:File_Area_Observational/p:File/p:file_size', namespaces=NS)),
            'noData': missing, 'radiusMeters': radius,
            'publishedOriginMeters': [x, y], 'publishedResolutionMeters': [dx, dy],
            'publishedLiteralCornerBoundsDegrees': [center+x*degrees, center+(x+360*dx)*degrees,
                                                    y*degrees, (y-180*dy)*degrees],
            'publishedDegreesPerPixel': [dx*degrees, dy*degrees]}


def read_planes(path, bands, width=360, height=180, count=256):
    """Read each requested native plane without loading the whole cube."""
    if path.stat().st_size != width * height * count * 4:
        raise ValueError('Unexpected BSQ source length')
    if len(set(bands)) != len(bands) or any(type(b) is not int or not 1 <= b <= count for b in bands):
        raise ValueError('Invalid one-based band selection')
    result = {}
    with path.open('rb') as stream:
        for band in bands:
            stream.seek((band-1)*width*height*4)
            data = stream.read(width*height*4)
            if len(data) != width*height*4:
                raise ValueError('Truncated BSQ plane')
            result[band] = np.frombuffer(data, dtype='<f4').reshape(height, width).copy()
    return result


def valid_samples(values, missing):
    return np.isfinite(values) & (values != missing)


def encode_rgb(values, ranges, missing):
    values = np.asarray(values, dtype='float64')
    if values.shape[0] != 3 or len(ranges) != 3:
        raise ValueError('Expected three RGB channels')
    valid = valid_samples(values, missing).all(axis=0)
    result = np.zeros(values.shape, dtype='uint8')
    for channel, (low, high) in enumerate(ranges):
        if not math.isfinite(low) or not math.isfinite(high) or low >= high:
            raise ValueError('Invalid fixed display range')
        scaled = np.clip((np.where(valid, values[channel], low)-low)/(high-low), 0, 1)
        # Zero is exclusively the derived missing-data code. Finite calibrated
        # zero and negative noise remain observed, clipping at the low endpoint.
        result[channel] = np.where(valid, np.floor(1+254*scaled+.5), 0).astype('uint8')
    return result, valid


def band_depth(left, center, right, wavelengths, missing):
    a, b, c = np.asarray([left, center, right], dtype='float64')
    lo, middle, hi = wavelengths
    if not all(math.isfinite(w) for w in wavelengths) or not lo < middle < hi:
        raise ValueError('Invalid continuum wavelengths')
    weight = (middle-lo)/(hi-lo)
    valid = valid_samples(np.asarray([a, b, c]), missing).all(axis=0)
    continuum = a*(1-weight)+c*weight
    valid &= np.isfinite(continuum) & (continuum > 0)
    result = np.full(a.shape, -9999, dtype='float32')
    derived = np.full(a.shape, np.nan, dtype='float64')
    derived[valid] = 1-b[valid]/continuum[valid]
    valid &= np.isfinite(derived) & (np.abs(derived) <= np.finfo('float32').max)
    result[valid] = derived[valid]
    return result, valid, weight


def guide_grid_sample(values, width, height):
    """Readdress exact 1-degree native cells into a canonical -180..180 map.

    Explicit global bins have east-positive longitude centers .5..359.5 and
    north-to-south latitude centers 89.5..-89.5. No source neighborhood is read.
    """
    if values.shape[-2:] != (180, 360):
        raise ValueError('Expected native one-degree grid')
    if type(width) is not int or type(height) is not int or width != 2*height or not 0 < width <= 2048:
        raise ValueError('Expected bounded canonical 2:1 grid')
    longitude = (np.arange(width)+.5)*360/width-180
    latitude = 90-(np.arange(height)+.5)*180/height
    cols = np.floor(np.mod(longitude, 360)).astype('int64')
    rows = np.floor(90-latitude).astype('int64')
    return values[..., rows[:, None], cols[None, :]]


def statistics(values, valid):
    result = {'validPixels': int(valid.sum()), 'missingPixels': int((~valid).sum())}
    if valid.any():
        result['minimum'] = float(values[valid].min())
        result['maximum'] = float(values[valid].max())
        result['percentiles'] = dict(zip(['1', '5', '50', '95', '99'],
                                        np.percentile(values[valid], [1, 5, 50, 95, 99]).tolist()))
    return result


def prepare(path):
    plan = json.loads(path.read_text()); root = path.parent
    if plan.get('schema') != SCHEMA:
        raise ValueError('Unsupported Cassini VIMS recipe')
    registration = plan.get('registration', {})
    if (registration.get('mode') != 'guide-global-one-degree-bins'
            or registration.get('absoluteSubpixelRegistration') != 'unresolved'
            or not registration.get('evidence')):
        raise ValueError('Explicit guide-grid interpretation and unresolved subpixel registration required')
    required = [plan[k] for k in ('input', 'label', 'header', 'wavelengths', 'guide')]
    if not all(name in plan['pins'] for name in required):
        raise ValueError('Every original source and interpretation document must be pinned')
    for name, expected in plan['pins'].items():
        if sha256(root/name) != expected:
            raise ValueError('VIMS source changed: ' + name)
    metadata = label_metadata(root/plan['label'])
    if metadata['target'] != plan['target'] or Path(plan['input']).name != metadata['fileName']:
        raise ValueError('VIMS target or file identity mismatch')
    wavelengths = np.loadtxt(root/plan['wavelengths'])
    header = (root/plan['header']).read_text()
    header_wavelengths = np.fromstring(re.search(r'wavelength\s*=\s*\{([^}]+)\}', header, re.S)[1], sep=',')
    if wavelengths.shape != (256,) or not np.array_equal(wavelengths, header_wavelengths):
        raise ValueError('Archive wavelength table/header mismatch')
    rgb_bands = plan['rgb']['bands']; depth_bands = plan['depth']['bands']
    if rgb_bands != [69, 43, 12] or depth_bands != [58, 70, 81]:
        raise ValueError('Expected archive RGB and documented 2.02-micrometer depth bands')
    for spec in (plan['rgb'], plan['depth']):
        if not np.array_equal(wavelengths[np.asarray(spec['bands'])-1], spec['wavelengthMicrometers']):
            raise ValueError('Spectral correspondence changed')
    planes = read_planes(root/plan['input'], sorted(set(rgb_bands+depth_bands)))
    rgb, rgb_valid = encode_rgb([planes[b] for b in rgb_bands], plan['rgb']['displayRanges'], metadata['noData'])
    depth, depth_valid, weight = band_depth(*[planes[b] for b in depth_bands],
                                          plan['depth']['wavelengthMicrometers'], metadata['noData'])
    width, height = plan['width'], plan['height']
    maps = [('rgb', guide_grid_sample(rgb, width, height), 0, 'uint8', 2),
            ('depth', guide_grid_sample(depth, width, height)[None, :, :], -9999, 'float32', 3)]
    radius = metadata['radiusMeters']; half = math.pi*radius
    transform = from_origin(-half, half/2, 2*half/width, half/height)
    outputs = []
    with rasterio.Env(GDAL_CACHEMAX=32*1024*1024, GDAL_NUM_THREADS='1'):
        for kind, pixels, missing, dtype, predictor in maps:
            output = root/plan[kind]['output']; output.parent.mkdir(parents=True, exist_ok=True)
            options = {'photometric': 'RGB'} if kind == 'rgb' else {}
            with rasterio.open(output, 'w', driver='GTiff', width=width, height=height,
                               count=pixels.shape[0], dtype=dtype, nodata=missing,
                               crs=f'+proj=eqc +R={radius} +lat_ts=0 +lon_0=0 +units=m +no_defs',
                               transform=transform, compress='deflate', predictor=predictor, **options) as target:
                target.write(pixels)
            outputs.append({'kind': kind, 'output': plan[kind]['output'], 'sha256': sha256(output),
                            'bytes': output.stat().st_size, 'noData': missing,
                            'missingPixels': int((pixels[0] == missing).sum())})
    receipt = {'schema': SCHEMA, 'recipeSha256': sha256(path), 'preparerSha256': sha256(Path(__file__)),
               'source': metadata, 'registration': registration, 'width': width, 'height': height,
               'origin': [transform.c, transform.f], 'resolution': [transform.a, transform.e],
               'referenceRadiusMeters': radius, 'rgb': plan['rgb'], 'depth': plan['depth'],
               'continuumRightWeight': weight, 'rgbValidNativePixels': int(rgb_valid.sum()),
               'depthNativeStatistics': statistics(depth, depth_valid),
               'nativeBandStatistics': {str(b): statistics(v, valid_samples(v, metadata['noData']))
                                        for b, v in planes.items()}, 'outputs': outputs}
    (root/plan['receipt']).write_text(json.dumps(receipt, indent=2)+'\n')
    print(json.dumps(receipt))
    return receipt


if __name__ == '__main__':
    prepare(Path(sys.argv[1]).resolve())
