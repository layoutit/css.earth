"""Convert the pinned, already measured MUSE spectral maps without smoothing.

The release FITS headers contain no WCS, target, date or unit cards. Registration
is an explicit interpretation of the author's arange-based mapping code, checked
against published observation footprints and numerical feature anchors. Absolute
subpixel registration remains unresolved; it is not recovered from the FITS.

Native rows are interpreted as -90,-88,...,88 N and columns as 0,2,...,358 E.
Only row reversal and a 90-column roll are performed. The output centers retain
these exact nodes: -180..178 E and 88..-90 N. Equirectangular center longitude -1
puts the circular seam on a pixel edge; relative projected origin is (-180,89)
degrees times R*pi/180, with 2-degree spacing. Geographic pixel-area bounds are
(-181,-91,179,89). Downstream nearest sampling must wrap relative to -1 degrees
and reject physical latitudes outside [-90,90], raster edges and missing values.

Each night remains an independent TIFF. Receipts report the result of explicit
night 1 -> 2 -> 3 first-valid fallback, as supported by scientific additionalGrids,
and the differences between overlapping nights. No averaging, recalibration,
error estimate, mineral abundance, oxygen abundance or continuum fit is derived.
"""
import hashlib
import json
import math
from pathlib import Path
import re
import sys

import numpy as np
import rasterio
from rasterio.transform import from_origin


SCHEMA = 'cssearth-muse-spectral-maps@1'
MISSING = -9999
CENTER_LONGITUDE = -1
OBSERVABLES = {
    '485nm_slope': {'target': 'io', 'quantity': 'normalized 477.5-495 nm spectral slope',
                    'unit': 'micrometer^-1', 'normalizationWavelengthNm': 495},
    '560nm_band': {'target': 'io', 'quantity': 'mean continuum-removed 520-660 nm band depth',
                   'unit': 'fraction', 'unobservedWavelengthRangeNm': [578, 605]},
    '577.3nm_band': {'target': 'ganymede', 'quantity': '565/577.3 nm reflectance ratio',
                    'unit': 'ratio', 'unobservedWavelengthRangeNm': [578, 605]},
}


def sha256(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def read_map(path):
    """Read the exact minimal primary FITS layout, using FITS big-endian doubles."""
    data = path.read_bytes()
    if len(data) != 132480:
        raise ValueError('Expected one 180 x 90 float64 FITS primary image')
    cards = {}
    for offset in range(0, 2880, 80):
        card = data[offset:offset+80].decode('ascii')
        key = card[:8].strip()
        if key == 'END':
            if data[offset+80:2880].strip(b' '):
                raise ValueError('Unexpected FITS header padding')
            break
        if not key or key in cards or card[8:10] != '= ':
            raise ValueError('Unsupported FITS header card')
        value = card[10:].split('/')[0].strip()
        cards[key] = value
    else:
        raise ValueError('Missing FITS END card')
    if cards != {'SIMPLE': 'T', 'BITPIX': '-64', 'NAXIS': '2', 'NAXIS1': '180',
                 'NAXIS2': '90', 'EXTEND': 'T'}:
        raise ValueError('FITS layout or metadata changed; reinterpret before converting')
    values = np.frombuffer(data, dtype='>f8', offset=2880, count=16200).reshape(90, 180)
    if np.isinf(values).any():
        raise ValueError('Infinite source samples are unsupported')
    finite = np.isfinite(values)
    if np.any(np.abs(values[finite]) > np.finfo('float32').max):
        raise ValueError('Valid source cannot be represented by the float32 output')
    if np.any(values[finite].astype('float32') == MISSING):
        raise ValueError('Valid source rounds to the output missing-data sentinel')
    return values, cards


def encode_native(values, edge_withhold_nodes=0):
    if values.shape != (90, 180) or type(edge_withhold_nodes) is not int or edge_withhold_nodes not in (0, 1):
        raise ValueError('Expected native grid and explicit zero/one-node edge policy')
    valid = np.isfinite(values)
    retained = valid.copy()
    if edge_withhold_nodes:
        # Optional conservative withholding uses only the source validity mask,
        # never the magnitude or darkness of a measured value. Longitude wraps.
        north = np.zeros_like(valid); north[1:] = valid[:-1]
        south = np.zeros_like(valid); south[:-1] = valid[1:]
        retained &= north & south & np.roll(valid, 1, axis=1) & np.roll(valid, -1, axis=1)
    output = np.full(values.shape, MISSING, dtype='float32')
    output[retained] = values[retained]
    return output, {'finiteNativeNodes': int(valid.sum()), 'missingNativeNodes': int((~valid).sum()),
                    'edgeNodesWithheld': int((valid & ~retained).sum()),
                    'retainedNativeNodes': int(retained.sum()),
                    'maximumFloat32Error': float(np.abs(output[retained].astype('float64') - values[retained]).max()) if retained.any() else 0}


def reorder_nodes(values):
    if values.shape != (90, 180):
        raise ValueError('Expected a native 90 x 180 node grid')
    return np.concatenate((values[::-1, 90:], values[::-1, :90]), axis=1)


def native_transform(radius):
    if not isinstance(radius, (int, float)) or not math.isfinite(radius) or radius <= 0:
        raise ValueError('A finite positive reference radius is required')
    unit = radius * math.pi / 180
    return from_origin(-180*unit, 89*unit, 2*unit, 2*unit)


def ordered_fallback(values):
    """First finite night wins; this is presentation priority, not quality ranking."""
    if not values or any(value.shape != values[0].shape for value in values):
        raise ValueError('Matching nonempty nightly maps are required')
    output = np.full(values[0].shape, np.nan, dtype='float64')
    owner = np.zeros(values[0].shape, dtype='uint8')
    for index, value in enumerate(values):
        take = np.isfinite(value) & ~np.isfinite(output)
        output[take] = value[take]; owner[take] = index+1
    return output, owner


def overlap_statistics(values, names):
    result = []
    for first in range(len(values)):
        for second in range(first+1, len(values)):
            a, b = values[first], values[second]
            valid = np.isfinite(a) & np.isfinite(b)
            record = {'first': names[first], 'second': names[second], 'overlapNodes': int(valid.sum())}
            if valid.any():
                difference = b[valid]-a[valid]
                record.update(meanSecondMinusFirst=float(difference.mean()),
                              medianAbsoluteDifference=float(np.median(np.abs(difference))),
                              p95AbsoluteDifference=float(np.percentile(np.abs(difference), 95)),
                              maximumAbsoluteDifference=float(np.abs(difference).max()))
            result.append(record)
    return result


def prepare(path):
    plan = json.loads(path.read_text()); root = path.parent
    if plan.get('schema') != SCHEMA or plan.get('target') not in ('io', 'ganymede'):
        raise ValueError('Unsupported MUSE spectral-map recipe')
    registration = plan.get('registration', {})
    if (registration.get('mode') != 'author-grid-two-degree-nodes'
            or registration.get('absoluteSubpixelRegistration') != 'unresolved'
            or not registration.get('evidence')):
        raise ValueError('Explicit source-grid evidence and unresolved subpixel registration required')
    if plan.get('overlapPolicy') != 'first-valid-night-1-2-3':
        raise ValueError('Explicit first-valid-night-1-2-3 presentation priority required')
    edge = plan.get('edgeWithholdNodes')
    if type(edge) is not int or edge not in (0, 1):
        raise ValueError('Explicit zero/one-node edge policy required')
    entries = plan['entries']; pins = plan.get('pins', {})
    if not entries or any(entry['input'] not in pins for entry in entries):
        raise ValueError('Every original source must have a SHA256 pin')
    for name, expected in pins.items():
        if not isinstance(expected, str) or not re.fullmatch('[0-9a-f]{64}', expected) or sha256(root/name) != expected:
            raise ValueError('MUSE source changed: ' + name)
    radius = plan['referenceRadiusMeters']; transform = native_transform(radius)
    output_records = []; groups = {}; seen = set()
    with rasterio.Env(GDAL_CACHEMAX=16*1024*1024, GDAL_NUM_THREADS='1'):
        for entry in entries:
            kind, night = entry['kind'], entry['night']
            if (kind not in OBSERVABLES or OBSERVABLES[kind]['target'] != plan['target']
                    or type(night) is not int or night not in (1, 2, 3)
                    or Path(entry['input']).name != f'{kind}_{plan["target"]}_night_{night}.fits'
                    or (kind, night) in seen):
                raise ValueError('Source identity must match the pinned release filename')
            seen.add((kind, night))
            values, cards = read_map(root/entry['input']); encoded, checks = encode_native(values, edge)
            groups.setdefault(kind, []).append((night, entry['input'], np.where(encoded != MISSING, values, np.nan)))
            output = root/entry['output']; output.parent.mkdir(parents=True, exist_ok=True)
            with rasterio.open(output, 'w', driver='GTiff', width=180, height=90, count=1,
                               dtype='float32', nodata=MISSING,
                               crs=f'+proj=eqc +R={radius} +lat_ts=0 +lon_0={CENTER_LONGITUDE} +units=m +no_defs',
                               transform=transform, compress='deflate', predictor=3) as target:
                target.write(reorder_nodes(encoded), 1)
            finite = np.isfinite(values)
            output_records.append({'input': entry['input'], 'sourceSha256': pins[entry['input']],
                                   'sourceBytes': (root/entry['input']).stat().st_size, 'fitsCards': cards,
                                   'kind': kind, 'night': night, 'quantity': OBSERVABLES[kind],
                                   'path': entry['output'], 'sha256': sha256(output), 'bytes': output.stat().st_size,
                                   'noData': MISSING, 'checked': checks,
                                   'finiteNativeRange': [float(values[finite].min()), float(values[finite].max())] if finite.any() else None})
    composites = {}
    for kind, records in groups.items():
        records.sort(); values = [record[2] for record in records]; names = [record[1] for record in records]
        mosaic, owner = ordered_fallback(values)
        composites[kind] = {'priority': names, 'validNodes': int(np.isfinite(mosaic).sum()),
                            'missingNodes': int(np.isnan(mosaic).sum()),
                            'selectedNodesBySource': {name: int((owner == i+1).sum()) for i, name in enumerate(names)},
                            'overlapComparisons': overlap_statistics(values, names)}
    unit = radius * math.pi / 180
    error = max(float(np.abs((transform.c + (np.arange(180)+.5)*transform.a)/unit + CENTER_LONGITUDE - np.arange(-180,180,2)).max()),
                float(np.abs((transform.f + (np.arange(90)+.5)*transform.e)/unit - np.arange(88,-91,-2)).max()))
    receipt = {'schema': SCHEMA, 'recipeSha256': sha256(path), 'preparerSha256': sha256(Path(__file__)),
               'target': plan['target'], 'registration': {**registration, 'width': 180, 'height': 90,
                  'centerLongitude': CENTER_LONGITUDE, 'referenceRadiusMeters': radius,
                  'origin': [transform.c, transform.f], 'resolution': [transform.a, transform.e],
                  'geographicPixelAreaBounds': [-181,-91,179,89],
                  'maximumNodeCoordinateErrorDegrees': error, 'sampling': 'nearest', 'wrapLongitude': True,
                  'physicalLatitudeRange': [-90,90], 'conversionResampling': False},
               'edgeWithholdNodes': edge, 'overlapPolicy': plan['overlapPolicy'],
               'composites': composites, 'outputs': output_records}
    receipt_path = root/plan['receipt']; receipt_path.parent.mkdir(parents=True, exist_ok=True)
    receipt_path.write_text(json.dumps(receipt, indent=2)+'\n')
    print(json.dumps(receipt))
    return receipt


if __name__ == '__main__':
    prepare(Path(sys.argv[1]).resolve())
