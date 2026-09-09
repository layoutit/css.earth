#!/usr/bin/env python3
"""Offline, conservative compact-source trial. No image resampling or sky cutoff.

Run: python star-separation.py recipe.json
Recipe schema: cssearth-star-separation@1; source {path, sha256,
nativeDimensions: [width,height]}; outputDirectory; optional detections
{path,sha256} pointing at a registration source-star-centroids.json; parameters
and preview override DEFAULTS below. Paths are relative to the working directory.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import time
from functools import lru_cache

import cv2
import numpy as np
from scipy import ndimage
from scipy.sparse import csc_matrix
from scipy.sparse.linalg import splu


DEFAULTS = dict(detectionSigma=2.0, detectionThreshold=0.025, minimumSeparation=7,
                maximumDetections=250000, tileSize=768, minimumPeak=0.035,
                minimumSigma=0.65, maximumSigma=3.5, maximumElongation=1.55,
                maximumMaskRadius=12, maskSigma=2.8, profileFraction=0.2,
                minimumGaussianCorrelation=0.75, annulusWidth=5)
PREVIEW = dict(maxDimension=1000, exposure=2.0, gamma=0.7)
CONVENTION = 'Zero-based native raster pixel centres, top left; no orientation, crop, resize or registration transform applied.'


def sha256(path):
    result = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            result.update(block)
    return result.hexdigest()


def write_json(path, value):
    Path(path).write_text(json.dumps(value, indent=2, allow_nan=False) + '\n')


def read_image(path):
    # IMREAD_UNCHANGED ignores EXIF orientation and preserves integer bit depth.
    image = cv2.imread(str(path), cv2.IMREAD_UNCHANGED)
    if image is None or image.dtype not in (np.uint8, np.uint16):
        raise ValueError('Source must decode to native unsigned 8-bit or 16-bit pixels.')
    if image.ndim not in (2, 3) or (image.ndim == 3 and image.shape[2] not in (3, 4)):
        raise ValueError('Source must be grayscale, BGR or BGRA.')
    return image


def color(image):
    return image[:, :, :3] if image.ndim == 3 else image[:, :, None]


def luminance(image):
    data = color(image).astype(np.float32) / np.iinfo(image.dtype).max
    return data[:, :, 0] if data.shape[2] == 1 else data @ np.array([.0722, .7152, .2126], np.float32)


def parameters(overrides=None):
    if overrides is None:
        overrides = {}
    if not isinstance(overrides, dict) or set(overrides) - set(DEFAULTS):
        raise ValueError('Unknown separation parameter.')
    values = {**DEFAULTS, **overrides}
    for name, value in values.items():
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value <= 0:
            raise ValueError(f'Invalid positive parameter: {name}')
    for name in ('minimumSeparation', 'maximumDetections', 'tileSize', 'maximumMaskRadius', 'annulusWidth'):
        if int(values[name]) != values[name]:
            raise ValueError(f'{name} must be an integer.')
        values[name] = int(values[name])
    if not 0 < values['profileFraction'] < 1 or not 0 < values['minimumGaussianCorrelation'] <= 1:
        raise ValueError('Profile fraction and correlation must lie in (0,1].')
    if not values['minimumSigma'] < values['maximumSigma'] < values['maximumMaskRadius']:
        raise ValueError('PSF sigma limits must fit strictly inside the maximum mask radius.')
    if values['maximumMaskRadius'] > 64 or values['tileSize'] > 4096 or values['maximumDetections'] > 2000000:
        raise ValueError('Parameters exceed the bounded trial workspace.')
    return values


def detect(image, p):
    """Native-resolution tiled high-pass detection; filtered pixels are never output."""
    height, width = image.shape[:2]
    halo = max(math.ceil(p['detectionSigma'] * 4), p['minimumSeparation']) + 1
    found = []
    for y in range(0, height, p['tileSize']):
        for x in range(0, width, p['tileSize']):
            x0, y0 = max(0, x - halo), max(0, y - halo)
            x1, y1 = min(width, x + p['tileSize'] + halo), min(height, y + p['tileSize'] + halo)
            patch = image[y0:y1, x0:x1]
            light = luminance(patch)
            signal = light - ndimage.gaussian_filter(light, p['detectionSigma'], mode='reflect')
            peaks = (signal >= p['detectionThreshold']) & (signal == ndimage.maximum_filter(signal, p['minimumSeparation'], mode='reflect'))
            if patch.ndim == 3 and patch.shape[2] == 4:
                peaks &= patch[:, :, 3] > 0
            yy, xx = np.nonzero(peaks)
            for py, px in zip(yy, xx):
                nx, ny = int(px + x0), int(py + y0)
                if x <= nx < min(width, x + p['tileSize']) and y <= ny < min(height, y + p['tileSize']):
                    found.append([nx, ny, float(signal[py, px])])
            if len(found) > p['maximumDetections']:
                raise ValueError('Detection budget exceeded; adjust the recipe, do not silently truncate sources.')
    return [[x, y] for x, y, _ in sorted(found, key=lambda point: (-point[2], point[1], point[0]))]


def validate_centroids(document, source, source_hash, dimensions, limit):
    record = document.get('image', {})
    points = document.get('nativePixelCentres')
    if (record.get('sha256') != source_hash or record.get('nativeDimensions') != dimensions or
            Path(record.get('path', '')).resolve() != Path(source).resolve()):
        raise ValueError('Detection catalogue does not match source hash, path and native dimensions.')
    if not isinstance(points, list) or document.get('count') != len(points) or len(points) > limit:
        raise ValueError('Invalid or oversized centroid catalogue.')
    for point in points:
        if (not isinstance(point, list) or len(point) != 2 or
                any(isinstance(n, bool) or not isinstance(n, (int, float)) or not math.isfinite(n) for n in point) or
                not 0 <= point[0] < dimensions[0] or not 0 <= point[1] < dimensions[1]):
            raise ValueError('Centroid outside the native pixel grid.')
    return points


def classify(image, point, p):
    """Conservative local shape gate, never a physical foreground classifier."""
    cx, cy = (int(round(value)) for value in point)
    radius = p['maximumMaskRadius']
    extent = radius + p['annulusWidth']
    if cx - extent < 0 or cy - extent < 0 or cx + extent >= image.shape[1] or cy + extent >= image.shape[0]:
        return None, 'edge-neighborhood'
    patch = image[cy-extent:cy+extent+1, cx-extent:cx+extent+1]
    if patch.ndim == 3 and patch.shape[2] == 4 and np.any(patch[:, :, 3] == 0):
        return None, 'no-data-neighborhood'
    yy, xx = np.mgrid[-extent:extent+1, -extent:extent+1]
    distance = np.hypot(xx, yy)
    light = luminance(patch)
    ring = (distance > radius) & (distance <= extent)
    # Robust annular plane is used for shape assessment only, not as diffuse output.
    design = np.stack([np.ones_like(xx), xx, yy], axis=-1).astype(np.float64)
    use = ring.copy()
    for _ in range(3):
        fitted = np.linalg.lstsq(design[use], light[use], rcond=None)[0]
        deviation = light - design @ fitted
        scatter = max(1 / np.iinfo(image.dtype).max, float(np.median(np.abs(deviation[use]))) * 1.4826)
        candidate = ring & (np.abs(deviation) <= 3 * scatter)
        if candidate.sum() >= 20:
            use = candidate
    signal = np.maximum(0, light - design @ fitted)
    central = distance <= 2.5
    peak = float(signal[central].max())
    if peak < p['minimumPeak']:
        return None, 'low-compact-contrast'
    py, px = np.unravel_index(np.argmax(np.where(central, signal, -1)), signal.shape)
    labels, _ = ndimage.label(signal >= peak * p['profileFraction'], structure=np.ones((3, 3)))
    component = labels == labels[py, px]
    if not labels[py, px] or np.any(component & (distance >= radius)):
        return None, 'extended-or-connected-profile'
    weights = np.where(component, signal, 0)
    total = float(weights.sum())
    mx, my = float((weights * xx).sum() / total), float((weights * yy).sum() / total)
    dx, dy = xx - mx, yy - my
    covariance = np.array([[(weights * dx * dx).sum(), (weights * dx * dy).sum()],
                           [(weights * dx * dy).sum(), (weights * dy * dy).sum()]]) / total
    eigen = np.linalg.eigvalsh(covariance)
    # Correct second moments for a Gaussian truncated at profileFraction of peak.
    cut = -math.log(p['profileFraction'])
    correction = (1 - (cut + 1) * math.exp(-cut)) / (1 - math.exp(-cut))
    minor, major = np.sqrt(np.maximum(eigen, 0) / correction)
    elongation = float(major / max(minor, .01))
    if minor < p['minimumSigma'] or major > p['maximumSigma'] or elongation > p['maximumElongation']:
        return None, 'non-psf-width-or-elongation'
    sigma = float(math.sqrt(major * minor))
    gaussian = np.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma))
    region = distance <= min(radius, sigma * 3)
    a, b = signal[region], gaussian[region]
    correlation = float(np.corrcoef(a, b)[0, 1]) if np.std(a) > 0 else 0
    if not math.isfinite(correlation) or correlation < p['minimumGaussianCorrelation']:
        return None, 'non-psf-profile'
    mask_radius = min(radius, max(2, int(math.ceil(p['maskSigma'] * major))))
    return dict(x=cx, y=cy, sigma=sigma, elongation=elongation, peak=peak,
                gaussianCorrelation=correlation, radius=mask_radius), None


@lru_cache(maxsize=64)
def harmonic_system(shape, mask_bytes):
    mask = np.frombuffer(mask_bytes, dtype=np.bool_).reshape(shape)
    yy, xx = np.nonzero(mask)
    indices = np.full(shape, -1, dtype=np.int32)
    indices[mask] = np.arange(len(xx))
    rows, columns, data = list(range(len(xx))), list(range(len(xx))), [4.] * len(xx)
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        neighbors = indices[yy + dy, xx + dx]
        valid = neighbors >= 0
        rows.extend(np.flatnonzero(valid).tolist())
        columns.extend(neighbors[valid].tolist())
        data.extend([-1.] * int(valid.sum()))
    return yy, xx, splu(csc_matrix((data, (rows, columns)), shape=(len(xx), len(xx))))


def interpolate(patch, mask):
    """Solve the local discrete Laplace equation with exact fixed boundary data."""
    if np.any(mask[[0, -1], :]) or np.any(mask[:, [0, -1]]):
        raise ValueError('Interpolation requires an unmasked boundary.')
    values = color(patch).astype(np.float64)
    if not mask.any():
        return values
    yy, xx, factor = harmonic_system(mask.shape, mask.tobytes())
    fixed = values.copy()
    fixed[mask] = 0
    rhs = sum(fixed[yy + dy, xx + dx] for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)))
    values[mask] = factor.solve(rhs)
    return values


def separate(image, points, p, report_progress=None):
    stars = np.zeros_like(image)
    mask = np.zeros(image.shape[:2], np.uint8)
    if image.ndim == 3 and image.shape[2] == 4:
        stars[:, :, 3] = image[:, :, 3]
    accepted, rejected = [], {}
    for index, point in enumerate(points):
        candidate, reason = classify(image, point, p)
        if candidate is None:
            rejected[reason] = rejected.get(reason, 0) + 1
            continue
        x, y, r = candidate['x'], candidate['y'], candidate['radius']
        extent = r + 1
        patch = image[y-extent:y+extent+1, x-extent:x+extent+1]
        yy, xx = np.mgrid[-extent:extent+1, -extent:extent+1]
        local_mask = xx * xx + yy * yy <= r * r
        background = interpolate(patch, local_mask)
        residual = np.maximum(0, color(patch).astype(np.float64) - background)
        residual[~local_mask] = 0
        quantized = np.rint(residual).astype(image.dtype)
        destination = color(stars)[y-extent:y+extent+1, x-extent:x+extent+1]
        # Overlapping masks never double-count source signal.
        np.maximum(destination, quantized, out=destination)
        target_mask = mask[y-extent:y+extent+1, x-extent:x+extent+1]
        target_mask[local_mask] = 255
        accepted.append(candidate)
        if report_progress and index % 1000 == 0:
            report_progress(index, len(points), len(accepted))
    diffuse = image.copy()
    color(diffuse)[:] -= color(stars)
    return diffuse, stars, mask, accepted, rejected


def verify(image, diffuse, stars, mask):
    maximum_error, changed_outside, source_totals, diffuse_totals = 0, 0, None, None
    histograms = [np.zeros(65536, np.int64) for _ in range(color(image).shape[2])]
    for y in range(0, image.shape[0], 256):
        original = color(image[y:y+256]).astype(np.int32)
        cloud = color(diffuse[y:y+256]).astype(np.int32)
        point = color(stars[y:y+256]).astype(np.int32)
        maximum_error = max(maximum_error, int(np.abs(original - cloud - point).max()))
        changed_outside += int(np.count_nonzero(np.any(original != cloud, axis=2) & (mask[y:y+256] == 0)))
        source_sum, diffuse_sum = original.sum(axis=(0, 1)), cloud.sum(axis=(0, 1))
        source_totals = source_sum if source_totals is None else source_totals + source_sum
        diffuse_totals = diffuse_sum if diffuse_totals is None else diffuse_totals + diffuse_sum
        for channel, histogram in enumerate(histograms):
            histogram += np.bincount(cloud[:, :, channel].ravel(), minlength=65536)
    count = image.shape[0] * image.shape[1]
    quantiles = [0, .1, .5, .9, .99, .999, 1]
    percentiles = [[int(np.searchsorted(np.cumsum(histogram), max(1, math.ceil(q * count)))) for q in quantiles] for histogram in histograms]
    return dict(maximumReconstructionErrorCodeValues=maximum_error, changedPixelsOutsideMask=changed_outside,
                nativeDimensions=[image.shape[1], image.shape[0]], maskPixels=int(np.count_nonzero(mask)),
                sourceChannelTotals=source_totals.tolist(), diffuseChannelTotals=diffuse_totals.tolist(),
                diffusePercentileFractions=quantiles, diffuseChannelPercentiles=percentiles,
                brightnessMeaning='Unsigned display code values in native BGR channel order (or grayscale); full footprint including no-data code values. Not radiance, photometric flux or signal-to-noise.')


def write_image(path, image):
    if not cv2.imwrite(str(path), image, [cv2.IMWRITE_PNG_COMPRESSION, 3]):
        raise OSError(f'Could not write {path}')


def comparison_preview(image, diffuse, stars, mask, p):
    scale = min(1, p['maxDimension'] / max(image.shape[:2]))
    size = (max(1, round(image.shape[1] * scale)), max(1, round(image.shape[0] * scale)))
    panels = []
    for source in (image, diffuse, stars):
        sample = cv2.resize(color(source), size, interpolation=cv2.INTER_AREA).astype(np.float64)
        if sample.ndim == 2:
            sample = np.repeat(sample[:, :, None], 3, axis=2)
        normalized = sample / np.iinfo(image.dtype).max
        panels.append(np.rint(np.clip((normalized * p['exposure']) ** p['gamma'], 0, 1) * 255).astype(np.uint8))
    small_mask = cv2.resize(mask, size, interpolation=cv2.INTER_AREA)
    panels.append(np.repeat(small_mask[:, :, None], 3, axis=2))
    labelled = []
    for name, panel in zip(('Source', 'Diffuse trial', 'Compact residual', 'Accepted masks'), panels):
        canvas = np.zeros((size[1] + 32, size[0], 3), np.uint8)
        canvas[32:] = panel
        cv2.putText(canvas, name, (8, 22), cv2.FONT_HERSHEY_SIMPLEX, .55, (230, 230, 230), 1, cv2.LINE_AA)
        labelled.append(canvas)
    return np.concatenate(labelled, axis=1)


def run(recipe_path):
    started = time.monotonic()
    recipe = json.loads(Path(recipe_path).read_text())
    if recipe.get('schema') != 'cssearth-star-separation@1' or set(recipe) - {'schema', 'source', 'outputDirectory', 'detections', 'parameters', 'preview'}:
        raise ValueError('Invalid star-separation recipe.')
    p = parameters(recipe.get('parameters'))
    preview = {**PREVIEW, **recipe.get('preview', {})}
    if set(preview) != set(PREVIEW) or any(not isinstance(v, (float, int)) or not math.isfinite(v) or v <= 0 for v in preview.values()) or preview['maxDimension'] > 2000:
        raise ValueError('Invalid bounded comparison preview settings.')
    source = recipe['source']
    source_hash = sha256(source['path'])
    if source_hash != source['sha256']:
        raise ValueError('Source SHA256 mismatch.')
    image = read_image(source['path'])
    dimensions = [image.shape[1], image.shape[0]]
    if dimensions != source['nativeDimensions']:
        raise ValueError('Source native dimensions mismatch.')
    output = Path(recipe['outputDirectory'])
    if '.local' not in output.resolve().parts:
        raise ValueError('Large separation outputs must remain in an ignored .local cache.')
    output.mkdir(parents=True, exist_ok=True)
    detection_input = recipe.get('detections')
    if detection_input:
        if sha256(detection_input['path']) != detection_input['sha256']:
            raise ValueError('Detection catalogue SHA256 mismatch.')
        points = validate_centroids(json.loads(Path(detection_input['path']).read_text()), source['path'], source_hash, dimensions, p['maximumDetections'])
        detection_method = 'Pinned native-pixel catalogue; conservative local profile checks follow.'
    else:
        points = detect(image, p)
        detection_method = 'Tiled native-pixel Gaussian high-pass local maxima; no filtered image used as diffuse output.'
    detection_map = np.zeros(image.shape[:2], np.uint8)
    for x, y in points:
        detection_map[min(image.shape[0]-1, round(y)), min(image.shape[1]-1, round(x))] = 255
    write_json(output / 'star-detections.json', dict(image={**source, 'nativeDimensions': dimensions}, count=len(points),
               coordinateConvention=CONVENTION, method=detection_method, nativePixelCentres=points))
    write_image(output / 'star-detection-map.png', detection_map)
    print(json.dumps(dict(stage='detections-written', count=len(points))), flush=True)
    diffuse, stars, mask, accepted, rejected = separate(image, points, p,
        lambda done, total, count: print(json.dumps(dict(stage='separating', done=done, total=total, accepted=count)), flush=True))
    checks = verify(image, diffuse, stars, mask)
    if checks['maximumReconstructionErrorCodeValues'] or checks['changedPixelsOutsideMask']:
        raise AssertionError('Native-grid accounting failed.')
    write_image(output / 'diffuse.png', diffuse)
    write_image(output / 'stars.png', stars)
    write_image(output / 'star-mask.png', mask)
    for name, expected in (('diffuse.png', diffuse), ('stars.png', stars), ('star-mask.png', mask)):
        reloaded = read_image(output / name)
        if reloaded.dtype != expected.dtype or reloaded.shape != expected.shape or not np.array_equal(reloaded, expected):
            raise AssertionError(f'Encoded PNG round trip changed native pixels: {name}')
        del reloaded
    checks['encodedRoundTripExact'] = True
    write_json(output / 'accepted-stars.json', dict(count=len(accepted), candidates=accepted, rejected=rejected))
    write_image(output / 'comparison.png', comparison_preview(image, diffuse, stars, mask, preview))
    files = ['star-detections.json', 'star-detection-map.png', 'diffuse.png', 'stars.png', 'star-mask.png', 'accepted-stars.json', 'comparison.png']
    receipt = dict(schema='cssearth-star-separation-receipt@1', status='inspectable-trial', source={**source, 'dtype': str(image.dtype)},
        sourceSha256=source_hash, recipeSha256=sha256(recipe_path), scriptSha256=sha256(__file__), parameters=p,
        dependencies=dict(opencv=cv2.__version__, numpy=np.__version__), coordinateConvention=CONVENTION,
        detectionsWrittenBeforeSeparation=True, detectionsInput=detection_input, detectedCount=len(points), acceptedCount=len(accepted),
        rejected=rejected, verification=checks, preview={**preview, 'meaning': 'One identical global exposure and gamma on source/diffuse/stars; reduced preview only.'},
        method='Compact-profile gates; bounded circular masks; local harmonic background interpolation; positive residual with exact integer subtraction. Overlap uses maximum residual, never summed subtraction.',
        alphaPolicy='If present, source alpha is copied unchanged into both outputs; arithmetic reconstruction is checked on color channels.',
        limitations=['Automatic compact-source candidates, not physical foreground/LMC membership.',
                     'Compact nebular knots can resemble stars; ambiguous sources may be removed and rejected or undetected stars remain.',
                     'Diffuse structure inside accepted masks is an interpolation hypothesis; outside-mask pixels remain exact.',
                     'Saturated stars, broad wings, diffraction spikes, crowded blends and edge sources are deliberately incomplete.',
                     'No calibrated PSF or noise model exists for these display composites; brightness is not photometric SNR.'],
        outputs={file: dict(sha256=sha256(output / file), bytes=(output / file).stat().st_size) for file in files},
        elapsedSeconds=round(time.monotonic() - started, 3))
    write_json(output / 'receipt.json', receipt)
    print(json.dumps(dict(stage='complete', accepted=len(accepted), detected=len(points), output=str(output), checks=checks)), flush=True)
    return receipt


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('recipe')
    run(parser.parse_args().recipe)
