"""Offline registered VIMS measurements on Phoebe's unchanged prepared mesh.

The checked registration receipts own source look offsets and regional masks.
This tool only maps measured spectra into geographic textures. It never writes
geometry, changes a camera at runtime, or uses photographed brightness as a
coverage mask. Source ownership is exact under the stated nominal fitted model;
absolute geographic placement retains the measured registration uncertainty.
"""
import importlib.util
import json
import math
from pathlib import Path
import re
import struct
import sys

import numpy as np


def module(name, filename):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(filename))
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


ice = module('cassini_ice', 'cassini-ice-surfaces.py')
fixed = module('cassini_fixed_mesh', 'cassini-fixed-mesh.py')
nav = ice.navigation
SCHEMA = 'cssearth-phoebe-registered-vims-surfaces@1'


def pck(et, rotation):
    def rz(angle):
        c, s = math.cos(angle), math.sin(angle)
        return np.array([[c, s, 0], [-s, c, 0], [0, 0, 1]])
    def rx(angle):
        c, s = math.cos(angle), math.sin(angle)
        return np.array([[1, 0, 0], [0, c, s], [0, -s, c]])
    w = math.radians((rotation['primeMeridianDegrees'] + rotation['spinRateDegreesPerDay'] * (et / 86400)) % 360)
    return rz(w) @ rx(math.radians(90-rotation['declinationDegrees'])) @ rz(math.radians(90+rotation['rightAscensionDegrees']))


def sun_table(path):
    raw = Path(path).read_bytes()
    label = raw[:65536].decode('ascii').rstrip('\0')
    table = ice.detector_quality.object_text(label, 'Table', 'SunPosition')
    if nav._field(table, 'CacheType') != 'Linear' or nav._field(table, 'ByteOrder') != 'Lsb':
        raise ValueError('Unqualified source Sun cache')
    fields = re.findall(r'Group\s*=\s*Field\s*\n(.*?)End_Group', table, re.S)
    if ([nav._field(f, 'Name') for f in fields] != ['J2000X', 'J2000Y', 'J2000Z', 'J2000XV', 'J2000YV', 'J2000ZV', 'ET']
            or any(nav._field(f, 'Type') != 'Double' or nav._field(f, 'Size') != '1' for f in fields)):
        raise ValueError('Unqualified Sun cache columns')
    start, length = int(nav._field(table, 'StartByte'))-1, int(nav._field(table, 'Bytes'))
    data = raw[start:start+length]
    if len(data) != 112:
        raise ValueError(f'{path}: SunPosition table holds {len(data)} bytes, not two 56-byte samples')
    rows = np.array(list(struct.iter_unpack('<7d', data)))
    if not np.isfinite(rows).all() or rows[0, -1] >= rows[1, -1]:
        raise ValueError('Invalid Sun cache samples')
    return rows


def current_state(camera, x, y, fraction, plan, sun):
    et = camera.pixel_time(x, y, fraction)
    state = camera.state(et)
    rotation = pck(et, plan['rotation'])
    transfer = rotation @ np.asarray(state[0]).T
    shift = np.asarray(plan['originTranslationKilometers'])
    fraction_sun = (et-sun[0, -1]) / (sun[1, -1]-sun[0, -1])
    if not 0 <= fraction_sun <= 1:
        raise ValueError('Sun-cache extrapolation forbidden')
    solar = rotation @ ((1-fraction_sun)*sun[0, :3] + fraction_sun*sun[1, :3]) + shift
    return et, state, transfer, shift, solar


def read_observation(root, entry, plan, mesh):
    bands = sorted(set(plan['channels']['rgb'] + plan['channels']['depth']))
    label, planes = ice.read_cube(root / entry['calibrated'], bands, 256, 'PHOEBE')
    wavelengths = np.array([float(v) for v in ice.sequence(label, 'Center')])
    if {str(b): float(wavelengths[b-1]) for b in bands} != entry['wavelengthsMicrometers']:
        raise ValueError('Native wavelength pins changed')
    quality = ice.detector_quality.quality_for_pair(root / entry['rawOriginal'], root / entry['calibrated'], bands)
    camera = nav.Camera.from_pair(root / entry['calibrated'], root / entry['navigation'], expected_target='PHOEBE',
                                  expected_radii_km=(115., 110., 105.), expected_frame_id=10047, ray_only=True)
    if camera.mode != 'HI-RES':
        raise ValueError('This registered aperture recipe qualifies HI-RES IR only')
    region = json.loads((root / entry['region']).read_text())
    if (region['observationId'] != entry['id']
            or (region['width'], region['height']) != (camera.width, camera.height)):
        raise ValueError(f"{entry['region']}: observationId {region['observationId']} at "
                         f"{region['width']}x{region['height']} does not match observation {entry['id']} "
                         f"at {camera.width}x{camera.height}")
    if any(type(value) is not bool for value in region['nativePixelMask']):
        raise ValueError('Boolean native-pixel registration mask required')
    mask = np.array(region['nativePixelMask'], dtype=bool).reshape(camera.height, camera.width)
    if mask.sum() != region['retainedPixelCount'] or not mask.any():
        raise ValueError('Registered regional mask changed')
    depth, valid_depth, rgb, valid_rgb, weight = ice.products(planes, wavelengths, plan['channels'])
    raw_valid = {b: np.array(quality['validByBand'][b], dtype=bool).reshape(mask.shape) for b in bands}
    valid_depth &= mask & np.stack([raw_valid[b] for b in plan['channels']['depth']]).all(axis=0)
    valid_rgb &= mask & np.stack([raw_valid[b] for b in plan['channels']['rgb']]).all(axis=0)
    sun = sun_table(root / entry['navigation'])
    offsets = np.array(region['fitOffsetsRadians'])
    anchors = {item['nativeFlatIndex']: item for item in region['acceptedPixels']}
    if set(anchors) != set(np.flatnonzero(mask)) or len(anchors) != len(region['acceptedPixels']):
        raise ValueError('Regional mask and independent source anchors disagree')
    for pixel, anchor in anchors.items():
        y, x = divmod(pixel, camera.width)
        et, state, transform, shift, _ = current_state(camera, x, y, .5, plan, sun)
        observer, ray = camera.ray(x, y, et, offset_radians=offsets, state=state)
        observer, ray = transform @ observer+shift, np.array(nav.unit(transform @ ray))
        nominal = anchor['nominal']
        point = mesh.intersect(observer, ray)['point'][0]
        if (abs(et-nominal['et']) > 1e-6 or np.linalg.norm(observer-nominal['observerKm']) > 1e-6
                or np.linalg.norm(ray-nominal['unitRayFixedFrame']) > 1e-10
                or not np.isfinite(point).all() or np.linalg.norm(point-nominal['pointKm']) > 1e-5):
            raise ValueError('Mapping frame no longer reproduces the independently fitted source anchors')
    half = np.array([.000125, .00025])-np.array(plan['apertureInsetRadians'])
    footprints, rejected = {}, {}
    for y, x in zip(*np.nonzero(valid_depth | valid_rgb)):
        frusta = []
        for fraction in plan['exposureFractions']:
            et, state, transform, shift, solar = current_state(camera, int(x), int(y), fraction, plan, sun)
            rays = []
            for dx, dy in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
                observer, ray = camera.ray(int(x), int(y), et, offset_radians=offsets+half*[dx, dy], state=state)
                rays.append(nav.unit(transform @ ray))
            observer = transform @ observer+shift
            hits = mesh.intersect(observer, np.array(rays))
            if (hits['face'] < 0).any():
                break
            frusta.append({'observerKilometers': observer, 'cornerUnitRays': rays,
                           'cornerHitsKilometers': hits['point'], 'sunKilometers': solar,
                           'et': et, 'fraction': fraction})
        source_pixel = int(y)*camera.width+int(x)
        if len(frusta) != len(plan['exposureFractions']):
            rejected[str(source_pixel)] = 'A sampled aperture corner misses the fixed mesh'
            continue
        footprints[source_pixel] = frusta
    return {'id': entry['id'], 'indices': {'depth': (depth, valid_depth), 'rgb': (np.zeros_like(depth), valid_rgb)},
            'rgb': rgb, 'footprints': footprints,
            'report': {'id': entry['id'], 'dimensions': [camera.width, camera.height],
                       'nativeWavelengthsMicrometers': entry['wavelengthsMicrometers'], 'continuumRightWeight': weight,
                       'registeredRegionPixels': int(mask.sum()), 'depthAcceptedNativePixels': int(valid_depth.sum()),
                       'rgbAcceptedNativePixels': int(valid_rgb.sum()), 'sampledApertures': len(footprints),
                       'apertureRejections': rejected, 'detectorQuality': quality['report'],
                       'cameraSourceEvidence': camera.input_evidence, 'region': entry['region'],
                       'fitOffsetsRadians': offsets.tolist(), 'placementLimit': region['scope']}}


def physical_support(mesh, points, normals, frustum, maximum_degrees):
    observer, sun = np.asarray(frustum['observerKilometers']), np.asarray(frustum['sunKilometers'])
    view, light = observer-points, sun-points
    view /= np.linalg.norm(view, axis=1)[:, None]
    light /= np.linalg.norm(light, axis=1)[:, None]
    threshold = math.cos(math.radians(maximum_degrees))
    accepted = ((normals*view).sum(axis=1) >= threshold) & ((normals*light).sum(axis=1) >= threshold)
    indexes = np.flatnonzero(accepted)
    if not len(indexes):
        return accepted
    hits = mesh.intersect(observer, -view[indexes])
    visible = np.linalg.norm(hits['point']-points[indexes], axis=1) <= 1e-6  # 1 mm numeric endpoint agreement.
    accepted[indexes] &= visible
    indexes = np.flatnonzero(accepted)
    if len(indexes):
        # Explicit 0.1 mm outward offset avoids numerical self-intersection on
        # the same plane. It does not alter the surface or ray's source origin.
        shadow = mesh.intersect(points[indexes]+normals[indexes]*1e-7, light[indexes])
        accepted[indexes] &= shadow['face'] < 0
    return accepted


def projector_for(mesh, plan, observations):
    width, height = plan['width'], plan['height']
    lon = (np.arange(width)+.5)*360/width-180
    lat = 90-(np.arange(height)+.5)*180/height
    directions = ice.transfer.directions(lat[:, None], lon[None, :])
    radial = mesh.intersect(np.zeros(3), directions.reshape(-1, 3))
    if (radial['face'] < 0).any():
        raise ValueError('Existing mesh has an unsupported geographic ray')
    points = radial['point'].reshape(height, width, 3)
    normals = mesh.normals[radial['face']].reshape(height, width, 3)
    # A geographic texture cannot distinguish multiple surfaces in one radial
    # direction. A closed outward-wound mesh with an additional outward crossing
    # must also cross an inward-facing facet. Withhold those directions rather
    # than painting a visible measurement onto an occluded fold of the fixed mesh.
    inward = (mesh.normals * mesh.triangles.mean(axis=1)).sum(axis=1) <= 0
    ambiguous = np.zeros(width*height, dtype=bool)
    if inward.any():
        inward_mesh = fixed.FixedMesh(mesh.triangles[inward])
        ambiguous = inward_mesh.intersect(np.zeros(3), directions.reshape(-1, 3))['face'] >= 0
    ambiguous |= (normals * directions).sum(axis=2).ravel() <= 0
    support = []
    query = points.reshape(-1, 3)
    flat_normals = normals.reshape(-1, 3)
    for number, obs in enumerate(observations, 1):
        for pixel, frusta in obs['footprints'].items():
            # Test the complete modest grid: a corner-derived ground bbox is
            # not an exact bound on an irregular mesh. After the first cone,
            # subsequent tests need only the surviving candidate points.
            indexes = np.flatnonzero(~ambiguous)
            for frustum in frusta:
                indexes = indexes[ice.frustum_contains(query[indexes], frustum)]
            for frustum in frusta:
                if not len(indexes):
                    break
                valid = physical_support(mesh, query[indexes], flat_normals[indexes],
                                         frustum, plan['maximumIncidenceEmissionDegrees'])
                indexes = indexes[valid]
            if not len(indexes):
                continue
            # Deterministic smallest sampled footprint-edge span, then the
            # authored observation/pixel order. No spectral value chooses it.
            span = max(np.linalg.norm(np.roll(f['cornerHitsKilometers'], -1, axis=0)-f['cornerHitsKilometers'], axis=1).max() for f in frusta)
            support.append((float(span), number, pixel, indexes//width, indexes%width))
    support.sort(key=lambda item: item[:3])

    def project(_observations, kind, w, h):
        if (w, h) != (width, height):
            raise ValueError('Canonical source grid changed')
        owner, pixels = np.zeros((h, w), 'uint16'), np.zeros((h, w), 'uint16')
        values = np.full((h, w), ice.MISSING, 'float32')
        for _, number, pixel, rows, cols in support:
            data, valid = observations[number-1]['indices'][kind]
            if not valid.ravel()[pixel]:
                continue
            take = owner[rows, cols] == 0
            rows, cols = rows[take], cols[take]
            owner[rows, cols], pixels[rows, cols] = number, pixel+1
            values[rows, cols] = data.ravel()[pixel]
        counts = {o['id']: int(np.unique(pixels[owner == n]).size) for n, o in enumerate(observations, 1)}
        return values, owner, pixels, counts
    project.geometry_report = {'fixedFaces': len(mesh.triangles), 'inwardRadialFaces': int(inward.sum()),
                               'ambiguousGeographicGridCellsWithheld': int(ambiguous.sum()),
                               'gridCells': width*height,
                               'interpretation': 'Longitude/latitude directions intersecting an inward radial facet are withheld to avoid transferring one source sample onto multiple fixed terrain patches.'}
    return project


def prepare(path):
    path = Path(path).resolve()
    plan, root = json.loads(path.read_text()), path.parent
    if 'pins' in plan:
        raise ValueError(f'{path}: the "pins" field is retired; recipes declare inputs by path')
    if (plan['schema'] != SCHEMA or plan['target'] != 'PHOEBE' or (plan['width'], plan['height']) not in ((720, 360), (1440, 720))
            or plan['radiusMeters'] != 106500 or plan['photometricCorrection'] != 'none'):
        raise ValueError('Unqualified Phoebe recipe')
    if (plan['apertureInsetRadians'] != [1e-6, 1e-6] or plan['exposureFractions'] != [n/8 for n in range(9)]
            or plan['maximumIncidenceEmissionDegrees'] != 60):
        raise ValueError('Unqualified sampled aperture policy')
    required = [(f"observations[{entry['id']}].{key}", entry[key]) for entry in plan['observations']
                for key in ('calibrated', 'navigation', 'rawOriginal', 'region', 'fitReceipt')]
    required += [(key, plan[key]) for key in ('terrain', 'rotationPath', 'originComparison')]
    missing = [f'{field} = {name}' for field, name in required if not (root / name).is_file()]
    if missing:
        raise ValueError(f'phoebe {path.name}: missing inputs: ' + ', '.join(missing))
    rotation = json.loads((root / plan['rotationPath']).read_text())
    comparison = json.loads((root / plan['originComparison']).read_text())
    if (rotation != plan['rotation'] or rotation['referenceEpochJdTt'] != 2451545
            or comparison['surfaceRefinement']['translationKm'] != plan['originTranslationKilometers']):
        raise ValueError('Registered source-frame interpretation differs from its evidence')
    terrain_path = root / plan['terrain']
    terrain_bytes = terrain_path.read_bytes()
    terrain = json.loads(terrain_bytes)
    if len(terrain['faces']) != 3500:
        raise ValueError('Unexpected fixed face count')
    mesh = fixed.FixedMesh(np.array([face['vertices'] for face in terrain['faces']])*106.5/230)
    observations = [read_observation(root, entry, plan, mesh) for entry in plan['observations']]
    projector = projector_for(mesh, plan, observations)
    outputs = ice.write_projected_products(root, plan, observations, projector)
    if terrain_path.read_bytes() != terrain_bytes:
        raise ValueError(f"phoebe {plan['terrain']}: fixed mesh changed during source mapping")
    receipt = {'schema': SCHEMA, 'recipe': path.name, 'terrain': plan['terrain'],
               'fixedMeshMapping': projector.geometry_report,
               'observations': [obs['report'] for obs in observations], 'outputs': outputs,
               'areaDenominator': 'Reference-sphere solid-angle grid estimate, not physical mesh area',
               'placementLimit': 'Nominal fitted regional mapping. Measured limb holdout residual is about one native fast-axis sample; no exact absolute position or integrated PSF is claimed.',
               'apertureModel': 'Intersection of nine sampled inset HI-RES nominal frusta, with fixed-mesh visibility, self-shadow and incidence/emission checks at each pose.'}
    (root / plan['receipt']).write_text(json.dumps(receipt, indent=2)+'\n')
    print(json.dumps(receipt, indent=2))


if __name__ == '__main__':
    prepare(sys.argv[1])
