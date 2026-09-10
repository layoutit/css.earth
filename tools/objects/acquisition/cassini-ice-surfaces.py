"""Offline RC19 spectral surfaces on qualified existing body coordinates.

Reuse the pinned B8 numeric/GeoTIFF helpers without its between-center mapper.
RGB channels always share one native observation and source-pixel owner. This
tool does not create geometry, photometrically correct data or fit pointing.
"""
import importlib.util
import json
import math
from pathlib import Path
import re
import sys

import numpy as np
import rasterio

_SPEC = importlib.util.spec_from_file_location(
    'b8_transfer', Path(__file__).with_name('enceladus-vims-spectral.py'))
transfer = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(transfer)
_NAV_SPEC = importlib.util.spec_from_file_location(
    'vims_navigation', Path(__file__).with_name('cassini-vims-navigation.py'))
navigation = importlib.util.module_from_spec(_NAV_SPEC)
_NAV_SPEC.loader.exec_module(navigation)
_QUALITY_SPEC = importlib.util.spec_from_file_location(
    'vims_detector_quality', Path(__file__).with_name('cassini-vims-detector-quality.py'))
detector_quality = importlib.util.module_from_spec(_QUALITY_SPEC)
_QUALITY_SPEC.loader.exec_module(detector_quality)
field = transfer.field
MISSING = transfer.MISSING
SCHEMA = 'cssearth-cassini-ice-surfaces@1'
TRANSFER_SHA256 = '25d2a53eaf5d8373d14a85a373588ad662d1e65af427fb36fc64d4575ae27914'
NAVIGATION_SHA256 = 'c4a8f2d534b1252cb847b90beff8c8d4a5daac009912fd40cf5e50f4027b1b04'


def sequence(label, name):
    # ISIS PvlKeyword's explicit end-of-line hyphen continuation convention:
    # https://isis.astrogeology.usgs.gov/3.5.0/Object/Programmer/_pvl_keyword_8cpp_source.html
    # Two 2015 C labels wrap digits inside BandBin.Center using this convention.
    return transfer.sequence(re.sub(r'-[ \t]*\r?\n[ \t]*', '', label), name)


def read_cube(path, bands, expected_bands, target):
    """Read selected native float32 planes; fail on other layouts or bodies."""
    with Path(path).open('rb') as stream:
        label = stream.read(65536).decode('ascii', errors='strict').rstrip('\x00')
        core = label[:label.index('Group = Instrument')]
        width, height = int(field(core, 'Samples')), int(field(core, 'Lines'))
        if (field(core, 'Format') != 'Tile' or field(core, 'Type') != 'Real'
                or field(core, 'ByteOrder') != 'Lsb'
                or int(field(core, 'StartByte')) != 65537
                or int(field(core, 'Bands')) != expected_bands
                or int(field(core, 'TileSamples')) != width
                or int(field(core, 'TileLines')) != height
                or float(field(core, 'Base')) != 0
                or float(field(core, 'Multiplier')) != 1
                or not (1 <= width <= 64 and 1 <= height <= 64)
                or field(label, 'TargetName') != target or field(label, 'Channel') != 'IR'):
            raise ValueError('Unsupported native ISIS layout or target')
        if len(set(bands)) != len(bands) or any(not 1 <= b <= expected_bands for b in bands):
            raise ValueError('Invalid band selection')
        if field(label, 'OutputUnits') != 'I/F':
            raise ValueError('Expected I/F calibration')
        if expected_bands == 256 and [int(x) for x in sequence(label, 'OriginalBand')] != list(range(97, 353)):
            raise ValueError('Unexpected native IR band identities')
        planes = {}
        for band in bands:
            stream.seek(65536 + (band - 1) * width * height * 4)
            data = stream.read(width * height * 4)
            if len(data) != width * height * 4:
                raise ValueError('Truncated native plane')
            planes[band] = np.frombuffer(data, dtype='<f4').reshape(height, width).copy()
        # Calibration history follows the binary core and cached navigation.
        stream.seek(0)
        if b'CalibrationVersion        = RC19' not in stream.read():
            raise ValueError('Expected source-owned RC19 calibration')
    return label, planes


def products(planes, wavelengths, channels):
    left, middle, right = channels['depth']
    lo, mid, hi = [float(wavelengths[b - 1]) for b in (left, middle, right)]
    if not 1.80 < lo < 1.85 < mid < 2.06 < hi < 2.23:
        raise ValueError('Unqualified water-ice continuum channels')
    weight = (mid - lo) / (hi - lo)
    a, b, c = [planes[k].astype('float64') for k in (left, middle, right)]
    continuum = a * (1 - weight) + c * weight
    ok_depth = transfer.valid(np.stack((a, b, c))).all(axis=0)
    ok_depth &= np.isfinite(continuum) & (continuum > 0)
    depth = np.full(a.shape, MISSING, dtype='float32')
    depth[ok_depth] = (1 - b[ok_depth] / continuum[ok_depth]).astype('float32')
    ok_depth &= np.isfinite(depth) & (depth != MISSING)
    depth[~ok_depth] = MISSING
    rgb = np.stack([planes[k] for k in channels['rgb']])
    # Valid dark/negative noisy measurements are not treated as unobserved.
    ok_rgb = transfer.valid(rgb).all(axis=0)
    if np.any(ok_rgb & (rgb == MISSING).any(axis=0)):
        raise ValueError('Valid native RGB collides with output no-data sentinel')
    return depth, ok_depth, rgb, ok_rgb, weight


def read_observation(root, entry, plan):
    channels, policy = plan['channels'], plan['policy']
    bands = sorted(set(channels['depth'] + channels['rgb']))
    label, planes = read_cube(root / entry['calibrated'], bands, 256, plan['target'])
    nav_label, nav = read_cube(root / entry['navigation'], list(range(1, 7)), 6, plan['target'])
    if sequence(nav_label, 'Name') != transfer.NAV_NAMES:
        raise ValueError('Unexpected navigation planes')
    for key in ['ProductId', 'NativeStartTime', 'NativeStopTime', 'Samples', 'Lines', 'SamplingMode']:
        if field(label, key) != field(nav_label, key):
            raise ValueError('C/N identity mismatch: ' + key)
    if not field(label, 'ProductId').startswith('1_' + entry['id'].split('_')[0] + '.'):
        raise ValueError('Native observation ID mismatch')
    wavelengths = np.array([float(x) for x in sequence(label, 'Center')])
    if wavelengths.shape != (256,) or not np.all(np.diff(wavelengths) > 0):
        raise ValueError('Invalid native wavelengths')
    # Recipe records exact original centers, independent of portal preview labels.
    actual = {str(b): float(wavelengths[b - 1]) for b in bands}
    if actual != entry['wavelengthsMicrometers']:
        raise ValueError('Native wavelength pins changed')
    geometry = transfer.valid(np.stack(list(nav.values()))).all(axis=0)
    geometry &= ((nav[1] >= policy['minimumPhaseDegrees']) & (nav[1] <= policy['maximumPhaseDegrees'])
                 & (nav[2] >= 0) & (nav[2] < policy['maximumIncidenceEmissionDegrees'])
                 & (nav[3] >= 0) & (nav[3] < policy['maximumIncidenceEmissionDegrees'])
                 & (np.abs(nav[4]) <= 90) & (nav[5] >= 0) & (nav[5] <= 360)
                 & (nav[6] > 0) & (nav[6] < policy['maximumResolutionMeters']))
    xyz = transfer.directions(np.where(geometry, nav[4], 0), np.where(geometry, nav[5], 0))
    _, frame_id, radii = navigation.QUALIFIED_NATIVE_FRAMES[plan['target']]
    camera = navigation.Camera.from_pair(root / entry['calibrated'], root / entry['navigation'],
                                        expected_target=plan['target'], expected_frame_id=frame_id,
                                        expected_radii_km=radii)
    eligible = np.zeros_like(geometry)
    errors = np.full(geometry.shape, np.inf)
    footprints, rejected = {}, {}
    for y, x in zip(*np.nonzero(geometry)):
        footprint = camera.footprint(int(x), int(y),
                                     maximum_center_error_pixels=policy['maximumCenterErrorPixels'],
                                     aperture_policy=plan['aperturePolicy'],
                                     inset_radians=plan['apertureInsetRadians'])
        residual = footprint.get('centerResidual')
        if residual:
            errors[y, x] = residual['lookErrorPixels']
        if footprint['supported']:
            footprints[int(y) * geometry.shape[1] + int(x)] = footprint
            eligible[y, x] = True
        else:
            reason = footprint.get('reason', 'Unsupported source aperture')
            rejected[reason] = rejected.get(reason, 0) + 1
    depth, ok_depth, rgb, ok_rgb, weight = products(planes, wavelengths, channels)
    quality = detector_quality.quality_for_pair(root / entry['rawOriginal'], root / entry['calibrated'], bands)
    raw_valid = {band: np.asarray(quality['validByBand'][band], dtype=bool).reshape(geometry.shape)
                 for band in bands}
    ok_depth &= np.stack([raw_valid[band] for band in channels['depth']]).all(axis=0)
    ok_rgb &= np.stack([raw_valid[band] for band in channels['rgb']]).all(axis=0)
    # RGB selection uses a neutral scalar; every channel is gathered afterward
    # from the same lossless owner planes, never selected independently.
    indices = {'depth': (depth, ok_depth), 'rgb': (np.zeros_like(depth), ok_rgb)}
    report = {'id': entry['id'], 'dimensions': list(nav[1].shape[::-1]),
              'time': [field(label, 'StartTime'), field(label, 'StopTime')],
              'nativeWavelengthsMicrometers': actual, 'continuumRightWeight': weight,
              'geometryAcceptedNativeCenters': int(geometry.sum()),
              'eligibleNativeCenters': int(eligible.sum()),
              'depthAcceptedNativePixels': int((eligible & ok_depth).sum()),
              'rgbAcceptedNativePixels': int((eligible & ok_rgb).sum()),
              'detectorQuality': quality['report'],
              'acceptedCenterReconstructionPixels': transfer.stats(errors[eligible]),
              'footprintRejections': rejected, 'cameraSourceEvidence': camera.input_evidence,
              'resolutionMeters': transfer.stats(nav[6][eligible]),
              'depth': transfer.stats(depth[ok_depth & eligible]),
              'rgb': [transfer.stats(channel[ok_rgb & eligible]) for channel in rgb]}
    return {'id': entry['id'], 'navigation': nav, 'xyz': xyz, 'eligible': eligible,
            'indices': indices, 'rgb': rgb, 'report': report, 'footprints': footprints,
            'radii': radii}


def frustum_contains(points, frustum):
    """True camera-ray halfspaces, never triangles between ground centers."""
    rays = np.asarray(frustum['cornerUnitRays'])
    normals = np.cross(rays, np.roll(rays, -1, axis=0))
    center = rays.sum(axis=0)
    signs = np.sign(normals @ center)
    if np.any(signs == 0):
        raise ValueError('Degenerate detector frustum')
    vectors = points - np.asarray(frustum['observerKilometers'])
    return ((vectors @ normals.T) * signs >= 0).all(axis=-1) & (vectors @ center > 0)


def footprint_contains(points, footprint, radii):
    """Conservative union/intersection of physical sampled sub-exposures."""
    accepted = np.ones(points.shape[:-1], dtype=bool)
    normal = points / np.square(radii)
    for order in footprint['orders']:
        order_support = np.zeros_like(accepted)
        for subexposure in order:
            support = np.ones_like(accepted)
            for frustum in subexposure:
                visible = (normal * (np.asarray(frustum['observerKilometers']) - points)).sum(axis=-1) > 0
                support &= visible & frustum_contains(points, frustum)
            order_support |= support
        accepted &= order_support
    return accepted


def project_detector(observations, kind, width, height):
    """Assign unchanged spectra only inside their own qualified detector support."""
    lon = (np.arange(width) + .5) * 360 / width - 180
    lat = 90 - (np.arange(height) + .5) * 180 / height
    directions = transfer.directions(lat[:, None], lon[None, :])
    radii = np.asarray(observations[0]['radii'])
    if any(not np.array_equal(obs['radii'], radii) for obs in observations):
        raise ValueError('Native ellipsoid mixture requires an explicit registration')
    points = directions / np.sqrt(np.square(directions / radii).sum(axis=-1))[..., None]
    owners = np.zeros((height, width), dtype='uint16')
    pixels = np.zeros((height, width), dtype='uint16')
    values = np.full((height, width), MISSING, dtype='float32')
    resolution = np.full((height, width), np.inf)
    emission = np.full((height, width), np.inf)
    accepted_apertures = {}
    for number, obs in enumerate(observations, 1):
        data, valid = obs['indices'][kind]
        sw = valid.shape[1]
        contributing = 0
        for source_pixel, footprint in obs['footprints'].items():
            y, x = divmod(source_pixel, sw)
            if not valid[y, x]:
                continue
            hits = np.array([point for order in footprint['orders'] for sub in order
                             for frustum in sub for point in frustum['cornerHitsKilometers']])
            unit_hits = transfer.normalize(hits)
            center = transfer.normalize(unit_hits.sum(axis=0))
            angular_radius = math.degrees(np.arccos(np.clip(unit_hits @ center, -1, 1)).max())
            # This padded spherical cap is only a lookup accelerator; exact
            # angular frusta below decide support at the source ellipsoid.
            angular_radius = angular_radius * 2 + 2 * 360 / width
            center_lat = math.degrees(math.asin(center[2]))
            center_lon = math.degrees(math.atan2(center[1], center[0]))
            rows = np.flatnonzero(np.abs(lat - center_lat) <= angular_radius)
            if abs(center_lat) + angular_radius >= 85:
                cols = np.arange(width)
            else:
                span = angular_radius / math.cos(math.radians(abs(center_lat) + angular_radius))
                cols = np.flatnonzero(np.abs((lon - center_lon + 180) % 360 - 180) <= span)
            if not len(rows) or not len(cols):
                continue
            query = points[rows[:, None], cols[None, :]]
            inside = footprint_contains(query, footprint, radii)
            if not inside.any():
                continue
            r, e = float(obs['navigation'][6][y, x]), float(obs['navigation'][2][y, x])
            old_r, old_e = resolution[rows[:, None], cols[None, :]], emission[rows[:, None], cols[None, :]]
            take = inside & ((r < old_r) | ((r == old_r) & (e < old_e)))
            rr, cc = np.nonzero(take)
            if not len(rr):
                continue
            rr, cc = rows[rr], cols[cc]
            values[rr, cc] = data[y, x]
            resolution[rr, cc], emission[rr, cc] = r, e
            owners[rr, cc], pixels[rr, cc] = number, source_pixel + 1
            contributing += 1
        accepted_apertures[obs['id']] = contributing
    accepted_apertures = {obs['id']: int(np.unique(pixels[owners == number]).size)
                          for number, obs in enumerate(observations, 1)}
    return values, owners, pixels, accepted_apertures


def gather_rgb(observations, owners, source_pixels):
    result = np.full((3, *owners.shape), MISSING, dtype='float32')
    for number, obs in enumerate(observations, 1):
        take = owners == number
        result[:, take] = obs['rgb'].reshape(3, -1)[:, source_pixels[take] - 1]
    return result


def write_rgb(path, values, radius):
    # Each output channel retains I/F; display stretches are a later explicit
    # body-owned interpretation, never baked into the scientific source map.
    height, width = values.shape[-2:]
    half = np.pi * radius
    path.parent.mkdir(parents=True, exist_ok=True)
    with rasterio.open(path, 'w', driver='GTiff', width=width, height=height,
                       count=3, dtype='float32', nodata=MISSING, compress='deflate', predictor=3,
                       crs=f'+proj=eqc +R={radius} +lat_ts=0 +lon_0=0 +units=m +no_defs',
                       transform=rasterio.transform.from_origin(-half, half / 2, 2 * half / width, half / height)) as out:
        out.write(values)


def write_display_rgb(path, values, owners, radius, display):
    """Authored false-color display codes for the existing RGBA GeoTIFF reader.

    The lossless float I/F map remains separate. Code zero is reserved for gaps;
    valid black rounds to display black from uint16 code one, with opaque alpha.
    This display derivative rolls to 0..360 east for the existing projected
    observation reader. The scientific maps and owner rasters stay -180..180.
    """
    ranges, gamma = display['ranges'], display['gamma']
    if (len(ranges) != 3 or any(len(r) != 2 or not all(math.isfinite(v) for v in r)
                               or r[0] >= r[1] for r in ranges)
            or not math.isfinite(gamma) or gamma <= 0):
        raise ValueError('Invalid authored infrared display stretch')
    accepted = owners > 0
    height, width = owners.shape
    rgba = np.zeros((4, height, width), dtype='uint16')
    for c, (low, high) in enumerate(ranges):
        codes = np.clip((values[c, accepted].astype('float64') - low) / (high - low), 0, 1) ** (1 / gamma)
        rgba[c, accepted] = np.maximum(1, np.rint(codes * 65535)).astype('uint16')
    rgba[3, accepted] = 65535
    rgba = np.roll(rgba, width // 2, axis=2)
    half = np.pi * radius
    path.parent.mkdir(parents=True, exist_ok=True)
    with rasterio.open(path, 'w', driver='GTiff', width=width, height=height,
                       count=4, dtype='uint16', nodata=0, compress='deflate', predictor=2,
                       crs=f'+proj=eqc +R={radius} +lat_ts=0 +lon_0=180 +units=m +no_defs',
                       transform=rasterio.transform.from_origin(-half, half / 2, 2 * half / width, half / height)) as out:
        out.write(rgba)


def write_projected_products(root, plan, observations, projector=project_detector):
    """Write lossless quantities, exact owners and an explicit RGB derivative."""
    width, height = plan['width'], plan['height']
    reports = []
    with rasterio.Env(GDAL_CACHEMAX=32 * 1024 * 1024, GDAL_NUM_THREADS='1'):
        for kind in ('depth', 'rgb'):
            values, owners, pixels, cells = projector(observations, kind, width, height)
            output = root / plan['outputs'][kind]
            if kind == 'rgb':
                values = gather_rgb(observations, owners, pixels)
                write_rgb(output, values, plan['radiusMeters'])
                display = root / plan['outputs']['rgbDisplay']
                write_display_rgb(display, values, owners, plan['radiusMeters'], plan['rgbDisplay'])
            else:
                transfer.write_tiff(output, values, plan['radiusMeters'], MISSING, 'float32')
            audits = [output.with_name(output.stem + suffix + '.tif')
                      for suffix in ('-observation', '-source-pixel')]
            for audit, array in zip(audits, (owners, pixels)):
                transfer.write_tiff(audit, array, plan['radiusMeters'], 0, 'uint16')
            edges = np.radians(np.linspace(90, -90, height + 1))
            weights = (np.sin(edges[:-1]) - np.sin(edges[1:]))[:, None] / (2 * width)
            reports.append({'kind': kind, 'file': plan['outputs'][kind],
                            'sha256': transfer.digest(output), 'bytes': output.stat().st_size,
                            'areaFraction': float(((owners > 0) * weights).sum()),
                            'contributingDetectorApertures': cells,
                            'owners': {obs['id']: int((owners == n).sum()) for n, obs in enumerate(observations, 1)},
                            'audit': [{'file': p.name, 'sha256': transfer.digest(p)} for p in audits]})
            if kind == 'rgb':
                reports[-1]['display'] = {'file': plan['outputs']['rgbDisplay'],
                                          'sha256': transfer.digest(display), 'bytes': display.stat().st_size,
                                          'centerLongitudeDegrees': 180,
                                          'sourceColumnRoll': width // 2,
                                          'stretch': plan['rgbDisplay']}
    return reports


def prepare(path):
    path = Path(path).resolve()
    plan, root = json.loads(path.read_text()), path.parent
    if plan.get('schema') != SCHEMA or plan.get('target') not in ('IAPETUS', 'TETHYS'):
        # Phoebe requires an independently qualified frame transfer; it cannot
        # enter this native-coordinate path just by changing a body name.
        raise ValueError('Unqualified native-coordinate recipe')
    if transfer.digest(_SPEC.origin) != TRANSFER_SHA256:
        raise ValueError('Pinned B8 transfer implementation changed')
    if transfer.digest(_NAV_SPEC.origin) != NAVIGATION_SHA256:
        raise ValueError('Pinned source-camera implementation changed')
    if (plan.get('detectorQualityPolicy') != detector_quality.POLICY
            or transfer.digest(_QUALITY_SPEC.origin) != plan.get('detectorQualityPreparerSha256')):
        raise ValueError('Pinned original-detector quality implementation changed')
    validate_policy(plan['policy'])
    insets = plan.get('apertureInsetRadians', [])
    if (plan.get('aperturePolicy') != navigation.APERTURE_POLICY or len(insets) != 2
            or any(type(v) not in (int, float) or not math.isfinite(v) or not 0 <= v < limit
                   for v, limit in zip(insets, (.000125, .00025)))):
        raise ValueError('Explicit nominal aperture and angular inset policy required')
    if (plan.get('photometricCorrection') != 'none'
            or plan.get('absolutePointingAccuracy') != 'unresolved'
            or not isinstance(plan.get('registrationEvidence'), dict)):
        raise ValueError('Source registration and interpretation are required')
    evidence = plan['registrationEvidence']
    if (not evidence.get('qualification') or not evidence.get('sha256')
            or transfer.digest(root / evidence['file']) != evidence['sha256']):
        raise ValueError('Source registration evidence changed')
    required = [entry[key] for entry in plan['observations'] for key in ('calibrated', 'navigation', 'rawOriginal')]
    if not all(name in plan['pins'] for name in required):
        raise ValueError('Every original cube must be pinned')
    for name, pin in plan['pins'].items():
        if transfer.digest(root / name) != pin:
            raise ValueError('Source changed: ' + name)
    width, height = plan['width'], plan['height']
    if type(width) is not int or type(height) is not int or width != height * 2 or not 0 < width <= 2048:
        raise ValueError('Invalid canonical map dimensions')
    observations = [read_observation(root, entry, plan) for entry in plan['observations']]
    reports = write_projected_products(root, plan, observations)
    report = {'schema': SCHEMA, 'recipeSha256': transfer.digest(path),
              'preparerSha256': transfer.digest(__file__), 'transferSha256': transfer.digest(_SPEC.origin),
              'navigationPreparerSha256': transfer.digest(_NAV_SPEC.origin),
              'detectorQualityPreparerSha256': transfer.digest(_QUALITY_SPEC.origin),
              'observations': [o['report'] for o in observations], 'outputs': reports,
              'absolutePointingAccuracy': plan['absolutePointingAccuracy'],
              'photometricCorrection': plan['photometricCorrection'],
              'aperturePolicy': plan['aperturePolicy'], 'apertureInsetRadians': insets,
              'registrationEvidence': plan['registrationEvidence']}
    (root / plan['receipt']).write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))
    return report


def validate_policy(policy):
    expected = {'minimumPhaseDegrees', 'maximumPhaseDegrees',
                'maximumIncidenceEmissionDegrees', 'maximumResolutionMeters',
                'maximumCenterErrorPixels'}
    if set(policy) != expected or any(type(v) not in (int, float) or not math.isfinite(v)
                                       for v in policy.values()):
        raise ValueError('Geometry policy must contain finite numbers')
    if not (0 <= policy['minimumPhaseDegrees'] < policy['maximumPhaseDegrees'] <= 180
            and 0 < policy['maximumIncidenceEmissionDegrees'] < 90
            and policy['maximumResolutionMeters'] > 0
            and 0 < policy['maximumCenterErrorPixels'] <= .01):
        raise ValueError('Unqualified geometry policy')


if __name__ == '__main__':
    prepare(sys.argv[1])
