"""Independent bounded closure of final Phoebe source-map ownership/geometry.

Pins existing inputs; never generates a mesh or a source map. Tests exact
topology, origin winding, all published values and independent all-face radial
intersections. Dense geometry samples at most four output points per source
pixel, selected near angular/physical limits. No full-grid3500-face bake.
"""
import argparse
from collections import defaultdict
from fractions import Fraction
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import re
import resource
import struct
import time

ROOT = Path(__file__).resolve().parents[5]
TERRAIN_SHA = 'a6eb3c92075986288ddfc6e59d85391891ca0d96dc0f2c427ea7fbab2e576178'


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def digest(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for block in iter(lambda: stream.read(65536), b''):
            h.update(block)
    return h.hexdigest()


def topology(np, triangles):
    lookup, faces = {}, []
    for triangle in triangles:
        face = []
        for vertex in triangle:
            key = tuple(vertex)
            if key not in lookup:
                lookup[key] = len(lookup)
            face.append(lookup[key])
        faces.append(face)
    edges, links = defaultdict(list), defaultdict(lambda: defaultdict(set))
    for number, (a, b, c) in enumerate(faces):
        for x, y in ((a, b), (b, c), (c, a)):
            edges[min(x, y), max(x, y)].append((number, x, y))
        for pivot, x, y in ((a, b, c), (b, c, a), (c, a, b)):
            links[pivot][x].add(y)
            links[pivot][y].add(x)
    bad_edges = [key for key, rows in edges.items() if len(rows) != 2 or rows[0][1:] != rows[1][1:][::-1]]
    adjacent = defaultdict(set)
    for rows in edges.values():
        if len(rows) == 2:
            a, b = rows[0][0], rows[1][0]
            adjacent[a].add(b); adjacent[b].add(a)
    def connected(graph, start):
        seen, todo = set(), [start]
        while todo:
            node = todo.pop()
            if node not in seen:
                seen.add(node); todo.extend(graph[node]-seen)
        return seen
    bad_links = [vertex for vertex, link in links.items()
                 if any(len(v) != 2 for v in link.values()) or len(connected(link, next(iter(link)))) != len(link)]
    face_connected = len(connected(adjacent, 0)) == len(faces)
    a, b, c = triangles[:, 0], triangles[:, 1], triangles[:, 2]
    triple = np.einsum('ij,ij->i', a, np.cross(b, c))
    volume = float(triple.sum()/6)
    aa, bb, cc = np.linalg.norm(a, axis=1), np.linalg.norm(b, axis=1), np.linalg.norm(c, axis=1)
    denominator = aa*bb*cc+(a*b).sum(axis=1)*cc+(b*c).sum(axis=1)*aa+(c*a).sum(axis=1)*bb
    winding = float(np.arctan2(triple, denominator).sum()/(2*np.pi))
    result = {'exactCoordinateVertices': len(lookup), 'edges': len(edges), 'faces': len(faces),
              'eulerCharacteristic': len(lookup)-len(edges)+len(faces),
              'badEdgeIncidenceOrDirectionCount': len(bad_edges), 'badVertexLinkCount': len(bad_links),
              'singleFaceConnectedComponent': face_connected, 'signedVolumeCubicKm': volume,
              'originSolidAngleWindingNumber': winding,
              'qualified': not bad_edges and not bad_links and face_connected and volume > 0 and abs(winding-1) < 1e-10}
    if not result['qualified']:
        raise ValueError('Fixed mesh topology/origin-winding premise failed: '+json.dumps(result))
    return result


def all_intersections(np, triangles, origins, directions, batch=96):
    """Independent plane intersection and Gram barycentrics; all given faces.

    No production BVH/Moller-Trumbore. Distinct geometric hits merge only at
    128 float64 eps times distance, to avoid double-counting shared boundaries.
    """
    a = triangles[:, 0]; e = triangles[:, 1]-a; f = triangles[:, 2]-a
    normal = np.cross(e, f)
    plane = (normal*a).sum(axis=1)
    ee, ef, ff = (e*e).sum(axis=1), (e*f).sum(axis=1), (f*f).sum(axis=1)
    ae, af, gram = (a*e).sum(axis=1), (a*f).sum(axis=1), ee*ff-ef*ef
    count = len(directions)
    origins = np.broadcast_to(origins, (count, 3))
    nearest_face = np.full(count, -1, dtype=int)
    nearest_t = np.full(count, np.inf)
    distinct_count = np.zeros(count, dtype=int)
    for start in range(0, count, batch):
        stop = min(count, start+batch); o, d = origins[start:stop], directions[start:stop]
        denom = d @ normal.T
        t = np.full(denom.shape, np.inf)
        np.divide(plane-o @ normal.T, denom, out=t, where=denom != 0)
        usable = np.isfinite(t) & (t > 0)
        safe_t = np.where(usable, t, 0)
        re = o @ e.T-ae+safe_t*(d @ e.T)
        rf = o @ f.T-af+safe_t*(d @ f.T)
        u, v = (ff*re-ef*rf)/gram, (ee*rf-ef*re)/gram
        usable &= (u >= 0) & (v >= 0) & (u+v <= 1)
        t[~usable] = np.inf
        nearest = t.argmin(axis=1)
        nearest_t[start:stop] = t[np.arange(stop-start), nearest]
        nearest_face[start:stop] = np.where(np.isfinite(nearest_t[start:stop]), nearest, -1)
        for row, values in enumerate(t):
            hits = np.sort(values[np.isfinite(values)])
            if len(hits):
                distinct_count[start+row] = 1+int(np.sum(np.diff(hits) > 128*np.finfo(float).eps*np.maximum(1, hits[1:])))
    return nearest_face, nearest_t, distinct_count


def rotation(np, et, value):
    ra, dec = map(math.radians, (value['rightAscensionDegrees'], value['declinationDegrees']))
    w = math.radians((value['primeMeridianDegrees']+value['spinRateDegreesPerDay']*et/86400)%360)
    def rz(t):
        return np.array([[math.cos(t), math.sin(t), 0], [-math.sin(t), math.cos(t), 0], [0, 0, 1]])
    tilt = np.array([[1, 0, 0], [0, math.sin(dec), math.cos(dec)], [0, -math.cos(dec), math.sin(dec)]])
    return rz(w) @ tilt @ rz(math.pi/2+ra)


def source_poses(np, camera, pixel, plan, offsets, sun, count):
    y, x = divmod(pixel, camera.width)
    poses = []
    for n in range(count):
        fraction = n/(count-1); et = camera.pixel_time(x, y, fraction)
        body, pointing, observer = camera.state(et)
        fixed = rotation(np, et, plan['rotation'])
        observer = fixed @ np.asarray(body).T @ observer+plan['originTranslationKilometers']
        inverse = np.asarray(camera.constant) @ pointing @ fixed.T
        f = (et-sun[0, -1])/(sun[1, -1]-sun[0, -1])
        if not 0 <= f <= 1:
            raise ValueError('Independent Sun interpolation would extrapolate')
        solar = fixed @ ((1-f)*sun[0, :3]+f*sun[1, :3])+plan['originTranslationKilometers']
        poses.append((fraction, observer, solar, inverse))
    return poses


def angular_margins(np, points, inverse, observer, camera, pixel, offsets):
    y, x = divmod(pixel, camera.width)
    look = (points-observer) @ inverse.T
    phi = np.arctan2(-look[:, 2], look[:, 0])
    theta = np.arctan2(np.hypot(look[:, 0], look[:, 2]), look[:, 1])
    px, py, bx, by, ox, oy = camera.model
    fast = phi+np.pi/2-(x+ox-bx)*px-offsets[0]
    slow = np.pi/2-theta-(y+oy-by)*py-offsets[1]
    return np.minimum(.000125-np.abs(fast), .00025-np.abs(slow))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--recipe', type=Path, default=ROOT/'output/b9-source-intake/phoebe/prepare-trial.json')
    parser.add_argument('--output', type=Path, default=Path(__file__).with_name('phoebe-fixed-map-qualification.json'))
    args = parser.parse_args()
    import numpy as np
    import rasterio
    started = time.monotonic()
    plan = json.loads(args.recipe.read_text()); root = args.recipe.parent
    width, height = plan['width'], plan['height']
    if plan['target'] != 'PHOEBE' or (width, height) not in ((720, 360), (1440, 720)):
        raise ValueError('This audit supports only the historical or final modest Phoebe grid')
    recipe_sha = digest(args.recipe)
    for name, pin in plan['pins'].items():
        if digest(root/name) != pin:
            raise ValueError('Recipe source changed: '+name)
    terrain_path = root/plan['terrain']
    if digest(terrain_path) != TERRAIN_SHA:
        raise ValueError('Fixed geometry pin changed')
    raw_terrain = json.loads(terrain_path.read_text())
    triangles = np.array([face['vertices'] for face in raw_terrain['faces']])*(106.5/230)
    topology_report = topology(np, triangles)
    fixed = load('mesh_subject', ROOT/'tools/objects/acquisition/cassini-fixed-mesh.py')
    nav = load('qualified_source_camera', ROOT/'tools/objects/acquisition/cassini-vims-navigation.py')
    mesh = fixed.FixedMesh(triangles)
    inputs, all_owned, output_reports = {}, set(), []
    arrays = []
    for kind in ('depth', 'rgb'):
        path = root/plan['outputs'][kind]
        audit_paths = [path, path.with_name(path.stem+'-observation.tif'), path.with_name(path.stem+'-source-pixel.tif')]
        for p in audit_paths:
            inputs[str(p)] = {'sha256': digest(p), 'bytes': p.stat().st_size}
        with rasterio.open(path) as src:
            data, transform, crs, missing = src.read(), src.transform, src.crs.to_dict(), src.nodata
        with rasterio.open(audit_paths[1]) as src:
            owners = src.read(1)
        with rasterio.open(audit_paths[2]) as src:
            pixels = src.read(1)
        if (owners.shape != (height, width) or pixels.shape != owners.shape or crs.get('proj') != 'eqc'
                or transform.b != 0 or transform.d != 0 or np.any((owners == 0) != (pixels == 0))):
            raise ValueError('Unexpected output map ownership or transform')
        absent = owners == 0
        if not np.all(data[:, absent] == missing):
            raise ValueError('An unowned output carries published values')
        if np.any(data[:, ~absent] == missing) or not np.isfinite(data[:, ~absent]).all():
            raise ValueError('An owned output is missing or nonfinite')
        if np.any(owners > len(plan['observations'])):
            raise ValueError('Output owner does not identify a recipe observation')
        rows, cols = np.nonzero(~absent)
        all_owned.update(zip(rows.tolist(), cols.tolist()))
        arrays.append((kind, data, owners, pixels))
    coordinates = sorted(all_owned)
    rows, cols = np.array(coordinates).T
    radius = plan['radiusMeters']
    lon = np.degrees((transform.c+(cols+.5)*transform.a)/radius)+crs['lon_0']
    lat = np.degrees((transform.f+(rows+.5)*transform.e)/radius)
    directions = np.stack((np.cos(np.radians(lat))*np.cos(np.radians(lon)),
                           np.cos(np.radians(lat))*np.sin(np.radians(lon)), np.sin(np.radians(lat))), axis=1)
    face, distance, intersections = all_intersections(np, triangles, np.zeros(3), directions)
    radial = mesh.intersect(np.zeros(3), directions)
    if (np.any(face != radial['face']) or np.any(intersections != 1)
            or not np.allclose(distance, radial['distance'], atol=1e-9, rtol=0)):
        raise ValueError('A published direction is ambiguous or disagrees with independent closest-ray geometry')
    points = distance[:, None]*directions
    normals = mesh.normals[face]
    lookup = {pair: n for n, pair in enumerate(coordinates)}
    inward = np.einsum('ij,ij->i', mesh.normals, triangles.mean(axis=1)) <= 0
    grid_lon = np.degrees((transform.c+(np.arange(width)+.5)*transform.a)/radius)+crs['lon_0']
    grid_lat = np.degrees((transform.f+(np.arange(height)+.5)*transform.e)/radius)
    grid_rays = np.stack(np.broadcast_arrays(np.cos(np.radians(grid_lat[:, None]))*np.cos(np.radians(grid_lon)),
                         np.cos(np.radians(grid_lat[:, None]))*np.sin(np.radians(grid_lon)), np.sin(np.radians(grid_lat[:, None]))), axis=-1)
    # Only the one/few inward facets see this full modest grid, never3500faces.
    if np.any(inward):
        _, _, inward_hits = all_intersections(np, triangles[inward], np.zeros(3), grid_rays.reshape(-1, 3), batch=1024)
        ambiguous = inward_hits.reshape(height, width) > 0
    else:
        ambiguous = np.zeros((height, width), dtype=bool)
    for _, _, owners, _ in arrays:
        if np.any(owners[ambiguous] != 0):
            raise ValueError('An ambiguous geographic direction is painted')
    dense_rows, dense_origins, dense_suns, dense_points, dense_normals, dense_margins = [], [], [], [], [], []
    for number, entry in enumerate(plan['observations'], 1):
        camera = nav.Camera.from_pair(root/entry['calibrated'], root/entry['navigation'], expected_target='PHOEBE',
                  expected_radii_km=(115., 110., 105.), expected_frame_id=10047, ray_only=True)
        region = json.loads((root/entry['region']).read_text())
        offsets = region['fitOffsetsRadians']; mask = np.array(region['nativePixelMask'])
        raw = (root/entry['navigation']).read_bytes(); label = raw[:65536].decode('ascii').rstrip('\0')
        table = next(t for t in re.findall(r'Object\s*=\s*Table\s*\n(.*?)End_Object', label, re.S)
                     if nav._field(t, 'Name') == 'SunPosition')
        start, size = int(nav._field(table, 'StartByte'))-1, int(nav._field(table, 'Bytes'))
        sun_bytes = raw[start:start+size]
        if hashlib.sha256(sun_bytes).hexdigest() != region['sunTableSha256']:
            raise ValueError('Sun source changed')
        sun = np.array(list(struct.iter_unpack('<7d', sun_bytes)))
        n = camera.width*camera.height
        bands = sorted(set(plan['channels']['depth']+plan['channels']['rgb']))
        source_values = {}
        with (root/entry['calibrated']).open('rb') as stream:
            for band in bands:
                stream.seek(65536+(band-1)*n*4)
                source_values[band] = np.array(struct.unpack('<'+'f'*n, stream.read(n*4)), dtype='float32')
        left, middle, right = plan['channels']['depth']
        wavelengths = entry['wavelengthsMicrometers']
        weight = float((Fraction(str(wavelengths[str(middle)]))-Fraction(str(wavelengths[str(left)])))/
                       (Fraction(str(wavelengths[str(right)]))-Fraction(str(wavelengths[str(left)]))))
        a, b, c = [source_values[band].astype(float) for band in (left, middle, right)]
        expected_depth = (1-b/(a*(1-weight)+c*weight)).astype('float32')
        owned_by_pixel = defaultdict(set)
        for kind, data, owners, pixels in arrays:
            take = owners == number; r, c = np.nonzero(take); native = pixels[take].astype(int)-1
            if np.any(native < 0) or np.any(native >= n) or not np.all(mask[native]):
                raise ValueError('Output refers outside the qualified source region')
            expected = (expected_depth[native][None, :] if kind == 'depth'
                        else np.array([source_values[band][native] for band in plan['channels']['rgb']]))
            if not np.array_equal(data[:, take].view('uint32'), expected.view('uint32')):
                raise ValueError('Output values are not the unchanged declared source-owner values')
            output_reports.append({'observation': entry['id'], 'kind': kind, 'ownedOutputCells': len(native),
                                   'distinctOriginalPixels': int(np.unique(native).size), 'exactFloat32ValueMismatches': 0})
            for row, col, pixel in zip(r.tolist(), c.tolist(), native.tolist()):
                owned_by_pixel[pixel].add(lookup[row, col])
        for pixel, indices in owned_by_pixel.items():
            ix = np.array(sorted(indices)); q, normal = points[ix], normals[ix]
            coarse_boundary = np.full(len(ix), np.inf); coarse_physical = np.full(len(ix), np.inf)
            for _, observer, solar, inverse in source_poses(np, camera, pixel, plan, offsets, sun, 9):
                coarse_boundary = np.minimum(coarse_boundary, angular_margins(np, q, inverse, observer, camera, pixel, offsets))
                view, light = observer-q, solar-q
                view /= np.linalg.norm(view, axis=1)[:, None]; light /= np.linalg.norm(light, axis=1)[:, None]
                coarse_physical = np.minimum(coarse_physical, np.minimum((normal*view).sum(axis=1), (normal*light).sum(axis=1))-.5)
            selected = list(dict.fromkeys([int(coarse_boundary.argmin()), int(coarse_physical.argmin()), 0, len(ix)-1]))
            chosen = ix[selected]; q, normal = points[chosen], normals[chosen]
            for fraction, observer, solar, inverse in source_poses(np, camera, pixel, plan, offsets, sun, 129):
                dense_rows.extend({'pixel': int(pixel), 'outputRowCol': coordinates[int(i)], 'fraction': fraction} for i in chosen)
                dense_origins.extend([observer]*len(q)); dense_suns.extend([solar]*len(q))
                dense_points.extend(q); dense_normals.extend(normal)
                dense_margins.extend(angular_margins(np, q, inverse, observer, camera, pixel, offsets).tolist())
    q, normal = np.array(dense_points), np.array(dense_normals)
    observer, solar = np.array(dense_origins), np.array(dense_suns)
    view, light = observer-q, solar-q
    view /= np.linalg.norm(view, axis=1)[:, None]; light /= np.linalg.norm(light, axis=1)[:, None]
    physical_margin = np.minimum((normal*view).sum(axis=1), (normal*light).sum(axis=1))-.5
    visible_hits = mesh.intersect(observer, -view)
    visible_error = np.linalg.norm(visible_hits['point']-q, axis=1)
    shadow = mesh.intersect(q+normal*1e-7, light)['face'] >= 0
    aperture_fail = np.array(dense_margins) < -1e-13
    physical_fail = physical_margin < -1e-12
    visibility_fail = ~(visible_error <= 1e-6)
    failing = aperture_fail | physical_fail | visibility_fail | shadow
    examples = [{**dense_rows[i], 'nominalApertureMarginRadians': dense_margins[i],
                 'incidenceEmissionCosineMargin': float(physical_margin[i]),
                 'visibilityEndpointErrorKm': float(visible_error[i]), 'shadowed': bool(shadow[i])}
                for i in np.flatnonzero(failing)[:24]]
    if digest(terrain_path) != TERRAIN_SHA or digest(args.recipe) != recipe_sha:
        raise ValueError('Fixed input changed during audit')
    report = {'schema': 'phoebe-independent-fixed-map-qualification@1', 'recipeSha256': recipe_sha,
              'sourceGrid': {'width': width, 'height': height, 'referenceRadiusMeters': radius,
                             'centerLongitude': crs['lon_0']},
              'scriptSha256': digest(__file__), 'terrainSha256': TERRAIN_SHA,
              'mapperSha256': digest(ROOT/'tools/objects/acquisition/cassini-phoebe-surfaces.py'), 'actualOutputPins': inputs,
              'topology': topology_report, 'radialGeometry': {'allPublishedDirections': len(coordinates),
                'independentlyCheckedFacesPerDirection': len(triangles), 'multipleIntersectionPublishedDirections': int((intersections != 1).sum()),
                'closestFaceDisagreements': int((face != radial['face']).sum()),
                'maximumClosestDistanceDifferenceKm': float(np.max(np.abs(distance-radial['distance']))),
                'inwardRadialFaces': int(inward.sum()), 'independentAmbiguousGridCells': int(ambiguous.sum()),
                'ambiguousGridRowCol': np.argwhere(ambiguous).tolist(), 'ambiguousCellsPainted': 0},
              'outputOwnership': output_reports, 'denseGeometry': {'posesPerExposure': 129,
                'selectedOutputPoints': len(dense_rows)//129, 'pointPoseChecks': len(dense_rows),
                'nominalApertureFailures': int(aperture_fail.sum()), 'incidenceEmissionFailures': int(physical_fail.sum()),
                'visibilityFailures': int(visibility_fail.sum()), 'shadowFailures': int(shadow.sum()),
                'minimumNominalApertureMarginRadians': min(dense_margins), 'minimumIncidenceEmissionCosineMargin': float(physical_margin.min()),
                'maximumVisibilityEndpointErrorKm': float(np.nanmax(visible_error)), 'examples': examples},
              'limits': ['Closed consistent manifold, positive volume and origin winding establish the stated crossing argument; no general self-intersection/optical-PSF proof is claimed.',
                         'All published radial rays were independently checked against all faces; dense exposure tests use the stated bounded candidate selection.',
                         'Frame/clock interpolation uses the already source-qualified camera; angular inversion and radial ownership checks are independent of the mapper.',
                         'Dense poses do not prove continuous-time support or improve the fitted absolute-placement bound.'],
              'wallSeconds': time.monotonic()-started, 'peakRssBytesMacOS': resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,
              'qualifiedUnderStatedChecks': not bool(failing.any())}
    args.output.write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps({k: report[k] for k in ('topology', 'radialGeometry', 'outputOwnership', 'denseGeometry', 'wallSeconds', 'peakRssBytesMacOS', 'qualifiedUnderStatedChecks')}, indent=2))


if __name__ == '__main__':
    main()
