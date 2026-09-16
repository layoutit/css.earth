#!/usr/bin/env python3
"""Offline, reproducible display-image star registration; never prepares diffuse assets.

Requires numpy, scipy, OpenCV, astropy. Run with --help. Centroid maps are written
before registration. SIFT descriptors see positive high-pass point-source structure,
never the diffuse image. Final held-out positions do not participate in final fitting;
source identities are found using a common descriptor seed (stated in the receipt).
"""
import argparse
import hashlib
import json
import sys
from pathlib import Path

import cv2
import numpy as np
from astropy.wcs import WCS
from scipy.ndimage import maximum_filter
from scipy.spatial import ConvexHull, cKDTree

CONVENTION = ('Zero-based top-left raster pixel centres; edges at -.5 and size-.5. '
              'Resize: x_native=(x_work+.5)*native_width/work_width-.5, likewise y. '
              'AVM/FITS: x_fits=(x_native+.5)*reference_width/native_width+.5; '
              'y_fits=reference_height+.5-(y_native+.5)*reference_height/native_height. '
              'Row-major homography maps source native centres to reference native centres.')


def sha(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for block in iter(lambda: f.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def dump(path, data):
    Path(path).write_text(json.dumps(data, indent=2) + '\n')


def resize_matrix(shape_from, shape_to):
    sy, sx = np.array(shape_to[:2]) / np.array(shape_from[:2])
    return np.array([[sx, 0, (sx - 1) / 2], [0, sy, (sy - 1) / 2], [0, 0, 1.]])


def transform(points, h):
    return cv2.perspectiveTransform(np.asarray(points, float)[:, None], h)[:, 0]


def wcs(rec):
    w = WCS(naxis=2)
    w.wcs.crpix = rec['referencePixel']
    w.wcs.crval = rec['referenceValueDeg']
    w.wcs.ctype = ['RA---TAN', 'DEC--TAN']
    r = np.deg2rad(rec['rotationDeg'])
    w.wcs.cd = np.array([[np.cos(r), -np.sin(r)], [np.sin(r), np.cos(r)]]) @ np.diag(rec['scaleDeg'])
    return w


def tosky(points, rec, shape):
    p = np.asarray(points).copy()
    p[:, 0] = (p[:, 0] + .5) * rec['referenceDimension'][0] / shape[1] + .5
    p[:, 1] = rec['referenceDimension'][1] + .5 - (p[:, 1] + .5) * rec['referenceDimension'][1] / shape[0]
    return wcs(rec).all_pix2world(p, 1)


def topix(sky, rec, shape):
    p = wcs(rec).all_world2pix(sky, 1)
    p[:, 0] = (p[:, 0] - .5) * shape[1] / rec['referenceDimension'][0] - .5
    p[:, 1] = (rec['referenceDimension'][1] + .5 - p[:, 1]) * shape[0] / rec['referenceDimension'][1] - .5
    return p


def load(path, maxdim):
    im = cv2.imread(str(path), cv2.IMREAD_COLOR)
    if im is None:
        raise ValueError('Unreadable image: ' + str(path))
    native = im.shape
    scale = min(1., maxdim / max(native[:2]))
    if scale < 1:
        im = cv2.resize(im, (round(native[1] * scale), round(native[0] * scale)), interpolation=cv2.INTER_AREA)
    return im, native


def extract(im):
    g = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY).astype(np.float32)
    hp = np.maximum(g - cv2.GaussianBlur(g, (0, 0), 4), 0)
    yy, xx = np.where((hp == maximum_filter(hp, size=7)) & (hp > 7))
    order = np.argsort(hp[yy, xx])[::-1][:70000]
    out = []
    gy, gx = np.mgrid[-2:3, -2:3]
    for i in order:
        x, y = xx[i], yy[i]
        if x < 5 or y < 5 or x >= g.shape[1] - 5 or y >= g.shape[0] - 5:
            continue
        patch = hp[y - 2:y + 3, x - 2:x + 3]
        total = patch.sum()
        out.append([float(x + (patch * gx).sum() / total), float(y + (patch * gy).sum() / total), float(hp[y, x])])
    return np.array(out), hp


def seed(source_hp, reference_hp):
    # Descriptor pixels contain compact point sources only, with low-frequency light removed.
    def shrink(hp):
        scale = min(1, 2600 / max(hp.shape))
        return cv2.resize((hp.clip(0, 100) * 2.55).astype('uint8'),
                          (round(hp.shape[1] * scale), round(hp.shape[0] * scale)), interpolation=cv2.INTER_AREA)
    a, b = shrink(reference_hp), shrink(source_hp)
    sift = cv2.SIFT_create(nfeatures=40000, contrastThreshold=.008)
    ka, da = sift.detectAndCompute(a, None)
    kb, db = sift.detectAndCompute(b, None)
    pairs = cv2.BFMatcher().knnMatch(db, da, k=2)
    matches = [m for m, n in pairs if m.distance < .8 * n.distance]
    x = np.array([kb[m.queryIdx].pt for m in matches])
    y = np.array([ka[m.trainIdx].pt for m in matches])
    if len(matches) < 20:
        raise ValueError('Too few independent point-field descriptors')
    h, mask = cv2.findHomography(x, y, cv2.RANSAC, 3, maxIters=50000, confidence=.999)
    if h is None or mask.sum() < 25:
        raise ValueError('No coherent star-field descriptor seed')
    h = resize_matrix(a.shape, reference_hp.shape) @ h @ resize_matrix(source_hp.shape, b.shape)
    return h / h[2, 2], {'rawMatches': len(matches), 'coherentMatches': int(mask.sum()), 'ratioThreshold': .8}


def pattern_scores(source_hp, reference_hp, source_points, reference_points, h):
    """Neighbour-star correlation; omit the matched central source and diffuse background."""
    yy, xx = np.mgrid[-28:29, -28:29]
    offsets = np.column_stack([xx.ravel(), yy.ravel()]).astype(float)
    radius = np.hypot(offsets[:, 0], offsets[:, 1])
    offsets = offsets[(radius >= 6) & (radius <= 28)]
    inv = np.linalg.inv(h)
    scores = []
    predicted = transform(source_points, h)
    for pred, ref in zip(predicted, reference_points):
        rp = ref + offsets
        sp = transform(pred + offsets, inv)
        av = cv2.remap(reference_hp, rp[:, 0].astype('float32')[:, None], rp[:, 1].astype('float32')[:, None], cv2.INTER_LINEAR).ravel()
        bv = cv2.remap(source_hp, sp[:, 0].astype('float32')[:, None], sp[:, 1].astype('float32')[:, None], cv2.INTER_LINEAR).ravel()
        # Mean removal is confined to already high-pass samples; no diffuse signal participates.
        av = av - av.mean()
        bv = bv - bv.mean()
        denom = np.linalg.norm(av) * np.linalg.norm(bv)
        scores.append(float(av @ bv / denom) if denom else 0.)
    return np.array(scores)


def residual_stats(residual):
    return {name: float(np.percentile(residual, percentile)) for name, percentile in [('median', 50), ('p90', 90), ('max', 100)]}


def local_jacobian(h, point):
    q = transform([point, point + [1, 0], point + [0, 1]], h)
    return np.column_stack([q[1] - q[0], q[2] - q[0]])


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--source', required=True)
    p.add_argument('--reference', required=True)
    p.add_argument('--recipe', default='labs/nebula/models/image-overlays.json')
    p.add_argument('--source-id', required=True)
    p.add_argument('--reference-id', default='smash-original')
    p.add_argument('--target', type=int, default=0)
    p.add_argument('--output', required=True)
    p.add_argument('--max-dimension', type=int, default=5000)
    args = p.parse_args()
    cv2.setRNGSeed(73129)
    out = Path(args.output)
    out.mkdir(parents=True, exist_ok=True)
    # A repeated failed run must never leave an earlier successful gate in place.
    dump(out / 'direction-gate.json', {'schema': 'cssearth-image-direction-gate@1',
         'status': 'incomplete', 'pass': False, 'cloudProcessingPerformed': False})
    rec = json.loads(Path(args.recipe).read_text())['targets'][args.target]['images']
    source_wcs = next(r for r in rec if r['id'] == args.source_id)['wcs']
    reference_wcs = next(r for r in rec if r['id'] == args.reference_id)['wcs']
    source, sn = load(args.source, args.max_dimension)
    reference, rn = load(args.reference, args.max_dimension)
    s, shp = extract(source)
    r, rhp = extract(reference)
    provenance = {'source': {'path': args.source, 'sha256': sha(args.source), 'nativeDimensions': list(sn[1::-1]), 'workingDimensions': list(source.shape[1::-1]), 'wcs': source_wcs},
                  'reference': {'path': args.reference, 'sha256': sha(args.reference), 'nativeDimensions': list(rn[1::-1]), 'workingDimensions': list(reference.shape[1::-1]), 'wcs': reference_wcs}}
    dump(out / 'direction-gate.json', {'schema': 'cssearth-image-direction-gate@1',
         'status': 'incomplete', 'pass': False, 'cloudProcessingPerformed': False,
         'imageSha256': provenance['source']['sha256'], **provenance})
    # This artifact is written before any matching or cloud-processing stage.
    for name, stars, hp, im, native in [('source', s, shp, source, sn), ('reference', r, rhp, reference, rn)]:
        native_points = transform(stars[:, :2], resize_matrix(im.shape, native))
        dump(out / (name + '-star-centroids.json'), {'coordinateConvention': CONVENTION, 'image': provenance[name], 'method': 'positive Gaussian high-pass sigma=4 working pixels; 7px local maxima >7/255; positive 5x5 weighted centroid; strongest 70000 maximum', 'count': len(stars), 'nativePixelCentres': native_points.tolist(), 'workingPeakHighpass': stars[:, 2].tolist()})
        cv2.imwrite(str(out / (name + '-star-map.png')), np.round(hp.clip(0, 255)).astype('uint8'))
    print('STAR_MAPS_WRITTEN', len(s), len(r), flush=True)
    hseed, seed_report = seed(shp, rhp)
    print('DESCRIPTOR_SEED', seed_report, flush=True)
    predicted = transform(s[:, :2], hseed)
    tree = cKDTree(r[:, :2])
    distance, idx = tree.query(predicted)
    eligible = distance < 5
    source_indices = np.where(eligible)[0]
    x, y = s[eligible, :2], r[idx[eligible], :2]
    scores = pattern_scores(shp, rhp, x, y, hseed)
    # Fixed identity-quality threshold, applied before partitioning. No fitted residual filtering of holdout.
    accepted = scores > .35
    source_indices = source_indices[accepted]
    reference_indices = idx[eligible][accepted]
    x, y, scores = x[accepted], y[accepted], scores[accepted]
    # Unique reference assignment: strongest surrounding-pattern match wins.
    keep = []
    used = set()
    for i in np.argsort(scores)[::-1]:
        if int(reference_indices[i]) not in used:
            keep.append(i)
            used.add(int(reference_indices[i]))
    keep = np.array(keep)
    x, y, scores = x[keep], y[keep], scores[keep]
    source_indices, reference_indices = source_indices[keep], reference_indices[keep]
    print('UNIQUE_PATTERN_IDENTITIES', len(x), flush=True)
    if len(x) < 30:
        raise ValueError('Fewer than 30 distinct stars with independent surrounding-pattern confirmation')
    # Sort by a 5x5 spatial cell then alternate for heldout coverage across the overlap.
    cell = np.floor(x / np.array(source.shape[1::-1]) * 5).clip(0, 4).astype(int)
    order = np.lexsort((x[:, 0], cell[:, 0], cell[:, 1]))
    x, y, scores = x[order], y[order], scores[order]
    source_indices, reference_indices = source_indices[order], reference_indices[order]
    train = np.arange(len(x)) % 3 != 0
    h, mask = cv2.findHomography(x[train], y[train], cv2.RANSAC, 2.5, maxIters=10000, confidence=.999)
    fit_inliers = np.zeros(len(x), bool)
    fit_inliers[np.where(train)[0][mask.ravel() > 0]] = True
    h, _ = cv2.findHomography(x[fit_inliers], y[fit_inliers], 0)
    hn = resize_matrix(reference.shape, rn) @ h @ resize_matrix(sn, source.shape)
    hn /= hn[2, 2]
    xn, yn = transform(x, resize_matrix(source.shape, sn)), transform(y, resize_matrix(reference.shape, rn))
    residual = np.linalg.norm(transform(xn, hn) - yn, axis=1)
    publisher = topix(tosky(xn, source_wcs, sn), reference_wcs, rn)
    publisher_residual = np.linalg.norm(publisher - yn, axis=1)
    hull = float(ConvexHull(xn).volume / (sn[0] * sn[1]))
    heldout_hull = float(ConvexHull(xn[~train]).volume / (sn[0] * sn[1]))
    controls = {}
    centre = (np.array(sn[1::-1]) - 1) / 2
    variants = {'mirror-x': np.array([[-1, 0], [0, 1]]), 'mirror-y': np.array([[1, 0], [0, -1]]),
                'rotate-90': np.array([[0, -1], [1, 0]]), 'rotate-180': -np.eye(2),
                'scale-0.9': np.eye(2) * .9, 'scale-1.1': np.eye(2) * 1.1}
    for name, linear in variants.items():
        altered = (xn - centre) @ linear.T + centre
        controls[name] = residual_stats(np.linalg.norm(transform(altered, hn) - yn, axis=1))
    shifted = []
    for offset in [[40, 0], [0, 40], [100, -70]]:
        pp = predicted + offset
        dd, ii = tree.query(pp)
        near = dd < 5
        # Shifted seed creates the corresponding candidate star pattern at each offset.
        offset_h = np.array([[1., 0, offset[0]], [0, 1., offset[1]], [0, 0, 1.]]) @ hseed
        sc = pattern_scores(shp, rhp, s[near, :2], r[ii[near], :2], offset_h)
        shifted.append({'offsetWorkingReferencePixels': offset, 'nearbyCandidates': int(near.sum()), 'patternMatchesAbove035': int((sc > .35).sum())})
    controls['scrambled-shifts'] = shifted
    jacobian = local_jacobian(hn, centre)
    scales = np.linalg.svd(jacobian)[1]
    all_corners = np.array([[-.5, -.5], [sn[1]-.5, -.5], [sn[1]-.5, sn[0]-.5], [-.5, sn[0]-.5]])
    determinant_samples = [float(np.linalg.det(local_jacobian(hn, pt))) for pt in [centre, *all_corners]]
    stats = residual_stats(residual[~train])
    # Direction gate is explicitly bounded to the matched hull; publisher WCS assessed separately.
    gates = {'atLeast30Identities': len(x) >= 30, 'atLeast10HeldOut': int((~train).sum()) >= 10,
             'sourceHullAtLeast25Percent': hull >= .25, 'heldOutP90Under3ReferenceNativePixels': stats['p90'] < 3,
             'nonReflectedAcrossImage': min(determinant_samples) > 0,
             'identityCountOver5xScrambledControls': len(x) > 5 * max(1, *(q['patternMatchesAbove035'] for q in shifted)),
             'allWrongTransformsMedianOver100ReferencePixels': min(controls[k]['median'] for k in variants) > 100}
    receipt = {'schema': 'cssearth-image-direction-gate@1', 'status': 'pass' if all(gates.values()) else 'fail',
               'pass': all(gates.values()), 'gates': gates, 'imageSha256': provenance['source']['sha256'], 'coordinateConvention': CONVENTION,
               **provenance, 'starMapsExtractedBeforeRegistration': True, 'cloudProcessingPerformed': False,
               'descriptorSeed': seed_report, 'uniqueMatchedStars': len(x), 'trainingCount': int(train.sum()), 'trainingInlierCount': int(fit_inliers.sum()), 'heldOutCount': int((~train).sum()),
               'heldOutResidualReferenceNativePixels': stats, 'matchedSourceHullFraction': hull, 'heldOutSourceHullFraction': heldout_hull,
               'matchedSourceBoundingBoxNativePixels': [xn.min(axis=0).tolist(), xn.max(axis=0).tolist()],
               'publisherWcs': {'pass': bool(np.percentile(publisher_residual, 90) < 3), 'residualReferenceNativePixels': residual_stats(publisher_residual)},
               'verifiedRegistration': {'referenceWcs': reference_wcs, 'referenceWidthPx': rn[1], 'referenceHeightPx': rn[0], 'imageToReferenceMatrix': hn.ravel().tolist()},
               'localScaleReferencePixelsPerSourcePixel': scales.tolist(), 'localRotationDeg': float(np.rad2deg(np.arctan2(jacobian[1, 0], jacobian[0, 0]))),
               'jacobianDeterminantsCentreAndCorners': determinant_samples, 'negativeControls': controls,
               'limitations': ['SMASH publisher AVM is the sky anchor; no absolute catalogue solution.', 'Infrared/optical display composite point-source identities; not photometric or spectroscopic identities.', 'All final held-out points excluded from RANSAC and final least squares; their candidate discovery uses the shared descriptor seed and a 5 working-pixel association window.', 'Registration is empirically verified within the matched hull; outer corners are extrapolated.', 'Publication image may retain mosaic/projective distortions; residuals describe this image pair only.']}
    dump(out / 'direction-gate.json', receipt)
    dump(out / 'matched-stars.json', {'coordinateConvention': CONVENTION, 'sourceNativePixelCentres': xn.tolist(), 'referenceNativePixelCentres': yn.tolist(), 'sourceCentroidIndices': source_indices.tolist(), 'referenceCentroidIndices': reference_indices.tolist(), 'training': train.tolist(), 'fitInliers': fit_inliers.tolist(), 'surroundingStarPatternCorrelation': scores.tolist(), 'fitResidualReferenceNativePixels': residual.tolist(), 'publisherWcsResidualReferenceNativePixels': publisher_residual.tolist()})
    # Evidence only: original colour remains intact in these contact patches.
    warped = cv2.warpPerspective(source, h, (reference.shape[1], reference.shape[0]))
    view = cv2.addWeighted(reference, .5, warped, .5, 0)
    for i, point in enumerate(y):
        cv2.circle(view, tuple(np.round(point).astype(int)), 10, (0, 230, 255) if not train[i] else (0, 255, 0), 2)
    scale = min(1, 1800 / max(view.shape[:2]))
    cv2.imwrite(str(out / 'matched-star-overlay.jpg'), cv2.resize(view, None, fx=scale, fy=scale))
    choices = []
    for cy in range(5):
        for cx in range(5):
            ids = np.where((np.floor(x[:, 0] / source.shape[1] * 5) == cx) & (np.floor(x[:, 1] / source.shape[0] * 5) == cy) & (~train))[0]
            if len(ids):
                choices.append(int(ids[np.argmax(scores[ids])]))
    sheet = np.zeros((int(np.ceil(len(choices) / 4)) * 180, 4 * 320, 3), np.uint8)
    for j, k in enumerate(choices):
        row, col = divmod(j, 4)
        for side, im in enumerate([warped, reference]):
            patch = cv2.getRectSubPix(im, (72, 72), tuple(y[k].astype(float)))
            patch = cv2.resize(patch, (160, 160))
            cv2.drawMarker(patch, (80, 80), (0, 220, 255), cv2.MARKER_CROSS, 12, 1)
            sheet[row*180+20:row*180+180, col*320+side*160:col*320+(side+1)*160] = patch
        cv2.putText(sheet, f'heldout #{k}: VISTA | SMASH  {residual[k]:.2f}px', (col*320+3, row*180+14), cv2.FONT_HERSHEY_SIMPLEX, .33, (255,255,255), 1)
    cv2.imwrite(str(out / 'heldout-star-contact-sheet.jpg'), sheet)
    print('DIRECTION_GATE', receipt['status'], 'stars', len(x), 'heldout', stats, 'hull', hull, 'controls', shifted, flush=True)


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        if '--output' in sys.argv:
            receipt_path = Path(sys.argv[sys.argv.index('--output') + 1]) / 'direction-gate.json'
            receipt_path.parent.mkdir(parents=True, exist_ok=True)
            failure = json.loads(receipt_path.read_text()) if receipt_path.exists() else {}
            failure.update({'schema': 'cssearth-image-direction-gate@1', 'status': 'fail',
                            'pass': False, 'failureReason': str(error), 'cloudProcessingPerformed': False})
            dump(receipt_path, failure)
        raise
