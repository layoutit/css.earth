"""Prepare partial Enceladus spectral maps from pinned Nantes VIMS C/N pairs.

This is a fixed-channel observation index, not the Robidel global mosaic or a
composition inversion. Only six small RC19 calibrated observations are used.
Native navigation centers bound interior spherical cells; no spectrum is
spatially interpolated, and unsupported detector cells remain missing. Local
withheld navigation centers qualify approximate transfer, not absolute pointing.
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


SCHEMA = 'cssearth-enceladus-vims-spectral@1'
MISSING = -9999.0
VALID_MIN = np.array([0xff7ffffa], dtype='uint32').view('float32')[0]
SELECTED_IDS = ('1487299582_1', '1489049741_1', '1702362997_1',
                '1702361128_1', '1500061929_1', '1500061170_1')
NAV_NAMES = ['Phase Angle', 'Emission Angle', 'Incidence Angle',
             'Latitude', 'Longitude', 'Pixel Resolution']


def digest(path):
    with Path(path).open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def field(label, name):
    match = re.search(r'^\s*' + re.escape(name) + r'\s*=\s*([^\n]+)', label, re.M)
    if not match:
        raise ValueError('Missing ISIS field: ' + name)
    return match[1].strip().strip('"')


def sequence(label, name):
    match = re.search(r'\b' + name + r'\s*=\s*\((.*?)\)', label, re.S)
    if not match:
        raise ValueError('Missing ISIS sequence: ' + name)
    return [part.strip().strip('"') for part in match[1].split(',')]


def read_cube(path, bands, expected_bands):
    """Fail closed on these one-tile-per-band ISIS Real cubes; read few planes."""
    path = Path(path)
    with path.open('rb') as stream:
        label = stream.read(65536).decode('ascii', errors='strict').rstrip('\x00')
        core = label[:label.index('Group = Instrument')]
        width, height = int(field(core, 'Samples')), int(field(core, 'Lines'))
        start = int(field(core, 'StartByte')) - 1
        if (field(core, 'Format') != 'Tile' or field(core, 'Type') != 'Real'
                or field(core, 'ByteOrder') != 'Lsb' or start != 65536
                or int(field(core, 'Bands')) != expected_bands
                or int(field(core, 'TileSamples')) != width
                or int(field(core, 'TileLines')) != height
                or float(field(core, 'Base')) != 0
                or float(field(core, 'Multiplier')) != 1
                or not (1 <= width <= 64 and 1 <= height <= 64)
                or field(label, 'TargetName') != 'ENCELADUS'
                or field(label, 'Channel') != 'IR'):
            raise ValueError('Unsupported native Enceladus ISIS layout')
        if len(set(bands)) != len(bands) or any(not 1 <= b <= expected_bands for b in bands):
            raise ValueError('Invalid band selection')
        planes = {}
        for band in bands:
            stream.seek(start + (band-1)*width*height*4)
            data = stream.read(width*height*4)
            if len(data) != width*height*4:
                raise ValueError('Truncated ISIS plane')
            planes[band] = np.frombuffer(data, dtype='<f4').reshape(height, width).copy()
        stream.seek(0)
        history = stream.read().decode('latin1')
    if 'CalibrationVersion        = RC19' not in history:
        raise ValueError('Expected source-owned RC19 calibration history')
    return label, planes


def valid(values):
    return np.isfinite(values) & (values >= VALID_MIN)


def spectral_indices(planes, wavelengths):
    """Native channel metrics. Valid zero/negative noise is not a gap code."""
    left, bottom, right = [np.asarray(planes[b], dtype='float64') for b in (58, 70, 81)]
    lo, mid, hi = [float(wavelengths[b-1]) for b in (58, 70, 81)]
    if not 1.80 < lo < 1.85 < mid < 2.05 < hi < 2.23:
        raise ValueError('Unexpected native 2-micrometer channels')
    t = (mid-lo)/(hi-lo)
    continuum = left*(1-t) + right*t
    ok_depth = valid(left) & valid(bottom) & valid(right) & np.isfinite(continuum) & (continuum > 0)
    depth = np.full(left.shape, MISSING, dtype='float32')
    depth[ok_depth] = (1-bottom[ok_depth]/continuum[ok_depth]).astype('float32')
    ok_depth &= np.isfinite(depth) & (depth != MISSING)
    depth[~ok_depth] = MISSING
    peak = np.asarray([planes[b] for b in (134, 135, 136)], dtype='float64')
    denominator = np.asarray(planes[48], dtype='float64')
    if not 1.64 < wavelengths[47] < 1.68 or not 3.06 < wavelengths[133] < wavelengths[135] < 3.14:
        raise ValueError('Unexpected native Fresnel/1.66-micrometer channels')
    ok_ratio = valid(peak).all(axis=0) & valid(denominator) & (denominator > 0)
    ratio = np.full(left.shape, MISSING, dtype='float32')
    ratio[ok_ratio] = (np.median(peak, axis=0)[ok_ratio]/denominator[ok_ratio]).astype('float32')
    ok_ratio &= np.isfinite(ratio) & (ratio != MISSING)
    ratio[~ok_ratio] = MISSING
    return {'depth': (depth, ok_depth), 'ratio': (ratio, ok_ratio)}, t


def directions(latitude, longitude):
    lat, lon = np.broadcast_arrays(np.radians(latitude), np.radians(longitude))
    return np.stack((np.cos(lat)*np.cos(lon), np.cos(lat)*np.sin(lon), np.sin(lat)), axis=-1)


def normalize(vector):
    norm = np.linalg.norm(vector, axis=-1, keepdims=True)
    return vector/np.maximum(norm, np.finfo('float64').tiny)


def navigation_holdouts(xyz, geometry_ok, tolerance):
    """Withhold each center from its four diagonal-neighbor location estimate.

    The local source sample/line Jacobian uses four other axis neighbors. No
    held-out center helps construct its prediction. This deliberately measures
    a two-source-pixel span, more conservative than adjacent-center transfer.
    A center without an independent estimate is not eligible for map cells.
    """
    height, width = geometry_ok.shape
    errors = np.full((height, width), np.inf, dtype='float64')
    for y in range(1, height-1):
        for x in range(1, width-1):
            if not geometry_ok[y-1:y+2, x-1:x+2].all():
                continue
            predicted = normalize((xyz[y-1, x-1]+xyz[y-1, x+1]+xyz[y+1, x-1]+xyz[y+1, x+1])/4)
            dx, dy = (xyz[y, x+1]-xyz[y, x-1])/2, (xyz[y+1, x]-xyz[y-1, x])/2
            jacobian = np.stack((dx, dy), axis=-1)
            if np.linalg.cond(jacobian) > 100:
                continue
            offset, _, rank, _ = np.linalg.lstsq(jacobian, predicted-xyz[y, x], rcond=None)
            if rank == 2:
                errors[y, x] = float(np.linalg.norm(offset))
    return errors, geometry_ok & (errors <= tolerance)


def triangle_contains(query, vertices):
    """Intersection of three oriented great-circle half-spaces (small triangle)."""
    edges = np.cross(vertices, np.roll(vertices, -1, axis=0))
    center = vertices.sum(axis=0)
    signs = np.sign(edges @ center)
    if np.any(signs == 0) or np.any(np.linalg.norm(edges, axis=1) < 1e-12):
        return np.zeros(query.shape[:-1], dtype=bool)
    return ((query @ edges.T)*signs >= -1e-14).all(axis=-1)


def project(observations, kind, width, height):
    """Transfer exact native values inside supported neighboring center cells.

    One scalar owner per output pixel, selected by native resolution, then
    emission angle, fixed recipe observation order and cell order. No spectral values are
    spatially averaged. A missing vertex invalidates its entire native cell.
    """
    lon = (np.arange(width)+.5)*360/width-180
    lat = 90-(np.arange(height)+.5)*180/height
    xyz = directions(lat[:, None], lon[None, :])
    result = np.full((height, width), MISSING, dtype='float32')
    score = np.full((height, width), np.inf)
    emission = np.full((height, width), np.inf)
    owner = np.zeros((height, width), dtype='uint16')
    source_pixel = np.zeros((height, width), dtype='uint16')
    accepted_cells = {}
    for number, obs in enumerate(observations, 1):
        values, ok = obs['indices'][kind]
        ok = ok & obs['eligible']
        sh, sw = ok.shape
        accepted = 0
        for y in range(sh-1):
            for x in range(sw-1):
                pos = [(y, x), (y, x+1), (y+1, x+1), (y+1, x)]
                if not all(ok[p] for p in pos):
                    continue
                verts = np.array([obs['xyz'][p] for p in pos])
                center = normalize(verts.sum(axis=0))
                # Reject folded, very wide or nonconvex source-center cells.
                edges = np.cross(verts, np.roll(verts, -1, axis=0))
                signs = edges @ center
                if not (np.all(signs > 1e-12) or np.all(signs < -1e-12)):
                    continue
                edge_angle = np.degrees(np.arccos(np.clip(np.sum(verts*np.roll(verts, -1, axis=0), axis=1), -1, 1)))
                if np.max(edge_angle) > 15:
                    continue
                accepted += 1
                native_lon = np.degrees(np.arctan2(verts[:, 1], verts[:, 0]))
                central_lon = math.degrees(math.atan2(center[1], center[0]))
                native_lon = central_lon + (native_lon-central_lon+180) % 360-180
                native_lat = np.degrees(np.arcsin(np.clip(verts[:, 2], -1, 1)))
                # This expanded box only accelerates lookup. Exact spherical
                # half-spaces below decide support, including seam crossings.
                padding = float(np.max(edge_angle))
                rows = np.flatnonzero((lat >= native_lat.min()-padding) & (lat <= native_lat.max()+padding))
                query_lon = central_lon + (lon-central_lon+180) % 360-180
                cols = np.flatnonzero((query_lon >= native_lon.min()-padding) & (query_lon <= native_lon.max()+padding))
                if not len(rows) or not len(cols):
                    continue
                query = xyz[rows[:, None], cols[None, :]]
                inside = (triangle_contains(query, verts[[0, 1, 2]])
                          | triangle_contains(query, verts[[0, 2, 3]]))
                resolution = max(float(obs['navigation'][6][p]) for p in pos)
                view_angle = max(float(obs['navigation'][2][p]) for p in pos)
                old = score[rows[:, None], cols[None, :]]
                old_e = emission[rows[:, None], cols[None, :]]
                take = inside & ((resolution < old) | ((resolution == old) & (view_angle < old_e)))
                rr, cc = np.nonzero(take)
                if not len(rr):
                    continue
                selected = np.argmax(query[rr, cc] @ verts.T, axis=-1)
                source = np.array([p[0]*sw+p[1] for p in pos])[selected]
                r, c = rows[rr], cols[cc]
                result[r, c] = values.reshape(-1)[source]
                score[r, c], emission[r, c] = resolution, view_angle
                owner[r, c], source_pixel[r, c] = number, source+1
        accepted_cells[obs['id']] = accepted
    return result, owner, source_pixel, accepted_cells


def stats(values):
    data = np.asarray(values)
    if not data.size:
        return {'count': 0}
    return {'count': int(data.size), 'minimum': float(data.min()), 'maximum': float(data.max()),
            'percentiles': dict(zip(['5', '50', '95'], np.percentile(data, [5, 50, 95]).tolist()))}


def read_observation(root, entry, policy):
    c_label, planes = read_cube(root/entry['calibrated'], [48, 58, 70, 81, 134, 135, 136], 256)
    n_label, nav = read_cube(root/entry['navigation'], list(range(1, 7)), 6)
    if sequence(n_label, 'Name') != NAV_NAMES:
        raise ValueError('Unexpected native navigation plane names/order')
    for name in ['ProductId', 'NativeStartTime', 'NativeStopTime', 'Samples', 'Lines', 'SamplingMode']:
        if field(c_label, name) != field(n_label, name):
            raise ValueError('C/N native identity mismatch: ' + name)
    if not field(c_label, 'ProductId').startswith('1_'+entry['id'].split('_')[0]+'.'):
        raise ValueError('Observation id does not match native product')
    wave = np.array([float(x) for x in sequence(c_label, 'Center')])
    if wave.shape != (256,) or not np.all(np.diff(wave) > 0):
        raise ValueError('Expected ordered native wavelengths')
    geometry = valid(np.array(list(nav.values()))).all(axis=0)
    geometry &= ((nav[1] >= policy['minimumPhaseDegrees']) & (nav[1] <= policy['maximumPhaseDegrees'])
                 & (nav[2] >= 0) & (nav[2] < policy['maximumIncidenceEmissionDegrees'])
                 & (nav[3] >= 0) & (nav[3] < policy['maximumIncidenceEmissionDegrees'])
                 & (np.abs(nav[4]) <= 90) & (nav[5] >= 0) & (nav[5] <= 360)
                 & (nav[6] > 0) & (nav[6] < policy['maximumResolutionMeters']))
    # Invalid giant ISIS values never enter trigonometry.
    xyz = directions(np.where(geometry, nav[4], 0), np.where(geometry, nav[5], 0))
    errors, eligible = navigation_holdouts(xyz, geometry, policy['maximumHoldoutPixels'])
    indices, t = spectral_indices(planes, wave)
    finite = np.isfinite(errors)
    report = {'id': entry['id'], 'dimensions': list(nav[1].shape[::-1]),
              'time': [field(c_label, 'StartTime'), field(c_label, 'StopTime')],
              'geometryAcceptedNativeCenters': int(geometry.sum()),
              'holdoutCount': int(finite.sum()), 'holdoutPixelsBeforeSelection': stats(errors[finite]),
              'eligibleNativeCenters': int(eligible.sum()),
              'acceptedHoldoutPixels': stats(errors[eligible]),
              'geographicBoundsOfEligibleCenters': {
                  'latitude': stats(nav[4][eligible]), 'eastLongitude': stats(nav[5][eligible])},
              'nativeResolutionMeters': stats(nav[6][eligible]),
              'nativePhaseDegrees': stats(nav[1][eligible]),
              'nativeWavelengthsMicrometers': {str(b): float(wave[b-1]) for b in planes},
              'continuumRightWeight': t,
              'indices': {key: stats(value[ok & eligible]) for key, (value, ok) in indices.items()}}
    return {'id': entry['id'], 'navigation': nav, 'xyz': xyz, 'eligible': eligible,
            'indices': indices, 'report': report}


def write_tiff(path, array, radius, missing, dtype):
    height, width = array.shape[-2:]
    half = math.pi*radius
    transform = from_origin(-half, half/2, 2*half/width, half/height)
    path.parent.mkdir(parents=True, exist_ok=True)
    with rasterio.open(path, 'w', driver='GTiff', width=width, height=height,
                       count=1, dtype=dtype, nodata=missing, compress='deflate',
                       predictor=3 if dtype == 'float32' else 2,
                       crs=f'+proj=eqc +R={radius} +lat_ts=0 +lon_0=0 +units=m +no_defs',
                       transform=transform) as output:
        output.write(array[None].astype(dtype))


def prepare(plan_path):
    path = Path(plan_path).resolve()
    plan, root = json.loads(path.read_text()), path.parent
    if plan.get('schema') != SCHEMA:
        raise ValueError('Unsupported partial Enceladus recipe')
    if tuple(entry['id'] for entry in plan['observations']) != SELECTED_IDS:
        raise ValueError('Expected the qualified six-observation cohort in stable order')
    if (plan.get('absolutePointingAccuracy') != 'unresolved'
            or plan.get('photometricCorrection') != 'none'
            or plan.get('sourceLicense') != 'CC-BY-4.0'):
        raise ValueError('Explicit observation, pointing and source reuse boundaries required')
    required = [entry[k] for entry in plan['observations'] for k in ('calibrated', 'navigation')]
    if not all(name in plan['pins'] for name in required):
        raise ValueError('Every original cube must be pinned')
    for name, pin in plan['pins'].items():
        if digest(root/name) != pin:
            raise ValueError('Source changed: ' + name)
    width, height = plan['width'], plan['height']
    if type(width) is not int or type(height) is not int or width != height*2 or not 0 < width <= 2048:
        raise ValueError('Expected bounded canonical grid')
    policy = plan['policy']
    if policy != {'minimumPhaseDegrees': 10, 'maximumPhaseDegrees': 120,
                  'maximumIncidenceEmissionDegrees': 80, 'maximumResolutionMeters': 20000,
                  'maximumHoldoutPixels': 0.25}:
        raise ValueError('Unqualified geometry policy')
    observations = [read_observation(root, entry, policy) for entry in plan['observations']]
    output_reports = []
    with rasterio.Env(GDAL_CACHEMAX=32*1024*1024, GDAL_NUM_THREADS='1'):
        for kind in ('depth', 'ratio'):
            pixels, owners, source_pixels, cells = project(observations, kind, width, height)
            output = root/plan['outputs'][kind]
            write_tiff(output, pixels, plan['radiusMeters'], MISSING, 'float32')
            audit_owner = output.with_name(output.stem+'-observation.tif')
            audit_source = output.with_name(output.stem+'-source-pixel.tif')
            write_tiff(audit_owner, owners, plan['radiusMeters'], 0, 'uint16')
            write_tiff(audit_source, source_pixels, plan['radiusMeters'], 0, 'uint16')
            # Output weights estimate union area on the declared reference
            # sphere. They do not imply measured pixel-scale surface accuracy.
            edges = np.radians(np.linspace(90, -90, height+1))
            weights = (np.sin(edges[:-1])-np.sin(edges[1:]))[:, None]/(2*width)
            accepted = owners != 0
            # Exact source value audit uses the lossless owner planes; this
            # complements independent raw-byte sample checks in qualification.
            for number, obs in enumerate(observations, 1):
                take = owners == number
                if take.any() and not np.array_equal(pixels[take], obs['indices'][kind][0].reshape(-1)[source_pixels[take]-1]):
                    raise AssertionError('Source-value ownership mismatch')
            output_reports.append({'kind': kind, 'output': plan['outputs'][kind],
                                   'sha256': digest(output), 'bytes': output.stat().st_size,
                                   'dimensions': [width, height], 'noData': MISSING,
                                   'acceptedDisplayPixels': int(accepted.sum()),
                                   'missingDisplayPixels': int((~accepted).sum()),
                                   'acceptedSphereAreaEstimateFraction': float((accepted*weights).sum()),
                                   'acceptedNativeCenterCells': cells, 'statistics': stats(pixels[accepted]),
                                   'sourceOwnerCounts': {obs['id']: int((owners == n).sum()) for n, obs in enumerate(observations, 1)},
                                   'audit': [{'file': p.name, 'sha256': digest(p), 'bytes': p.stat().st_size}
                                             for p in (audit_owner, audit_source)]})
    report = {'schema': SCHEMA, 'recipeSha256': digest(path), 'preparerSha256': digest(__file__),
              'sourceLicense': plan['sourceLicense'], 'policy': policy,
              'sourceLicenseUrl': 'https://creativecommons.org/licenses/by/4.0',
              'sourceLicenseEvidenceUrl': 'https://vims.univ-nantes.fr/about',
              'sourceCredit': 'NASA / Caltech-JPL / University of Arizona / Osuna-CNRS-Nantes Université',
              'sourceProcessingUrl': 'https://vims.univ-nantes.fr/info/isis-calibration',
              'observations': [obs['report'] for obs in observations], 'outputs': output_reports,
              'interpretation': {'registration': 'native planetocentric east-positive centers, interior spherical cells',
                                 'transfer': 'nearest archive-native vertex inside a supported four-center cell; no further spatial spectral interpolation',
                                 'depth': 'fixed native channels 58/70/81; 1-R70/linear continuum using native wavelengths',
                                 'ratio': 'median(R134,R135,R136)/R48; near-3.1/1.66 micrometer spectral ratio',
                                 'photometricCorrection': 'none; illumination, wavelength drift, noise and grain size affect the indices',
                                 'sourceProcessing': 'Nantes RC19 calibration, noise filter and local lowpass replacement are retained',
                                 'absolutePointingAccuracy': 'unresolved; holdouts prove local interpolation consistency only',
                                 'overlapPolicy': 'native cell worst resolution, then worst emission, then fixed recipe observation and cell order',
                                 'referenceRadius': '252100 m sets only angular raster coordinates; it does not replace body geometry or source ellipsoid navigation',
                                 'grid': 'display sampling density, not native instrument resolution; partial footprints only',
                                 'notInferred': ['ice abundance', 'crystallinity percentage', 'temperature', 'terrain age']}}
    (root/plan['receipt']).write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps({'outputs': output_reports, 'receipt': plan['receipt']}))
    return report


if __name__ == '__main__':
    prepare(sys.argv[1])
