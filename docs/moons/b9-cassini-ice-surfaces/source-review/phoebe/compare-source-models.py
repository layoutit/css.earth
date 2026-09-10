"""Compare pinned Phoebe models without modifying either model or prepared scene.

Run with OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 output/b9-python/bin/python
docs/moons/b9-cassini-ice-surfaces/source-review/phoebe/compare-source-models.py
from the worktree root. Only the JSON evidence beside this script is written.
"""
import hashlib
import json
from pathlib import Path
import resource
import time

import numpy as np
from scipy.spatial import cKDTree

START = time.monotonic()
ROOT = Path(__file__).resolve().parents[5]
SOURCE = ROOT / 'src/planets/phoebe/source'
OUT = Path(__file__).with_name('source-model-comparison.json')
COUNT = 99846
FACES = 196608


def sha(path):
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1 << 20), b''):
            h.update(block)
    return h.hexdigest()


def stats(x):
    x = np.asarray(x, dtype=float)
    return {'count': int(x.size), 'min': float(x.min()), 'median': float(np.median(x)),
            'p90': float(np.quantile(x, .90)), 'p95': float(np.quantile(x, .95)),
            'p99': float(np.quantile(x, .99)), 'max': float(x.max()),
            'mean': float(x.mean()), 'rms': float(np.sqrt(np.mean(x*x)))}


def normalize(x):
    return x / np.linalg.norm(x, axis=-1)[..., None]


def angles(a, b):
    return np.degrees(np.arccos(np.clip(np.sum(normalize(a)*normalize(b), axis=-1), -1, 1)))


def robust_translation(delta):
    t = np.median(delta, axis=0)
    for _ in range(12):
        residual = np.linalg.norm(delta-t, axis=1)
        scale = max(.005, 3*float(np.median(residual)))
        weights = np.minimum(1, scale/np.maximum(residual, 1e-15))
        t = np.sum(delta*weights[:, None], axis=0)/weights.sum()
    return t


def read_quality(path):
    with path.open('rb') as stream:
        label = stream.read(65536).decode('latin1').split('\nEnd\n')[0]
    assert 'Samples = 360' in label and 'Lines   = 180' in label
    assert 'BandSequential' in label and 'PositiveEast' in label and 'Planetocentric' in label
    return np.fromfile(path, dtype='<f4', count=360*180, offset=65536).reshape(180, 360)


def closest_on_triangles(points, triangle, return_details=False):
    # Points: (batch,3); triangles: (batch,k,3,3). Project onto each triangle
    # plane and its three segments; the minimum is the exact closest point.
    p = points[:, None, :]
    a, b, c = [triangle[:, :, k, :] for k in range(3)]
    ab, ac, ap = b-a, c-a, p-a
    d00, d01, d11 = [np.sum(x*y, axis=2) for x, y in [(ab, ab), (ab, ac), (ac, ac)]]
    d20, d21 = np.sum(ap*ab, axis=2), np.sum(ap*ac, axis=2)
    den = d00*d11-d01*d01
    u, v = (d11*d20-d01*d21)/den, (d00*d21-d01*d20)/den
    interior = (u >= 0) & (v >= 0) & (u+v <= 1)
    projected = a+u[:, :, None]*ab+v[:, :, None]*ac
    distance2 = np.where(interior, np.sum((p-projected)**2, axis=2), np.inf)
    closest = projected.copy()
    for x, y in [(a, b), (b, c), (c, a)]:
        edge = y-x
        w = np.clip(np.sum((p-x)*edge, axis=2)/np.sum(edge*edge, axis=2), 0, 1)
        edge_point = x+w[:, :, None]*edge
        edge2 = np.sum((p-edge_point)**2, axis=2)
        closest = np.where((edge2 < distance2)[:, :, None], edge_point, closest)
        distance2 = np.minimum(distance2, edge2)
    best_index = np.argmin(distance2, axis=1)
    rows = np.arange(len(points))
    distance = np.sqrt(distance2[rows, best_index])
    if return_details:
        return distance, closest[rows, best_index], normalize(np.cross(ab, ac)[rows, best_index])
    return distance


def surface_correspondence(points, vertex, facet, tree, max_face_radius):
    distance = np.empty(len(points)); closest = np.empty_like(points); normal = np.empty_like(points)
    for start in range(0, len(points), 128):
        p = points[start:start+128]
        d, idx = tree.query(p, k=64, workers=1)
        best, cp, n = closest_on_triangles(p, vertex[facet[idx]], return_details=True)
        good = d[:, -1]-max_face_radius > best
        if np.any(~good):
            d2, idx2 = tree.query(p[~good], k=512, workers=1)
            best2, cp2, n2 = closest_on_triangles(p[~good], vertex[facet[idx2]], return_details=True)
            best[~good], cp[~good], n[~good] = best2, cp2, n2
            good[~good] = d2[:, -1]-max_face_radius > best2
        assert good.all(), 'Uncertified surface correspondence cannot drive refinement'
        stop = start+len(p)
        distance[start:stop], closest[start:stop], normal[start:stop] = best, cp, n
    return distance, closest, normal


def surface_distance(points, vertex, facet, tree, max_face_radius):
    result = np.empty(len(points)); certified = np.zeros(len(points), dtype=bool)
    for start in range(0, len(points), 128):
        p = points[start:start+128]
        d, idx = tree.query(p, k=64, workers=1)
        best = closest_on_triangles(p, vertex[facet[idx]])
        good = d[:, -1]-max_face_radius > best
        if np.any(~good):
            # This increases only the bounded neighborhood of unresolved queries.
            d2, idx2 = tree.query(p[~good], k=512, workers=1)
            best[~good] = closest_on_triangles(p[~good], vertex[facet[idx2]])
            good[~good] = d2[:, -1]-max_face_radius > best[~good]
        result[start:start+len(p)] = best
        certified[start:start+len(p)] = good
    return {'distanceKm': stats(result), 'certifiedExactNearestTriangle': int(certified.sum()),
            'queryCount': len(points), 'uncertifiedAreUpperBounds': int((~certified).sum())}


manifest = json.loads((SOURCE/'manifest.json').read_text())
records = {x['path']: x for seq in manifest.values() if isinstance(seq, list)
           for x in seq if isinstance(x, dict) and 'path' in x}
paths = ['shape/phoebe_ver128q.tab', 'shape/2023/phoebe_128_o.obj',
         'science/2023/phoebe_bestmap_c.cub', 'science/2023/phoebe_numimg_c.cub']
pins = []
for relative in paths:
    path = SOURCE/relative; expected = records[relative]; actual_sha = sha(path)
    assert actual_sha == expected['expectedSha256'], relative
    assert path.stat().st_size == expected['expectedBytes'], relative
    pins.append({'path': relative, 'bytes': path.stat().st_size, 'sha256': actual_sha})

old = np.loadtxt(SOURCE/paths[0], skiprows=1, max_rows=COUNT, usecols=(1, 2, 3), dtype='f8')
new = np.loadtxt(SOURCE/paths[1], max_rows=COUNT, usecols=(1, 2, 3), dtype='f8')
facet = np.loadtxt(SOURCE/paths[1], skiprows=COUNT, max_rows=FACES, usecols=(1, 2, 3), dtype='i4')-1
assert old.shape == new.shape == (COUNT, 3) and facet.shape == (FACES, 3)
assert np.isfinite(old).all() and np.isfinite(new).all()
assert facet.min() >= 0 and facet.max() < COUNT

index = np.arange(COUNT); i = index % 129; j = (index//129) % 129; face = index//(129*129)
interior = (i > 0) & (i < 128) & (j > 0) & (j < 128)
lon = np.degrees(np.arctan2(new[:, 1], new[:, 0])) % 360
lat = np.degrees(np.arcsin(new[:, 2]/np.linalg.norm(new, axis=1)))
row = np.clip(np.floor(90-lat).astype(int), 0, 179)
column = np.clip(np.floor(lon).astype(int), 0, 359)
best_map = read_quality(SOURCE/paths[2])[row, column]
num_images = read_quality(SOURCE/paths[3])[row, column]
quality = interior & (np.abs(lat) < 60) & (num_images >= 5) & (num_images < 9999) & (best_map > 0) & (best_map <= 1500)

# Coarse disjoint geographic patches, with 2-degree guard strips between them.
lon_bin = (lon//30).astype(int); lat_bin = ((lat+60)//20).astype(int)
guard = (lon % 30 > 2) & (lon % 30 < 28) & ((lat+60) % 20 > 2) & ((lat+60) % 20 < 18)
patch = lat_bin*12+lon_bin
fold = (lon_bin+2*lat_bin) % 3
eligible = np.where(quality & guard)[0]
# No patch receives more than 200 original vertices; all choices are deterministic.
selected = []
for key in sorted(set(patch[eligible])):
    members = eligible[patch[eligible] == key]
    if len(members) >= 12:
        positions = np.linspace(0, len(members)-1, min(200, len(members)), dtype=int)
        selected.extend(members[positions])
selected = np.array(selected, dtype=int)
training = selected[fold[selected] == 0]
holdout1 = selected[fold[selected] == 1]
holdout2 = selected[fold[selected] == 2]
assert min(len(training), len(holdout1), len(holdout2)) >= 100

delta = new-old
translation = robust_translation(delta[training])
vertex_tree = cKDTree(new)
center = (new[facet[:, 0]]+new[facet[:, 1]]+new[facet[:, 2]])/3
face_radius = np.zeros(len(facet))
for k in range(3):
    face_radius = np.maximum(face_radius, np.linalg.norm(new[facet[:, k]]-center, axis=1))
center_tree = cKDTree(center)

# A rigid fit is diagnostic only. It is never applied to a source or scene.
x, y = old[training], new[training]
xc, yc = x.mean(axis=0), y.mean(axis=0)
U, singular_values, Vt = np.linalg.svd((x-xc).T@(y-yc))
R = Vt.T@U.T
if np.linalg.det(R) < 0:
    Vt[-1] *= -1; R = Vt.T@U.T
rigid_translation = yc-R@xc
rotation_angle = float(np.degrees(np.arccos(np.clip((np.trace(R)-1)/2, -1, 1))))

def evaluate(ids):
    moved = old[ids]+translation
    distance, nearest = vertex_tree.query(moved, k=2, workers=1)
    # Equal-index agreement is tested against spatial nearest neighbors, not assumed.
    indexed = np.linalg.norm(moved-new[ids], axis=1)
    old_i = old[ids+1]-old[ids-1]; new_i = new[ids+1]-new[ids-1]
    old_j = old[ids+129]-old[ids-129]; new_j = new[ids+129]-new[ids-129]
    normals_old = np.cross(old_i, old_j); normals_new = np.cross(new_i, new_j)
    tangential_residual = (moved-new[ids])-normalize(normals_new)*np.sum((moved-new[ids])*normalize(normals_new), axis=1)[:, None]
    # Surface check uses at most 1200 geographically ordered points per partition.
    surface_ids = ids[np.linspace(0, len(ids)-1, min(1200, len(ids)), dtype=int)]
    return {'count': len(ids), 'patchCount': len(set(patch[ids])),
            'longitudeDegrees': [float(lon[ids].min()), float(lon[ids].max())],
            'latitudeDegrees': [float(lat[ids].min()), float(lat[ids].max())],
            'rawEqualIndexDistanceKm': stats(np.linalg.norm(old[ids]-new[ids], axis=1)),
            'translatedEqualIndexDistanceKm': stats(indexed),
            'directionDifferenceDegreesAfterTranslation': stats(angles(moved, new[ids])),
            'nearestVertexIsSameRecord': int(np.sum(nearest[:, 0] == ids)),
            'nearestVertexDistanceKm': stats(distance[:, 0]),
            'secondNeighborSeparationKm': stats(distance[:, 1]-distance[:, 0]),
            'localINeighborhoodAngleDegrees': stats(angles(old_i, new_i)),
            'localJNeighborhoodAngleDegrees': stats(angles(old_j, new_j)),
            'localNormalDifferenceDegrees': stats(angles(normals_old, normals_new)),
            'tangentialResidualKm': stats(np.linalg.norm(tangential_residual, axis=1)),
            'rigidFitEqualIndexDistanceKm': stats(np.linalg.norm(old[ids]@R.T+rigid_translation-new[ids], axis=1)),
            'sourceSurfaceIdentity': surface_distance(old[surface_ids], new, facet, center_tree, float(face_radius.max())),
            'sourceSurfaceTranslated': surface_distance(old[surface_ids]+translation, new, facet, center_tree, float(face_radius.max()))}

patch_fit = []
for key in sorted(set(patch[selected])):
    ids = selected[patch[selected] == key]; t = robust_translation(delta[ids])
    patch_fit.append({'patch': int(key), 'partition': int(fold[ids[0]]), 'count': len(ids),
                      'translationKm': t.tolist(), 'normKm': float(np.linalg.norm(t)),
                      'departureFromTrainingTranslationKm': float(np.linalg.norm(t-translation))})

result = {
    'schema': 'cssearth-phoebe-source-model-comparison@1',
    'scope': 'Source-coordinate registration assessment only. Neither source model nor mounted geometry is changed. Does not qualify VIMS pointing or native detector coverage.',
    'sourcePins': pins, 'numpyVersion': np.__version__,
    'method': {'qualityMask': '2023 source numimg>=5, numimg<9999, 0<bestmap<=1500m; abs(lat)<60; interior ICQ records only',
               'partition': '30-degree longitude by 20-degree latitude patches; 2-degree guard strips; (lonBin+2*latBin)%3; train=0, disjoint holdouts=1,2',
               'sampling': 'At most 200 deterministic original vertex records per patch; at most1200 nearest-triangle queries per partition',
               'fit': 'Robust translation from training candidate record displacements; independent KD-tree nearest-vertex, local-neighborhood and exact-triangle distance checks afterward',
               'surfaceDistance': 'Closest points on original 2023 source triangles; KD-tree centroid candidates; certify nearest using global triangle bounding radius, enlarge neighborhood from64 to512 when needed',
               'limits': 'Same-record candidates are not assumed identical physical points. Shape changes remain residuals. Geographic heldouts measure registration transferability, not source-author exact displacement or spacecraft pointing.'},
    'qualityEligibleVertexCount': int(quality.sum()), 'guardedSelectedCount': len(selected),
    'estimatedOldTo2023TranslationKm': translation.tolist(), 'estimatedTranslationNormKm': float(np.linalg.norm(translation)),
    'differenceFromDocumented1_03Km': float(np.linalg.norm(translation)-1.03),
    'rawAllInteriorDisplacementKm': stats(np.linalg.norm(delta[interior], axis=1)),
    'translatedAllInteriorResidualKm': stats(np.linalg.norm(delta[interior]-translation, axis=1)),
    'rotationSensitivity': {'fitUsesTrainingOnly': True, 'rotationAngleDegrees': rotation_angle,
                            'matrix': R.tolist(), 'translationKm': rigid_translation.tolist(),
                            'translationDifferenceKm': float(np.linalg.norm(rigid_translation-translation)),
                            'spatialSingularValues': singular_values.tolist()},
    'training': evaluate(training), 'holdout1': evaluate(holdout1), 'holdout2': evaluate(holdout2),
    'perPatchIndependentFits': patch_fit,
    'timingSeconds': time.monotonic()-START,
    'peakRssBytesMacOS': resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,
}

# One independently motivated refinement: fit only translation to actual source
# triangle surfaces. The geographic holdouts never influence this optimization.
refined = translation.copy(); iterations = []
for iteration in range(12):
    moved = old[training]+refined
    distance, cp, normals = surface_correspondence(moved, new, facet, center_tree, float(face_radius.max()))
    signed = np.sum((moved-cp)*normals, axis=1)
    huber = max(.01, 3*float(np.median(np.abs(signed))))
    weight = np.minimum(1, huber/np.maximum(np.abs(signed), 1e-15))
    a = normals*np.sqrt(weight)[:, None]; rhs = -signed*np.sqrt(weight)
    step, _, rank, sv = np.linalg.lstsq(a, rhs, rcond=None)
    assert rank == 3 and np.isfinite(step).all()
    refined += step
    iterations.append({'iteration': iteration, 'translationKm': refined.tolist(),
                       'stepKm': step.tolist(), 'stepNormKm': float(np.linalg.norm(step)),
                       'huberThresholdKm': huber, 'normalSystemCondition': float(sv[0]/sv[-1]),
                       'preStepAbsoluteNormalResidualKm': stats(np.abs(signed))})
    if np.linalg.norm(step) < 1e-6:
        break

_, cp, normals = surface_correspondence(old[training]+refined, new, facet, center_tree, float(face_radius.max()))
signed = np.sum((old[training]+refined-cp)*normals, axis=1)
huber = max(.01, 3*float(np.median(np.abs(signed))))
weights = np.minimum(1, huber/np.maximum(np.abs(signed), 1e-15))
leave_patch = []
for key in sorted(set(patch[training])):
    keep = patch[training] != key
    a = normals[keep]*np.sqrt(weights[keep])[:, None]
    step, _, _, sv = np.linalg.lstsq(a, -signed[keep]*np.sqrt(weights[keep]), rcond=None)
    leave_patch.append({'omittedTrainingPatch': int(key), 'linearizedShiftKm': step.tolist(),
                        'linearizedShiftNormKm': float(np.linalg.norm(step)),
                        'normalSystemCondition': float(sv[0]/sv[-1])})

refined_checks = {}
for key, ids in [('training', training), ('holdout1', holdout1), ('holdout2', holdout2)]:
    # Exactly the same source records and geographic partitions as stage one.
    surface_ids = ids[np.linspace(0, len(ids)-1, min(1200, len(ids)), dtype=int)]
    refined_checks[key] = {
        'count': len(ids), 'sameRecordResidualKm': stats(np.linalg.norm(old[ids]+refined-new[ids], axis=1)),
        'sourceSurface': surface_distance(old[surface_ids]+refined, new, facet, center_tree, float(face_radius.max()))}

result['surfaceRefinement'] = {
    'method': 'Training-only robust point-to-plane translation with updated certified nearest original triangles, at most12 iterations. No rotation or scale fitted. Geographic holdouts unchanged.',
    'translationKm': refined.tolist(), 'normKm': float(np.linalg.norm(refined)),
    'differenceFromDocumented1_03Km': float(np.linalg.norm(refined)-1.03),
    'differenceFromCandidateRecordFitKm': float(np.linalg.norm(refined-translation)),
    'iterations': iterations, 'linearizedLeaveOneTrainingPatchOut': leave_patch,
    'linearizedPatchSensitivityIsNotPhysicalErrorBound': True, 'checks': refined_checks}
result['timingSeconds'] = time.monotonic()-START
result['peakRssBytesMacOS'] = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
OUT.write_text(json.dumps(result, indent=2)+'\n')
print(json.dumps({k: result[k] for k in ['estimatedOldTo2023TranslationKm','estimatedTranslationNormKm','differenceFromDocumented1_03Km','rotationSensitivity','timingSeconds','peakRssBytesMacOS']}, indent=2))
for key in ['training','holdout1','holdout2']:
    r = result[key]
    print(key, json.dumps({k:r[k] for k in ['count','patchCount','nearestVertexIsSameRecord','translatedEqualIndexDistanceKm','tangentialResidualKm','sourceSurfaceIdentity','sourceSurfaceTranslated','rigidFitEqualIndexDistanceKm']}))
print('REFINED', json.dumps({k:result['surfaceRefinement'][k] for k in ['translationKm','normKm','differenceFromDocumented1_03Km','differenceFromCandidateRecordFitKm','checks']}, indent=2))
