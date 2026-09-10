"""Independent, bounded Iapetus detector-support audit of an actual trial map.

Run only in a root-approved numerical slot. This does not write source rasters.
The geometric oracle uses the earlier independent source camera, inverted into
native angular coordinates; it does not call production frustum containment.
Production functions are the subject under test. Rasterio/NumPy are used only
for existing small TIFF input and bounded whole-grid accelerator comparisons.

Dense poses are empirical temporal evidence, not a continuous-motion/PSF proof.
Absolute ISS alignment cannot be established by this same-navigation audit.
"""
import argparse
from collections import defaultdict
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import random
import resource
import struct
import time


ROOT = Path(__file__).resolve().parents[5]
DEFAULT_INSETS = (0., 1e-12, 1e-11, 1e-10, 1e-9, 1e-8, 1e-7, 1e-6)
EXTRA_PINS = {
    'C1568157352_4_ir.cub': 'e8693e98d929f20d38d32659852d157c38a8d48ef13d5a38a6f4ea0fc00bc572',
    'N1568157352_4_ir.cub': '9fc00478957d7afa5668e724977e784b2cfa9ba6e1b2e7abb9018e3a40c293e7',
}
NATIVE_FRAMES = {'IAPETUS': (608, 10046, (747.4, 747.4, 712.4)),
                 'TETHYS': (603, 10041, (540.4, 531.1, 527.5))}


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def digest(path):
    sha = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for chunk in iter(lambda: stream.read(65536), b''):
            sha.update(chunk)
    return sha.hexdigest()


def quantiles(items, limit):
    if len(items) <= limit:
        return list(items)
    return [items[round(index*(len(items)-1)/(limit-1))] for index in range(limit)]


class SourceCamera:
    """Independent pinned IR center model; no production camera calls.

    Extends the previously center-verified doc equations to the original ISIS
    HI-RES branch. The half-fast sampling offset uses C++ integer division.
    Only the common cached quaternion/Hermite math is reused from that audit.
    """
    def __init__(self, path, target, independent):
        self.math = independent
        value, array = independent.v.value, independent.v.array
        with Path(path).open('rb') as stream:
            self.label = stream.read(65536).decode('ascii').rstrip('\x00')
            core = self.label.split('Group = Instrument', 1)[0]
            self.side = int(value(core, 'Samples'))
            self.height = int(value(core, 'Lines'))
            if (value(core, 'Format') != 'Tile' or value(core, 'ByteOrder') != 'Lsb'
                    or value(core, 'Type') != 'Real' or int(value(core, 'StartByte')) != 65537
                    or int(value(core, 'Bands')) != 6 or int(value(core, 'TileSamples')) != self.side
                    or int(value(core, 'TileLines')) != self.height
                    or value(self.label, 'TargetName') != target or value(self.label, 'Channel') != 'IR'
                    or array(self.label, 'Name') != independent.v.NAV_NAMES):
                raise ValueError('Unqualified independent native layout')
            raw = stream.read(self.side*self.height*6*4)
        body_id, self.frame_id, self.radii = NATIVE_FRAMES[target]
        if (tuple(float(x) for x in array(self.label, f'BODY{body_id}_RADII')) != self.radii
                or int(value(self.label, 'BODY_FRAME_CODE')) != self.frame_id):
            raise ValueError('Independent native frame/radii mismatch')
        n = self.side*self.height
        values = struct.unpack('<'+'f'*(n*6), raw)
        self.nav = {b+1: values[b*n:(b+1)*n] for b in range(6)}
        self.tables = independent.tables(Path(path), self.label)
        number, fraction = value(self.label, 'NativeStartTime').split('.')
        self.start = struct.unpack('<d', bytes.fromhex(value(self.label, 'CLOCK_ET_-82_'+number+'_COMPUTED')))[0]+int(fraction)/15959
        self.exposure = float(array(self.label, 'ExposureDuration')[0].split()[0])*.001*1.01725
        self.delay = float(value(self.label, 'InterlineDelayDuration'))*.001*1.01725
        self.mode = value(self.label, 'SamplingMode')
        xoffset, yoffset = int(value(self.label, 'XOffset')), int(value(self.label, 'ZOffset'))
        if self.mode == 'NORMAL':
            self.model = (.000495, .000495, 31., 31., xoffset-1, yoffset-1)
        elif self.mode == 'HI-RES':
            self.model = (.000495/2, .000495, 62.5, 31.,
                          2*((xoffset-1)+(self.side-1)//4), yoffset-1)
        else:
            raise ValueError('Unsupported independent IR mode')

    def time(self, x, y):
        return self.start+y*(self.side*self.exposure+self.delay)+(x+.5)*self.exposure

    def state(self, et):
        m = self.math
        body = m.rot(self.tables['BodyRotation']['rows'], et)
        pointing = m.rot(self.tables['InstrumentPointing']['rows'], et)
        observer = m.mv(body, m.pos(self.tables['InstrumentPosition']['rows'], et))
        return body, pointing, observer

    def hit(self, x, y, et, dx=0., dy=0.):
        m = self.math
        px, py, bx, by, ox, oy = self.model
        theta = math.pi/2-(y+oy-by)*py-dy
        phi = -math.pi/2+(x+ox-bx)*px+dx
        instrument = [math.sin(theta)*math.cos(phi), math.cos(theta), -math.sin(theta)*math.sin(phi)]
        body, pointing, observer = self.state(et)
        ray = m.mv(body, m.mv(m.transpose(pointing), m.mv(m.transpose(self.tables['InstrumentPointing']['constant']), instrument)))
        a = sum((d/r)**2 for d, r in zip(ray, self.radii))
        b = 2*sum(o*d/r**2 for o, d, r in zip(observer, ray, self.radii))
        c = sum((o/r)**2 for o, r in zip(observer, self.radii))-1
        disc = b*b-4*a*c
        if disc < 0:
            return None, observer, ray
        roots = [s for s in ((-b-math.sqrt(disc))/(2*a), (-b+math.sqrt(disc))/(2*a)) if s > 0]
        point = [o+min(roots)*d for o, d in zip(observer, ray)] if roots else None
        return point, observer, ray


def ellipsoid_point(latitude, longitude, radii):
    p, l = math.radians(latitude), math.radians(longitude)
    direction = (math.cos(p)*math.cos(l), math.cos(p)*math.sin(l), math.sin(p))
    scale = 1/math.sqrt(sum((a/b)**2 for a, b in zip(direction, radii)))
    return tuple(scale*x for x in direction)


def output_point(row, col, width, height, radii):
    return ellipsoid_point(90-(row+.5)*180/height, (col+.5)*360/width-180, radii)


def inverse_poses(independent, camera, x, y, count):
    """Separate inverse camera, dense cached transforms, fixed detector timing."""
    result = []
    constant = camera.tables['InstrumentPointing']['constant']
    for index in range(count):
        fraction = index/(count-1)
        et = camera.time(x, y)+(fraction-.5)*camera.exposure
        body, pointing, observer = camera.state(et)
        matrix = []
        for row in constant:
            # Row-vector multiplication: C * Rpointing * Rbody^T.
            a = [sum(row[k]*pointing[k][j] for k in range(3)) for j in range(3)]
            matrix.append([sum(a[k]*body[j][k] for k in range(3)) for j in range(3)])
        result.append((fraction, observer, matrix))
    return result


def margins_at_poses(point, poses, camera, x, y):
    """Signed exact spherical-angle rectangle margins, nominal physical IFOV.

    Corner-ray planes approximate constant-theta edges by great-circle chords.
    Direct angular inversion independently detects any resulting oversupport.
    """
    radii = camera.radii
    normal = tuple(point[k]/radii[k]**2 for k in range(3))
    half_sign = {(half, sign): math.inf for half in (0, 1) for sign in (-1, 1)}
    coarse = dict(half_sign)
    hires_dense, hires_coarse = math.inf, math.inf
    px, py, bx, by, ox, oy = camera.model
    for fraction, observer, matrix in poses:
        delta = tuple(point[k]-observer[k] for k in range(3))
        visible = sum(normal[k]*(-delta[k]) for k in range(3)) > 0
        look = tuple(sum(row[k]*delta[k] for k in range(3)) for row in matrix)
        phi = math.atan2(-look[2], look[0])
        theta = math.atan2(math.hypot(look[0], look[2]), look[1])
        fast = phi+math.pi/2-(x+ox-bx)*px
        slow = math.pi/2-theta-(y+oy-by)*py
        if camera.mode == 'HI-RES':
            margin = min(.000125-abs(fast), .00025-abs(slow)) if visible else -math.inf
            hires_dense = min(hires_dense, margin)
            if fraction in (0., .5, 1.):
                hires_coarse = min(hires_coarse, margin)
            continue
        halves = ((0,) if fraction < .5 else (1,) if fraction > .5 else (0, 1))
        for half in halves:
            for sign in (-1, 1):
                margin = min(.000125-abs(fast-sign*.000125), .00025-abs(slow)) if visible else -math.inf
                half_sign[half, sign] = min(half_sign[half, sign], margin)
                if fraction in (0., .25, .5, .75, 1.):
                    coarse[half, sign] = min(coarse[half, sign], margin)
    def merge(values):
        return min(max(values[0, -1], values[1, 1]),
                   max(values[0, 1], values[1, -1]))
    return (hires_dense, hires_coarse) if camera.mode == 'HI-RES' else (merge(half_sign), merge(coarse))


def boundary_candidates(camera, x, y):
    points = []
    for fraction in (.25, .75):
        et = camera.time(x, y)+(fraction-.5)*camera.exposure
        for sign in ((-1, 1) if camera.mode == 'NORMAL' else (0,)):
            for inset in (0., 1e-9):
                for ax, ay in ((-1, -1), (0, -1), (1, -1), (1, 0),
                               (1, 1), (0, 1), (-1, 1), (-1, 0), (0, 0)):
                    dx = sign*.000125+ax*(.000125-inset)
                    dy = ay*(.00025-inset)
                    hit, _, _ = camera.hit(x, y, et, dx, dy)
                    if hit is not None:
                        points.append((tuple(hit), 'angular-boundary'))
    return points


def accelerator_rows_cols(np, footprint, width, height):
    """Literal lookup accelerator under review; never the containment oracle."""
    hits = np.array([point for order in footprint['orders'] for sub in order
                     for frustum in sub for point in frustum['cornerHitsKilometers']])
    hits /= np.linalg.norm(hits, axis=1)[:, None]
    center = hits.sum(axis=0)
    center /= np.linalg.norm(center)
    radius = math.degrees(np.arccos(np.clip(hits @ center, -1, 1)).max())*2+720/width
    center_lat = math.degrees(math.asin(center[2]))
    center_lon = math.degrees(math.atan2(center[1], center[0]))
    lat = 90-(np.arange(height)+.5)*180/height
    lon = (np.arange(width)+.5)*360/width-180
    rows = np.flatnonzero(np.abs(lat-center_lat) <= radius)
    if abs(center_lat)+radius >= 85:
        cols = np.arange(width)
    else:
        span = radius/math.cos(math.radians(abs(center_lat)+radius))
        cols = np.flatnonzero(np.abs((lon-center_lon+180)%360-180) <= span)
    return rows, cols


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--recipe', type=Path, default=ROOT/'output/b9-source-intake/iapetus/prepare-trial.json')
    parser.add_argument('--output', type=Path, default=Path(__file__).with_name('rasterizer-dense-qualification.json'))
    parser.add_argument('--poses', type=int, default=129)
    parser.add_argument('--pixels-per-observation', type=int, default=16)
    parser.add_argument('--max-owned-per-pixel', type=int, default=32)
    parser.add_argument('--bbox-pixels-per-observation', type=int, default=4)
    args = parser.parse_args()
    if (not 17 <= args.poses <= 513 or (args.poses-1)%4
            or not 4 <= args.pixels_per_observation <= 32
            or not 4 <= args.max_owned_per_pixel <= 128
            or not 0 <= args.bbox_pixels_per_observation <= 8):
        raise ValueError('Unbounded or non-quarter-aligned audit request')
    # Import numerical libraries only after argument parsing. No background work.
    import numpy as np
    import rasterio
    started = time.monotonic()
    independent = load('independent_iapetus_camera', Path(__file__).with_name('qualify-detector-footprints.py'))
    independent.v.PINS.update(EXTRA_PINS)
    converter_path = ROOT/'tools/objects/acquisition/cassini-ice-surfaces.py'
    converter = load('detector_under_test', converter_path)
    navigation = converter.navigation
    recipe_digest = digest(args.recipe)
    plan = json.loads(args.recipe.read_text())
    root = args.recipe.parent
    if plan['target'] not in NATIVE_FRAMES or not 1 <= len(plan['observations']) <= 12:
        raise ValueError('Unqualified or unbounded source cohort')
    for name, pin in plan['pins'].items():
        if digest(root/name) != pin:
            raise ValueError('Recipe input pin changed: '+name)
    paths = {kind: root/plan['outputs'][kind] for kind in ('depth', 'rgb')}
    owner_arrays, output_pins = [], {}
    for kind, path in paths.items():
        for p in (path, path.with_name(path.stem+'-observation.tif'), path.with_name(path.stem+'-source-pixel.tif')):
            output_pins[str(p)] = {'sha256': digest(p), 'bytes': p.stat().st_size}
        with rasterio.open(path.with_name(path.stem+'-observation.tif')) as src:
            owners = src.read(1)
            width, height = src.width, src.height
        with rasterio.open(path.with_name(path.stem+'-source-pixel.tif')) as src:
            pixels = src.read(1)
        if owners.shape != pixels.shape or (width, height) != (plan['width'], plan['height']):
            raise ValueError('Trial owner grid dimensions mismatch')
        owner_arrays.append((kind, owners, pixels))
    _, frame_id, radii = NATIVE_FRAMES[plan['target']]
    lons = np.radians((np.arange(width)+.5)*360/width-180)
    lats = np.radians(90-(np.arange(height)+.5)*180/height)
    grid = np.stack(np.broadcast_arrays(np.cos(lats[:, None])*np.cos(lons),
                                       np.cos(lats[:, None])*np.sin(lons), np.sin(lats[:, None])), axis=-1)
    grid /= np.sqrt(np.square(grid/np.asarray(radii)).sum(axis=-1))[..., None]
    results, all_failures = [], []
    total_guards = [{'insetRadiansEachAxis': inset, 'retainedCandidates': 0,
                     'retainedActualOutputCandidates': 0, 'oversupportedCandidates': 0,
                     'oversupportedActualOutputCandidates': 0, 'worstDenseMarginRadians': None}
                    for inset in DEFAULT_INSETS]
    cameras = []
    for number, entry in enumerate(plan['observations'], 1):
        source = SourceCamera(root/entry['navigation'], plan['target'], independent)
        camera = navigation.Camera.from_pair(root/entry['calibrated'], root/entry['navigation'],
                    expected_target=plan['target'], expected_radii_km=radii, expected_frame_id=frame_id)
        cameras.append((entry['id'], source, camera))
        output_by_pixel = defaultdict(set)
        for kind, owners, pixels in owner_arrays:
            rows, cols = np.nonzero(owners == number)
            for row, col in zip(rows.tolist(), cols.tolist()):
                output_by_pixel[int(pixels[row, col])-1].add((row, col))
        mandatory = [source.height//2*source.side+source.side//2]
        if entry['id'] == '1568129671_1':
            mandatory += [row*source.side+x for row in (13, 14, 15, 16) for x in (20, 39)]
        selected = list(dict.fromkeys(mandatory+quantiles(sorted(output_by_pixel), args.pixels_per_observation)))
        selected = selected[:args.pixels_per_observation]
        per_cube = {'id': entry['id'], 'samplingMode': source.mode, 'selectedPixels': [], 'outputOwnedCellsByKind': {
                    kind: int((owners == number).sum()) for kind, owners, _ in owner_arrays}}
        bbox_count = 0
        for pixel in selected:
            y, x = divmod(pixel, source.side)
            footprint = camera.footprint(x, y, maximum_center_error_pixels=plan['policy']['maximumCenterErrorPixels'],
                                        aperture_policy=plan['aperturePolicy'])
            if not footprint['supported']:
                per_cube['selectedPixels'].append({'pixel': pixel, 'supported': False, 'reason': footprint['reason']})
                continue
            poses = inverse_poses(independent, source, x, y, args.poses)
            candidates = [(output_point(row, col, width, height, radii), 'actual-output') for row, col in
                          quantiles(sorted(output_by_pixel.get(pixel, ())), args.max_owned_per_pixel)]
            candidates += boundary_candidates(source, x, y)
            candidates.append((tuple(footprint['positiveSupportWitnessKilometers']), 'support-witness'))
            query = np.array([point for point, _ in candidates])
            dense = [margins_at_poses(point, poses, source, x, y) for point, _ in candidates]
            record = {'pixel': pixel, 'sampleZeroBased': x, 'lineZeroBased': y,
                      'supported': True, 'candidateCount': len(candidates), 'guards': []}
            center, _, _ = source.hit(x, y, source.time(x, y))
            expected = ellipsoid_point(source.nav[4][pixel], source.nav[5][pixel], radii)
            record['independentSourceCenterResidualDegrees'] = math.degrees(independent.angle(center, expected))
            for guard, inset in zip(total_guards, DEFAULT_INSETS):
                tested = (footprint if inset == 0 else camera.footprint(x, y,
                          maximum_center_error_pixels=plan['policy']['maximumCenterErrorPixels'],
                          aperture_policy=plan['aperturePolicy'], inset_radians=(inset, inset)))
                accepted = (converter.footprint_contains(query, tested, np.asarray(radii))
                            if tested['supported'] else np.zeros(len(candidates), dtype=bool))
                counts = dict(retainedCandidates=0, retainedActualOutputCandidates=0,
                              oversupportedCandidates=0, oversupportedActualOutputCandidates=0)
                worst = None
                for index in np.flatnonzero(accepted).tolist():
                    actual = candidates[index][1] == 'actual-output'
                    dense_margin, coarse_margin = dense[index]
                    counts['retainedCandidates'] += 1
                    counts['retainedActualOutputCandidates'] += actual
                    worst = dense_margin if worst is None else min(worst, dense_margin)
                    # Explicit arithmetic tolerance, far below candidate insets.
                    if dense_margin < -1e-13:
                        counts['oversupportedCandidates'] += 1
                        counts['oversupportedActualOutputCandidates'] += actual
                        if inset == 0 and len(all_failures) < 40:
                            all_failures.append({'cube': entry['id'], 'pixel': pixel,
                                'kind': candidates[index][1], 'pointKilometers': candidates[index][0],
                                'denseMarginRadians': dense_margin, 'coarseAngularMarginRadians': coarse_margin,
                                'oversupportCause': 'temporal-between-poses' if coarse_margin >= -1e-13
                                                     else 'corner-plane-vs-angular-aperture'})
                for key, value in counts.items():
                    guard[key] += value
                if worst is not None:
                    guard['worstDenseMarginRadians'] = (worst if guard['worstDenseMarginRadians'] is None
                                                        else min(guard['worstDenseMarginRadians'], worst))
                record['guards'].append({'insetRadiansEachAxis': inset, **counts,
                                         'worstDenseMarginRadians': worst})
            if bbox_count < args.bbox_pixels_per_observation:
                exhaustive = converter.footprint_contains(grid, footprint, np.asarray(radii))
                rows, cols = accelerator_rows_cols(np, footprint, width, height)
                accelerated = np.zeros((height, width), dtype=bool)
                accelerated[rows[:, None], cols[None, :]] = True
                dropped = np.argwhere(exhaustive & ~accelerated)
                record['wholeConfiguredGridAcceleratorCheck'] = {
                    'gridQueries': width*height, 'actualSupportedGridCenters': int(exhaustive.sum()),
                    'supportedGridCentersDropped': len(dropped), 'firstDroppedRowCol': dropped[:8].tolist()}
                bbox_count += 1
            # Fixed-seed geographic grid probes independent of the accelerated
            # list: half global, half in a generously wider native neighborhood.
            rng = random.Random(90210+number*10000+pixel)
            probe_pairs = {(rng.randrange(height), rng.randrange(width)) for _ in range(512)}
            native_lat, native_lon = source.nav[4][pixel], source.nav[5][pixel]
            base_row = round((90-native_lat)*height/180-.5)
            base_col = round(((native_lon+180)%360)*width/360-.5)
            for _ in range(512):
                row = max(0, min(height-1, base_row+rng.randint(-32, 32)))
                col = (base_col+rng.randint(-64, 64))%width
                probe_pairs.add((row, col))
            probe_pairs = sorted(probe_pairs)
            probe_query = np.array([grid[row, col] for row, col in probe_pairs])
            probe_inside = converter.footprint_contains(probe_query, footprint, np.asarray(radii))
            rows, cols = accelerator_rows_cols(np, footprint, width, height)
            row_set, col_set = set(rows.tolist()), set(cols.tolist())
            missed_probes = [probe_pairs[i] for i in np.flatnonzero(probe_inside).tolist()
                             if probe_pairs[i][0] not in row_set or probe_pairs[i][1] not in col_set]
            record['independentRandomGridAcceleratorCheck'] = {
                'seed': 90210+number*10000+pixel, 'gridQueries': len(probe_pairs),
                'supportedQueries': int(probe_inside.sum()), 'supportedQueriesDropped': len(missed_probes),
                'firstDroppedRowCol': missed_probes[:8]}
            per_cube['selectedPixels'].append(record)
        results.append(per_cube)
    # Independent known scan gap: query native surface directions between the
    # two widely separated original rows. This is intentionally not a cell fill.
    # Production footprints are checked for every native pixel in a local row
    # neighborhood. Other scans/observations can legitimately cover the gap.
    _, source, camera = cameras[0]
    gap_points = []
    for x in ((10, 20, 30, 39) if plan['target'] == 'IAPETUS' else ()):
        a = independent.ellipsoid_point(source.nav[4][14*source.side+x], source.nav[5][14*source.side+x])
        b = independent.ellipsoid_point(source.nav[4][15*source.side+x], source.nav[5][15*source.side+x])
        for fraction in (.25, .5, .75):
            direction = tuple((1-fraction)*a[k]+fraction*b[k] for k in range(3))
            lon, lat = independent.lonlat(direction)
            gap_points.append({'betweenSample': x, 'fractionFromLine14To15': fraction,
                               'longitudeLatitude': [lon, lat],
                               'pointKilometers': ellipsoid_point(lat, lon, radii), 'ownersInLocalRows': []})
    gap_query = np.array([p['pointKilometers'] for p in gap_points])
    for y in (range(12, 18) if plan['target'] == 'IAPETUS' else ()):
        for x in range(source.side):
            fp = camera.footprint(x, y, maximum_center_error_pixels=plan['policy']['maximumCenterErrorPixels'],
                                  aperture_policy=plan['aperturePolicy'])
            if not fp['supported']:
                continue
            accepted = converter.footprint_contains(gap_query, fp, np.asarray(radii))
            for index in np.flatnonzero(accepted).tolist():
                poses = inverse_poses(independent, source, x, y, args.poses)
                margin, _ = margins_at_poses(gap_points[index]['pointKilometers'], poses, source, x, y)
                gap_points[index]['ownersInLocalRows'].append({'sample': x, 'line': y,
                                                               'independentDenseMarginRadians': margin})
    positive = [g for g in total_guards if g['oversupportedCandidates'] == 0 and g['retainedActualOutputCandidates'] > 0]
    if digest(args.recipe) != recipe_digest:
        raise ValueError('Recipe changed during this audit')
    report = {'schema': 'cassini-independent-dense-detector-audit@2', 'target': plan['target'],
              'recipe': str(args.recipe), 'recipeSha256': recipe_digest, 'actualOutputPins': output_pins,
              'scriptSha256': digest(__file__), 'converterSha256': digest(converter_path),
              'navigationSha256': digest(ROOT/'tools/objects/acquisition/cassini-vims-navigation.py'),
              'gridDimensions': [width, height], 'posesPerExposure': args.poses,
              'nominalPhysicalApertureRadians': [.00025, .0005], 'angularArithmeticToleranceRadians': 1e-13,
              'observations': results, 'guardTotals': total_guards, 'oversupportExamples': all_failures,
              'smallestTestedInsetRemovingObservedOversupportRadians': positive[0]['insetRadiansEachAxis'] if positive else None,
              'scanGap': {'applicable': plan['target'] == 'IAPETUS', 'source': '1568129671_1', 'testedNeighboringRowsZeroBased': [12, 17], 'points': gap_points,
                         'qualification': 'local scan-gap probes; another source or later slew may legitimately observe the same point'},
              'limits': ['Dense temporal sampling is not a continuous-motion bound or an optical PSF calibration.',
                         'Only explicitly selected actual output/source pixels are temporally audited.',
                         'Accelerator checks exhaust the actual configured grid for explicitly selected apertures only.',
                         'No absolute ISS registration claim follows from source-camera self-consistency.'],
              'wallSeconds': time.monotonic()-started,
              'peakRssPlatformNativeUnits': resource.getrusage(resource.RUSAGE_SELF).ru_maxrss}
    args.output.write_text(json.dumps(report, indent=2, allow_nan=False)+'\n')
    print(json.dumps({'output': str(args.output), 'guardTotals': total_guards,
                      'smallestTestedInset': report['smallestTestedInsetRemovingObservedOversupportRadians'],
                      'wallSeconds': report['wallSeconds'], 'peakRssNative': report['peakRssPlatformNativeUnits']}))


if __name__ == '__main__':
    main()
