"""Windowed preparation of PDS Diviner GHRM float32 mosaics.

Read at most 32 native rows at once. Validate the detached PDS4 cartography,
scan validity before sampling, and retain nearest native cells on a compact
angular grid. No interpolation, topography derivation, or runtime processing.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import xml.etree.ElementTree as ET

import numpy as np
import rasterio
from rasterio.transform import from_origin
from rasterio.windows import Window

PDS = 'http://pds.nasa.gov/pds4/pds/v1'
CART = 'http://pds.nasa.gov/pds4/cart/v1'
SHAPE = (17920, 46080)
NODATA = -32768


def digest(path):
    with Path(path).open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def validate_label(path, product):
    root = ET.parse(path).getroot()
    def value(name, ns=PDS):
        node = root.find('.//{' + ns + '}' + name)
        if node is None:
            raise ValueError('Missing PDS field ' + name)
        return node.text.strip()
    expected = {
        'logical_identifier': 'urn:nasa:pds:lro_diviner_derived1:data_derived_ghrm:' + product,
        'version_id': '1.0', 'file_name': product + '.img', 'offset': '0',
        'data_type': 'IEEE754LSBSingle', 'missing_constant': 'NaN',
        'axis_index_order': 'Last Index Fastest',
        'start_date_time': '2009-07-05T16:50:26.195Z',
        'stop_date_time': '2022-08-01T00:00:00.000Z',
    }
    for key, required in expected.items():
        if value(key) != required:
            raise ValueError('PDS identity/layout changed: ' + key)
    axes = [(axis.find('{'+PDS+'}axis_name').text,
             int(axis.find('{'+PDS+'}elements').text),
             int(axis.find('{'+PDS+'}sequence_number').text))
            for axis in root.findall('.//{'+PDS+'}Axis_Array')]
    if axes != [('Line', SHAPE[0], 1), ('Sample', SHAPE[1], 2)]:
        raise ValueError('PDS axes changed')
    numeric = {'west_bounding_coordinate': 0, 'east_bounding_coordinate': 360,
               'north_bounding_coordinate': 70, 'south_bounding_coordinate': -70,
               'longitude_of_central_meridian': 180, 'latitude_of_projection_origin': 0,
               'standard_parallel_1': 0, 'pixel_scale_x': 128, 'pixel_scale_y': 128,
               'a_axis_radius': 1737400, 'b_axis_radius': 1737400, 'c_axis_radius': 1737400,
               'upperleft_corner_x': -5458203.076346907,
               'upperleft_corner_y': 2122634.5296904636,
               'pixel_resolution_x': 236.90117518866782,
               'pixel_resolution_y': 236.90117518866782}
    for key, required in numeric.items():
        if not math.isclose(float(value(key, CART)), required, rel_tol=1e-13, abs_tol=1e-9):
            raise ValueError('PDS cartography changed: ' + key)
    for key, required in {'longitude_direction': 'Positive East', 'latitude_type': 'Planetocentric',
                          'map_projection_name': 'Equirectangular', 'spheroid_name': 'Moon_2000'}.items():
        if value(key, CART) != required:
            raise ValueError('PDS projection changed: ' + key)


def valid_values(values, quantity):
    valid = np.isfinite(values)
    if quantity == 'rock-area-fraction':
        valid &= (values >= 0) & (values <= 1)
    elif quantity == 'bolometric-temperature':
        valid &= values >= 0
    elif quantity != 'bolometric-temperature-anomaly':
        raise ValueError('Unsupported GHRM quantity')
    return valid


def source_indices(width, height):
    longitude = (np.arange(width) + .5) * 360 / width - 180
    latitude = 90 - (np.arange(height) + .5) * 180 / height
    x = np.floor((longitude % 360) * 128).astype('int64')
    y = np.floor((70 - latitude) * 128).astype('int64')
    return x, y, (latitude > -70) & (latitude < 70)


def encode(values, valid, scale, offset):
    # int16 gives exact declared quantization; never clip scientific values.
    encoded = np.full(values.shape, NODATA, dtype='<i2')
    dn = np.rint((values[valid].astype('float64') - offset) / scale)
    if np.any((dn < -32767) | (dn > 32767)):
        raise ValueError('Scientific values exceed the declared compact encoding')
    encoded[valid] = dn.astype('<i2')
    return encoded


def prepare(plan_path, source_directory=None, output_directory=None):
    plan_path = Path(plan_path)
    plan = json.loads(plan_path.read_text())
    root = Path(source_directory) if source_directory else plan_path.parent
    target_root = Path(output_directory) if output_directory else plan_path.parent
    target_root.mkdir(parents=True, exist_ok=True)
    source = root / plan['input']; label = root / plan['label']
    validate_label(label, plan['product'])
    if digest(label) != plan['labelSha256']:
        raise ValueError('Detached label pin differs')
    if source.stat().st_size != SHAPE[0] * SHAPE[1] * 4:
        raise ValueError('Original IMG byte length differs')
    width, height = plan['width'], plan['height']
    if width != height * 2 or width < 2:
        raise ValueError('Expected a 2:1 angular display grid')
    scale, offset = plan['encoding']['scale'], plan['encoding']['offset']
    xs, ys, supported = source_indices(width, height)
    native_count = finite_count = valid_count = 0
    native_area = valid_area = 0.0
    minimum, maximum = math.inf, -math.inf
    sample_histogram = np.zeros(1202, dtype='int64')
    hist_min, hist_step = plan['histogram']['minimum'], plan['histogram']['step']
    source_hash = hashlib.sha256()
    with source.open('rb') as stream:
        for start in range(0, SHAPE[0], 32):
            raw = stream.read(min(32, SHAPE[0]-start) * SHAPE[1] * 4)
            source_hash.update(raw)
            rows = np.frombuffer(raw, dtype='<f4').reshape(-1, SHAPE[1])
            finite = np.isfinite(rows)
            valid = valid_values(rows, plan['quantity'])
            native_count += rows.size; finite_count += int(finite.sum()); valid_count += int(valid.sum())
            lat_hi = np.radians(70 - np.arange(start, start+len(rows)) / 128)
            lat_lo = lat_hi - math.pi / 180 / 128
            weight = (np.sin(lat_hi) - np.sin(lat_lo)) / (2 * SHAPE[1])
            native_area += float(weight.sum() * SHAPE[1])
            valid_area += float(np.dot(weight, valid.sum(axis=1)))
            if valid.any():
                samples = rows[valid]
                minimum = min(minimum, float(samples.min())); maximum = max(maximum, float(samples.max()))
                bins = np.floor((samples.astype('float64')-hist_min)/hist_step).astype('int64') + 1
                sample_histogram += np.bincount(bins.clip(0,1201), minlength=1202)
    actual_hash = source_hash.hexdigest()
    if actual_hash != plan['sha256']:
        raise ValueError('Original IMG hash differs')
    half = math.pi * 1737400
    transform = from_origin(-half, half/2, 2*half/width, half/height)
    out_path = target_root / plan['output']
    temporary = out_path.with_suffix('.partial.tif')
    selected_valid = 0; max_error = 0.0
    # Cache only a short source window for consecutive target rows.
    with rasterio.Env(GDAL_CACHEMAX=32*1024*1024, GDAL_NUM_THREADS='1'), source.open('rb') as stream:
        with rasterio.open(temporary, 'w', driver='GTiff', width=width, height=height,
                           count=1, dtype='int16', nodata=NODATA, compress='deflate', predictor=2,
                           blockysize=16, transform=transform,
                           crs='+proj=eqc +R=1737400 +lat_ts=0 +lon_0=0 +units=m +no_defs') as target:
            for start in range(0, height, 16):
                n = min(16, height-start)
                tile = np.full((n,width), NODATA, dtype='<i2')
                for j in range(n):
                    y = start+j
                    if not supported[y]:
                        continue
                    stream.seek(int(ys[y]) * SHAPE[1] * 4)
                    row = np.frombuffer(stream.read(SHAPE[1]*4), dtype='<f4')[xs]
                    valid = valid_values(row, plan['quantity'])
                    tile[j] = encode(row, valid, scale, offset)
                    selected_valid += int(valid.sum())
                    if valid.any():
                        error = np.abs(tile[j,valid].astype('float64')*scale+offset-row[valid])
                        max_error = max(max_error, float(error.max()))
                target.write(tile, 1, window=Window(0,start,width,n))
    temporary.replace(out_path)
    anchors = []
    with source.open('rb') as stream:
        for anchor in plan['anchors']:
            lon, lat = anchor['longitude'], anchor['latitude']
            x, y = math.floor((lon % 360)*128), math.floor((70-lat)*128)
            stream.seek((y*SHAPE[1]+x)*4)
            v = float(np.frombuffer(stream.read(4), dtype='<f4')[0])
            anchors.append({**anchor, 'sourceColumn':x, 'sourceRow':y,
                            'sourceValue': v if math.isfinite(v) else None,
                            'valid': bool(valid_values(np.array([v]),plan['quantity'])[0])})
    receipt = {'product':plan['product'], 'sourceSha256':actual_hash,
               'sourceBytes':source.stat().st_size, 'sourceShape':list(SHAPE),
               'nativeCells':native_count, 'nativeFiniteCells':finite_count,
               'nativeValidCells':valid_count, 'nativeInvalidFiniteCells':finite_count-valid_count,
               'nativeAngularEnvelopeSphereFraction':native_area,
               'nativeValidSphereFraction':valid_area,
               'nativeMinimum':minimum, 'nativeMaximum':maximum,
               'histogram':{**plan['histogram'], 'counts':sample_histogram.tolist(),
                            'description':'1200 interior bins plus lower/upper overflow; native grid counts, not area weights'},
               'width':width,'height':height,'origin':[transform.c,transform.f],
               'resolution':[transform.a,transform.e], 'noData':NODATA,
               'encoding':plan['encoding'], 'maximumQuantizationError':max_error,
               'selectedValidCells':selected_valid, 'selectedMissingCells':width*height-selected_valid,
               'sampling':'Nearest native cell at output pixel center; validity before sampling; no interpolation or fill',
               'anchors':anchors,'output':plan['output'],'sha256':digest(out_path),'bytes':out_path.stat().st_size}
    (target_root / plan['receipt']).write_text(json.dumps(receipt,indent=2)+'\n')
    print(json.dumps({k:v for k,v in receipt.items() if k not in ['histogram','anchors']}),flush=True)
    return receipt


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('plan',type=Path)
    parser.add_argument('--source-directory',type=Path)
    parser.add_argument('--output-directory',type=Path)
    args = parser.parse_args()
    prepare(args.plan,args.source_directory,args.output_directory)
