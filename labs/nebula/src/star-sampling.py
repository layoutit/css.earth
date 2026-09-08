#!/usr/bin/env python3
"""Inspect native stars without full-image extraction. Read a pinned JSON request on stdin.

Elliptical Moffat plus a local RGB background plane is an approximate model of
stretched display pixels, not a calibrated PSF, star catalogue or membership test.
Only sample cutouts receive a subtraction preview; the original stays untouched.
"""
import hashlib
import json
import math
import os
from pathlib import Path
import sys
import time

# Small bounded least-squares systems are faster without nested BLAS pools.
os.environ['OPENBLAS_NUM_THREADS'] = '1'
os.environ['VECLIB_MAXIMUM_THREADS'] = '1'
import cv2
import numpy as np
import scipy
from scipy import ndimage
from scipy.optimize import least_squares

OPTIONS = dict(sampleCount=30, maximumCandidates=240, maximumRadius=128)
CONTROLS = dict(widthScale=1., amplitudeScale=1., betaOverride=None)
APPLY_LIMITS = dict(tileSize=768, maximumVerifications=200000)
LIMITATIONS = [
    'Fitted display-image star candidates, not physical foreground/LMC membership or calibrated PSFs.',
    'Stretched RGB, saturation, crowded stars and compact nebular knots can bias fitted widths and wings.',
    'A local tilted background plane preserves its fitted broad trend; curved nebulosity can still bias the model.',
    'Reference cutouts show individual fits; validation cutouts use a shared bank learned only from qualified references.',
    'Calibration checks bounded unselected native windows, not the full image. No scientifically reliable deblending is claimed.',
]


def sha256(path):
    value = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            value.update(block)
    return value.hexdigest()


def pinned_json(item):
    if set(item) != {'path', 'sha256'} or sha256(item['path']) != item['sha256']:
        raise ValueError('Pinned JSON hash differs.')
    return json.loads(Path(item['path']).read_text())


def settings(options=None, controls=None):
    if options is not None and (not isinstance(options, dict) or set(options) - set(OPTIONS)):
        raise ValueError('Unknown sampling option.')
    if controls is not None and (not isinstance(controls, dict) or set(controls) - set(CONTROLS)):
        raise ValueError('Unknown calibration control.')
    o, c = {**OPTIONS, **(options or {})}, {**CONTROLS, **(controls or {})}
    if (any(type(v) is not int for v in o.values()) or not 20 <= o['sampleCount'] <= 50 or
            not o['sampleCount'] <= o['maximumCandidates'] <= 240 or not 16 <= o['maximumRadius'] <= 128):
        raise ValueError('Sampling requires 20–50 suggestions, at most240 candidates and radius16–128.')
    for key, low, high in (('widthScale', .5, 3), ('amplitudeScale', 0, 1.5), ('betaOverride', 1.1, 8)):
        value = c[key]
        if key == 'betaOverride' and value is None:
            continue
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or not low <= value <= high:
            raise ValueError('Invalid calibration control: ' + key)
    return o, c


def read_source(source):
    if set(source) != {'path', 'sha256', 'nativeDimensions'} or sha256(source['path']) != source['sha256']:
        raise ValueError('Source hash or metadata differs.')
    # IMREAD_UNCHANGED preserves native integer depth and ignores EXIF orientation.
    image = cv2.imread(str(source['path']), cv2.IMREAD_UNCHANGED)
    if (image is None or image.dtype not in (np.uint8, np.uint16) or image.ndim != 3 or image.shape[2] != 3 or
            [image.shape[1], image.shape[0]] != source['nativeDimensions']):
        raise ValueError('Expected the pinned native unsigned RGB grid, without alpha.')
    return image


def point_value(point, image):
    if not isinstance(point, dict) or set(point) != {'x', 'y'}:
        raise ValueError('Expected native point {x,y}.')
    values = [point['x'], point['y']]
    if (any(isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v) for v in values) or
            not 0 <= values[0] < image.shape[1] or not 0 <= values[1] < image.shape[0]):
        raise ValueError('Point lies outside the native source grid.')
    return values


def light(image):
    return image.astype(np.float64) @ np.array([.0722, .7152, .2126]) / np.iinfo(image.dtype).max


def background_plane(data, xx, yy, radius):
    design = np.stack([np.ones_like(xx), xx / radius, yy / radius], axis=-1)
    ring = np.hypot(xx, yy) > radius * .72
    if ring.sum() < 12:
        ring = np.hypot(xx, yy) >= np.percentile(np.hypot(xx, yy), 70)
    use = ring.copy()
    values = None
    for _ in range(3):
        values = np.linalg.lstsq(design[use], data[use], rcond=None)[0]
        residual = data - design @ values
        noise = max(1e-5, 1.4826 * float(np.median(np.abs(residual[use] - np.median(residual[use])))))
        candidate = ring & (np.abs(residual) < 3 * noise)
        if candidate.sum() >= 12:
            use = candidate
    return design @ values, values, noise


def moffat(xx, yy, cx, cy, ax, ay, angle, beta):
    dx, dy = xx - cx, yy - cy
    u, v = np.cos(angle) * dx + np.sin(angle) * dy, -np.sin(angle) * dx + np.cos(angle) * dy
    return (1 + (u / ax) ** 2 + (v / ay) ** 2) ** -beta


def fit_star(image, point, maximum_radius=128):
    """Adaptive native neighborhood, no fixed stellar-width ceiling. Return fit and cutout internals."""
    px, py = point_value(point, image)
    ix, iy = int(round(px)), int(round(py))
    ix, iy = min(ix, image.shape[1]-1), min(iy, image.shape[0]-1)
    radius = min(16, maximum_radius)
    while True:
        x0, y0 = max(0, ix-radius), max(0, iy-radius)
        x1, y1 = min(image.shape[1], ix+radius+1), min(image.shape[0], iy+radius+1)
        patch = image[y0:y1, x0:x1]
        yy, xx = np.mgrid[y0:y1, x0:x1].astype(np.float64)
        xx, yy = xx-ix, yy-iy
        data = light(patch)
        plane, background, noise = background_plane(data, xx, yy, radius)
        excess = data-plane
        near = np.hypot(xx, yy) <= 3
        py_peak, px_peak = np.unravel_index(np.argmax(np.where(near, excess, -np.inf)), excess.shape)
        peak = max(float(excess[py_peak, px_peak]), 1e-5)
        labels, _ = ndimage.label(excess >= .5*peak, np.ones((3, 3)))
        component = (labels == labels[py_peak, px_peak]) & (labels > 0)
        half_radius = math.sqrt(max(1, int(component.sum())) / math.pi)
        desired = max(16, int(math.ceil(half_radius * 7)))
        if desired > radius and radius < maximum_radius:
            radius = min(maximum_radius, max(radius * 2, desired))
            continue
        break
    initial_beta = 2.5
    alpha = max(.45, half_radius / math.sqrt(2 ** (1/initial_beta)-1))
    alpha = min(alpha, radius*.75)
    # Bound fit cost using original pixel samples, retaining every central pixel.
    step = max(1, int(math.ceil(math.sqrt(data.size/1400))))
    use = np.zeros(data.shape, bool)
    use[::step, ::step] = True
    use |= np.hypot(xx, yy) <= min(6, max(4, half_radius*1.5))
    sx, sy, observed = xx[use], yy[use], data[use]
    initial = [xx[py_peak, px_peak], yy[py_peak, px_peak], alpha, alpha, 0, initial_beta,
               peak, background[0], background[1], background[2]]
    lower = [-4, -4, .2, .2, -math.pi/2, 1.1, 0, -1, -2, -2]
    upper = [4, 4, radius, radius, math.pi/2, 8, 4, 2, 2, 2]
    initial = np.asarray(initial, dtype=float)
    finite_initial = bool(np.isfinite(initial).all())
    fallback = np.array([0, 0, alpha, alpha, 0, initial_beta, .01, np.median(data), 0, 0])
    finite = np.where(np.isfinite(initial), initial, fallback)
    margin = (np.asarray(upper)-np.asarray(lower))*1e-6
    projected = np.clip(finite, np.asarray(lower)+margin, np.asarray(upper)-margin)
    initial_clamped = not np.array_equal(initial, projected)

    def residual(p):
        profile = moffat(sx, sy, *p[:6])
        return p[6]*profile + p[7] + p[8]*sx/radius + p[9]*sy/radius-observed

    fitted = least_squares(residual, projected, bounds=(lower, upper), loss='soft_l1',
                           f_scale=max(noise*2, .002), max_nfev=70, ftol=1e-5, xtol=1e-5)
    p = fitted.x
    profile = moffat(xx, yy, *p[:6])
    factor = 2 * math.sqrt(2 ** (1/p[5])-1)
    major, minor = max(p[2], p[3])*factor, min(p[2], p[3])*factor
    fwhm = math.sqrt(major*minor)
    halo = math.sqrt(p[2]*p[3]) * math.sqrt(.05 ** (1/(1-p[5]))-1)
    core = np.hypot(xx-p[0], yy-p[1]) <= max(1, major/2)
    fit_region = np.hypot(xx-p[0], yy-p[1]) <= max(3, major*1.5)
    model_design = np.stack([profile, np.ones_like(xx), xx/radius, yy/radius], axis=-1)
    channels, models, backgrounds = [], [], []
    peak_rgb = patch.astype(np.float64) / np.iinfo(image.dtype).max
    for index, channel in enumerate(('B', 'G', 'R')):
        measured = peak_rgb[:, :, index]
        include = use.copy()
        coeff = None
        for _ in range(3):
            coeff = np.linalg.lstsq(model_design[include], measured[include], rcond=None)[0]
            delta = measured-model_design @ coeff
            deviation = max(.001, 1.4826*float(np.median(np.abs(delta[include]-np.median(delta[include])))))
            candidate = use & (np.abs(delta) < 4*deviation)
            if candidate.sum() > 20:
                include = candidate
        amplitude = max(0., float(coeff[0]))
        bg = model_design[:, :, 1:] @ coeff[1:]
        rmse = float(np.sqrt(np.mean((measured[fit_region]-(bg+amplitude*profile)[fit_region])**2)))
        channels.append(dict(channel=channel, amplitude=amplitude, background=float(coeff[1]), rmse=rmse))
        models.append(amplitude*profile)
        backgrounds.append(bg)
    star_model = np.stack(models, axis=2)
    background_image = np.stack(backgrounds, axis=2)
    relative_rmse = float(np.sqrt(np.mean((peak_rgb[fit_region]-(background_image+star_model)[fit_region])**2)) / max(peak, .01))
    # Detect only comparable neighboring peaks; faint LMC texture is not automatically a crowding veto.
    neighborhood = max(3, int(round(fwhm)) | 1)
    peaks = (excess == ndimage.maximum_filter(excess, size=neighborhood)) & (excess > max(peak*.2, noise*5))
    distance = np.hypot(xx-p[0], yy-p[1])
    neighbors = peaks & (distance > max(2, major*.8)) & (distance < max(6, major*3))
    neighbor_count = int(np.count_nonzero(neighbors))
    saturation = int(np.count_nonzero(np.any(patch == np.iinfo(image.dtype).max, axis=2) & core))
    ellipticity = float(1-minor/max(major, .001))
    flags = []
    if not finite_initial:
        flags.append('nonfinite-profile-initializer')
    if x0 == 0 or y0 == 0 or x1 == image.shape[1] or y1 == image.shape[0]:
        flags.append('edge-neighborhood')
    if saturation:
        flags.append('saturated-core')
    if neighbor_count:
        flags.append('crowded')
    if peak < max(.006, noise*5):
        flags.append('low-local-contrast')
    if fwhm < 1:
        flags.append('undersampled-core')
    if ellipticity > .45:
        flags.append('elongated-or-blended')
    if relative_rmse > .18 or not fitted.success:
        flags.append('poor-profile-fit')
    if max(p[2], p[3]) > radius*.85 or major > radius*.65 or desired > maximum_radius:
        flags.append('profile-exceeds-neighborhood')
    if halo > radius:
        flags.append('halo-extrapolated')
    confidence = float(np.clip(math.exp(-4*relative_rmse) * (1-.6*ellipticity) *
                              (0.35 if saturation else 1) * (.5 if neighbor_count else 1) *
                              min(1, peak/max(noise*8, .008)), 0, 1))
    blocking = [flag for flag in flags if flag != 'halo-extrapolated']
    sample = dict(id=f'star-{ix}-{iy}', point=dict(x=float(ix+p[0]), y=float(iy+p[1])),
        requestedPoint=dict(x=px, y=py), qualified=not blocking and confidence >= .55,
        cutout=dict(x=x0, y=y0, width=x1-x0, height=y1-y0),
        metrics=dict(fwhmPixels=float(fwhm), fwhmMajorPixels=float(major), fwhmMinorPixels=float(minor),
                     ellipticity=ellipticity, coreRadiusPixels=float(fwhm/2), haloRadiusPixels=float(halo),
                     haloMeaning='Radius enclosing95% of the fitted infinite Moffat model; flagged when outside the inspected neighborhood.',
                     backgroundRgb=[channels[i]['background'] for i in (2, 1, 0)], saturatedPixels=saturation,
                     neighborCount=neighbor_count, fitRelativeRmse=relative_rmse, confidence=confidence, flags=flags,
                     beta=float(p[5]), peakContrast=float(peak), localContrastToScatter=float(peak/max(noise, 1e-5))),
        channels=list(reversed(channels)), fit=dict(model='elliptical-moffat-plus-local-plane',
            alphaX=float(p[2]), alphaY=float(p[3]), angleRadians=float(p[4]), beta=float(p[5]),
            fittingRadiusPixels=radius, nativeFitPixels=int(use.sum()), optimizerConverged=bool(fitted.success),
            initializerClamped=initial_clamped))
    return sample, dict(patch=patch, xx=xx, yy=yy, parameters=p, amplitudes=[v['amplitude'] for v in channels])


def preview_model(internals, controls):
    patch, p = internals['patch'], internals['parameters']
    beta = controls['betaOverride'] if controls['betaOverride'] is not None else p[5]
    # A beta override changes wings while keeping the measured FWHM (times widthScale).
    alpha_scale = controls['widthScale'] * math.sqrt((2**(1/p[5])-1)/(2**(1/beta)-1))
    profile = moffat(internals['xx'], internals['yy'], p[0], p[1], p[2]*alpha_scale, p[3]*alpha_scale, p[4], beta)
    signal = profile[:, :, None] * np.array(internals['amplitudes']) * controls['amplitudeScale']
    signal = np.rint(np.clip(signal, 0, 1)*np.iinfo(patch.dtype).max).astype(patch.dtype)
    removed = np.minimum(patch, signal)
    return removed, patch-removed


def window_points(image, progress=None):
    """Broad and narrow native peaks from bounded spread windows, independent of the old catalogue detector."""
    points = []
    for row, cy in enumerate(np.linspace(96, max(96, image.shape[0]-97), 8)):
        for column, cx in enumerate(np.linspace(96, max(96, image.shape[1]-97), 8)):
            x0, y0 = max(0, int(cx)-96), max(0, int(cy)-96)
            crop = light(image[y0:min(y0+193, image.shape[0]), x0:min(x0+193, image.shape[1])])
            for sigma in (1., 3., 6., 12.):
                signal = crop-ndimage.gaussian_filter(crop, sigma)
                ys, xs = np.nonzero((signal == ndimage.maximum_filter(signal, max(3, int(sigma*2)+1))) & (signal > .01))
                order = np.argsort(signal[ys, xs])[-3:]
                points.extend((int(xs[i]+x0), int(ys[i]+y0)) for i in order)
            if progress:
                current = row*8+column+1
                progress(dict(stage='scanning', current=current, total=64, message=f'Scanning native window {current} of64'))
    return np.array(sorted(set(points)), dtype=np.float64).reshape(-1, 2)


def diverse_candidates(array, image, count):
    if not len(array):
        return []
    pixels = np.floor(array).astype(np.int32)
    strength = image[pixels[:, 1], pixels[:, 0]].max(axis=1)
    grid = 6
    cells = (np.minimum(grid-1, (array[:, 1]*grid/image.shape[0]).astype(int))*grid +
             np.minimum(grid-1, (array[:, 0]*grid/image.shape[1]).astype(int)))
    selected = []
    per_cell = max(1, math.ceil(count/(grid*grid)))
    quantiles = [.99, .95, .999, .75, .5, .9, 1.]
    for cell in range(grid*grid):
        indices = np.flatnonzero(cells == cell)
        # Prefer unsaturated bright candidates; keep an explicit brightest example too.
        unsaturated = indices[strength[indices] < np.iinfo(image.dtype).max]
        ranked = unsaturated[np.argsort(strength[unsaturated], kind='stable')]
        picks = [int(ranked[round(q*(len(ranked)-1))]) for q in quantiles[:per_cell] if len(ranked)]
        if len(indices) and per_cell >= 3:
            picks[-1:] = [int(indices[np.argmax(strength[indices])])]
        selected.append([array[i].tolist() for i in dict.fromkeys(picks)])
    return [group[(level+index) % len(group)] for level in range(per_cell)
            for index, group in enumerate(selected) if len(group) > level][:count]


def catalogue_points(image, source, detection_pin, count, progress=None):
    windows = window_points(image, progress)
    if detection_pin:
        catalogue = pinned_json(detection_pin)
        record = catalogue.get('image', {})
        points = catalogue.get('nativePixelCentres')
        if (record.get('sha256') != source['sha256'] or record.get('nativeDimensions') != source['nativeDimensions'] or
                Path(record.get('path', '')).resolve() != Path(source['path']).resolve() or
                not isinstance(points, list) or len(points) != catalogue.get('count')):
            raise ValueError('Detection catalogue does not match this original image.')
        array = np.asarray(points, dtype=np.float64)
        if not len(array):
            array = np.empty((0, 2))
        if (array.ndim != 2 or array.shape[1] != 2 or not np.isfinite(array).all() or
                np.any(array < 0) or np.any(array[:, 0] >= image.shape[1]) or np.any(array[:, 1] >= image.shape[0])):
            raise ValueError('Detection point outside native grid.')
        method = 'pinned-full-detection-catalogue-plus-bounded-multiscale-native-windows'
    else:
        array = np.empty((0, 2))
        method = 'bounded-multiscale-native-window-discovery'
    old = diverse_candidates(array, image, count//2 if len(windows) else count)
    new = diverse_candidates(windows, image, count-len(old))
    merged = [group[i] for i in range(max(len(old), len(new))) for group in (old, new) if i < len(group)]
    return list({tuple(p): p for p in merged}.values())[:count], method


def snap_point(image, point, radius=32):
    px, py = point_value(point, image)
    x0, y0 = max(0, int(px)-radius), max(0, int(py)-radius)
    x1, y1 = min(image.shape[1], int(px)+radius+1), min(image.shape[0], int(py)+radius+1)
    data = light(image[y0:y1, x0:x1])
    signal = data-ndimage.gaussian_filter(data, 12)
    yy, xx = np.mgrid[y0:y1, x0:x1]
    distance = np.hypot(xx-px, yy-py)
    peaks = (signal == ndimage.maximum_filter(signal, 3)) & (signal > .005) & (distance <= radius)
    score = np.where(peaks, signal/(1+(distance/24)**2), -np.inf)
    if not peaks.any():
        return point
    y, x = np.unravel_index(np.argmax(score), score.shape)
    return dict(x=int(xx[y, x]), y=int(yy[y, x]))


def select_samples(results, count, dimensions):
    groups = {}
    for item in results:
        sample = item[0]
        if not sample['qualified']:
            continue
        x, y = sample['point']['x'], sample['point']['y']
        key = (int(x*3/dimensions[0]), int(y*3/dimensions[1]), int(np.searchsorted([1.5, 3, 6], sample['metrics']['fwhmPixels'])))
        groups.setdefault(key, []).append(item)
    for group in groups.values():
        group.sort(key=lambda item: -item[0]['metrics']['confidence'])
    qualified = [group[i] for i in range(max([len(g) for g in groups.values()] or [0]))
                 for group in groups.values() if i < len(group)]
    flagged = sorted((r for r in results if not r[0]['qualified']), key=lambda r: -r[0]['metrics']['peakContrast'])
    # Two bright flagged examples make saturation/blending limits inspectable.
    if len(qualified) >= count:
        return qualified[:count-min(2, len(flagged))]+flagged[:2]
    return (qualified+flagged)[:count]


def calibration(samples, controls):
    qualified = [s for s in samples if s['qualified']]
    widths = [s['metrics']['fwhmPixels']*controls['widthScale'] for s in qualified]
    betas = [controls['betaOverride'] or s['metrics']['beta'] for s in qualified]
    return dict(sampleCount=len(samples), qualifiedCount=len(qualified),
                fwhmMedianPixels=float(np.median(widths)) if widths else None,
                fwhmP10Pixels=float(np.percentile(widths, 10)) if widths else None,
                fwhmP90Pixels=float(np.percentile(widths, 90)) if widths else None,
                betaMedian=float(np.median(betas)) if betas else None, controls=controls,
                meaning='Empirical distribution of qualified selected native-star fits; individual fits remain independent.')


def profile_bank(samples):
    """At most six robust size/shape groups; no rejected reference influences a template."""
    references = sorted((s for s in samples if s['qualified']), key=lambda s: s['metrics']['fwhmPixels'])
    groups = []
    for sample in references:
        width, ellipticity = sample['metrics']['fwhmPixels'], sample['metrics']['ellipticity']
        eligible = [g for g in groups if width/g[0]['metrics']['fwhmPixels'] <= 1.35 and
                    abs(ellipticity-np.median([s['metrics']['ellipticity'] for s in g])) <= .15]
        if eligible:
            eligible[-1].append(sample)
        else:
            groups.append([sample])
    while len(groups) > 6:
        pair = min(range(len(groups)-1), key=lambda i: abs(math.log(
            np.median([s['metrics']['fwhmPixels'] for s in groups[i+1]]) /
            np.median([s['metrics']['fwhmPixels'] for s in groups[i]]))))
        groups[pair:pair+2] = [groups[pair]+groups[pair+1]]
    bank = []
    for i, group in enumerate(groups):
        widths = [s['metrics']['fwhmPixels'] for s in group]
        width = float(np.median(widths))
        beta = float(np.median([s['metrics']['beta'] for s in group]))
        ellipticity = float(np.median([s['metrics']['ellipticity'] for s in group]))
        alpha = width/(2*math.sqrt(2**(1/beta)-1))
        observed_limit = min(s['fit']['fittingRadiusPixels'] for s in group)*.8
        radius = min(observed_limit, alpha/math.sqrt(1-ellipticity)*math.sqrt(.01**(-1/beta)-1))
        bank.append(dict(id=f'profile-{i+1}', referenceIds=[s['id'] for s in group],
            referenceCount=len(group), fwhmPixels=width, supportedFwhmPixels=[min(widths)*.8, max(widths)*1.25],
            beta=beta, ellipticity=ellipticity, maximumEllipticity=min(.45, max(s['metrics']['ellipticity'] for s in group)+.15),
            detectionSigmaPixels=width/2.355, maskRadiusPixels=float(radius), relativeProfileFloor=.01,
            maskMeaning='One-percent peak profile support, limited by the native reference neighborhood; not a physical stellar boundary.'))
    return bank


def bank_preview(sample, state, bank):
    """Use shared shape/size, fitting only RGB amplitude/background at the measured pose."""
    patch, xx, yy, p = (state[key] for key in ('patch', 'xx', 'yy', 'parameters'))
    empty = np.zeros_like(patch)
    rejected = dict(accepted=False, profileId=None, reasons=[], modelKind='shared-profile-bank', bankFitRelativeRmse=None)
    if not sample['qualified']:
        rejected['reasons'] = sample['metrics']['flags'] or ['insufficient-fit-confidence']
        return empty, patch.copy(), np.zeros(patch.shape[:2], np.uint8), rejected
    width, ellipticity = sample['metrics']['fwhmPixels'], sample['metrics']['ellipticity']
    compatible = [template for template in bank if template['supportedFwhmPixels'][0] <= width <= template['supportedFwhmPixels'][1]
                  and ellipticity <= template['maximumEllipticity']]
    if not compatible:
        rejected['reasons'] = ['outside-learned-profile-coverage'] if bank else ['no-qualified-reference-profiles']
        return empty, patch.copy(), np.zeros(patch.shape[:2], np.uint8), rejected
    template = min(compatible, key=lambda t: abs(math.log(width/t['fwhmPixels'])) + abs(ellipticity-t['ellipticity']))
    rejected['profileId'] = template['id']
    radius = template['maskRadiusPixels']
    cx, cy = p[0], p[1]
    if min(cx-xx.min(), xx.max()-cx, cy-yy.min(), yy.max()-cy) < radius:
        rejected['reasons'] = ['learned-mask-exceeds-candidate-neighborhood']
        return empty, patch.copy(), np.zeros(patch.shape[:2], np.uint8), rejected
    alpha = template['fwhmPixels']/(2*math.sqrt(2**(1/template['beta'])-1))
    q = 1-template['ellipticity']
    angle = p[4] if p[2] >= p[3] else p[4]+math.pi/2
    profile = moffat(xx, yy, cx, cy, alpha/math.sqrt(q), alpha*math.sqrt(q), angle, template['beta'])
    mask = (profile >= template['relativeProfileFloor']) & (np.hypot(xx-cx, yy-cy) <= radius)
    design = np.stack([profile, np.ones_like(xx), xx/state['patch'].shape[1], yy/state['patch'].shape[0]], axis=-1)
    normalized = patch.astype(float)/np.iinfo(patch.dtype).max
    models, backgrounds = [], []
    for channel in range(3):
        use = np.ones(patch.shape[:2], bool)
        for _ in range(3):
            coefficients = np.linalg.lstsq(design[use], normalized[:, :, channel][use], rcond=None)[0]
            delta = normalized[:, :, channel]-design @ coefficients
            scatter = max(.001, float(np.median(np.abs(delta[use]-np.median(delta[use]))))*1.4826)
            next_use = np.abs(delta) < 4*scatter
            if next_use.sum() >= 20:
                use = next_use
        models.append(profile*max(0, coefficients[0]))
        backgrounds.append(design[:, :, 1:] @ coefficients[1:])
    predicted, background = np.stack(models, axis=2), np.stack(backgrounds, axis=2)
    core = np.hypot(xx-cx, yy-cy) <= max(3, width*1.5)
    error = float(np.sqrt(np.mean((normalized[core]-(predicted+background)[core])**2))/max(.01, sample['metrics']['peakContrast']))
    rejected['bankFitRelativeRmse'] = error
    if error > .18:
        rejected['reasons'] = ['shared-profile-mismatch']
        return empty, patch.copy(), np.zeros(patch.shape[:2], np.uint8), rejected
    # Preserve the fitted broad background; this is bounded positive compact light only.
    signal = np.minimum(predicted, np.maximum(0, normalized-background))
    signal[~mask] = 0
    removed = np.minimum(patch, np.rint(np.clip(signal, 0, 1)*np.iinfo(patch.dtype).max).astype(patch.dtype))
    return removed, patch-removed, mask.astype(np.uint8)*255, {**rejected, 'accepted': True}


def bank_candidates(image, bank, references, progress=None):
    """Detection scales come from the learned bank; only sixteen native windows are searched."""
    found = []
    scales = [profile['detectionSigmaPixels'] for profile in bank]
    for row, cy in enumerate(np.linspace(112, max(112, image.shape[0]-113), 4)):
        for column, cx in enumerate(np.linspace(112, max(112, image.shape[1]-113), 4)):
            x0, y0 = max(0, int(cx)-112), max(0, int(cy)-112)
            crop = light(image[y0:min(y0+225, image.shape[0]), x0:min(x0+225, image.shape[1])])
            candidates = {}
            for sigma in scales:
                response = ndimage.gaussian_filter(crop, sigma)-ndimage.gaussian_filter(crop, sigma*2.5)
                scatter = max(.0001, 1.4826*float(np.median(np.abs(response-np.median(response)))))
                ys, xs = np.nonzero((response == ndimage.maximum_filter(response, max(3, int(round(sigma*2)) | 1))) &
                                    (response > max(.002, scatter*4)))
                for index in np.argsort(response[ys, xs])[-8:]:
                    point = (int(xs[index]+x0), int(ys[index]+y0))
                    if all(math.hypot(point[0]-s['point']['x'], point[1]-s['point']['y']) >
                           max(32, s['metrics']['fwhmPixels']*4) for s in references):
                        candidates[point] = max(candidates.get(point, 0), float(response[ys[index], xs[index]]))
            found.extend(point for point, _ in sorted(candidates.items(), key=lambda item: -item[1])[:4])
            if progress:
                current = row*4+column+1
                progress(dict(stage='calibrated-detection', current=current, total=16,
                              message=f'Checking learned profiles in native window {current} of16'))
    return list(dict.fromkeys(found))[:64]


def screen_template(template):
    radius = max(8, int(math.ceil(template['maskRadiusPixels']))+4)
    yy, xx = np.mgrid[-radius:radius+1, -radius:radius+1].astype(float)
    alpha = template['fwhmPixels']/(2*math.sqrt(2**(1/template['beta'])-1))
    profile = moffat(xx, yy, 0, 0, alpha, alpha, 0, template['beta'])
    design = np.stack([profile, np.ones_like(xx), xx/radius, yy/radius], axis=-1)
    return radius, xx, yy, design, np.linalg.pinv(design.reshape(-1, 4))


def screen_candidate(image, x, y, template, screen):
    """Loose linear screening only; passing never substitutes for the original quality guards."""
    radius, xx, yy, design, inverse = screen
    if x-radius < 0 or y-radius < 0 or x+radius >= image.shape[1] or y+radius >= image.shape[0]:
        return False, 'screen-edge'
    patch = image[y-radius:y+radius+1, x-radius:x+radius+1]
    data = light(patch)
    coefficients = inverse @ data.ravel()
    amplitude = coefficients[0]
    if amplitude <= 0:
        return False, 'screen-nonpositive-profile'
    distance = np.hypot(xx, yy)
    core = distance <= max(1, template['fwhmPixels']/2)
    if np.any(np.any(patch == np.iinfo(image.dtype).max, axis=2) & core):
        return False, 'screen-saturated-core'
    region = distance <= max(3, template['fwhmPixels']*1.5)
    mismatch = float(np.sqrt(np.mean((data-design @ coefficients)[region]**2))/max(amplitude, .01))
    if mismatch > .45:
        return False, 'screen-incompatible-profile'
    excess = data-design[:, :, 1:] @ coefficients[1:]
    peaks = (excess == ndimage.maximum_filter(excess, 3)) & (excess > amplitude*.25)
    crowded = peaks & (distance > max(2, template['fwhmPixels']*.8)) & (distance < max(6, template['fwhmPixels']*2.5))
    if crowded.any():
        return False, 'screen-crowded'
    return True, None


def remove_with_bank(image, bank, maximum_radius=128, limits=None, progress=None, baseline_stars=None, baseline_mask=None, reference_points=None):
    """Full native grid, bounded tiled detection; nonlinear verification only after cheap screening."""
    allowed = {**APPLY_LIMITS, 'maximumDetections': image.shape[0]*image.shape[1]}
    bounds = {**allowed, **(limits or {})}
    if set(bounds) != set(allowed) or any(type(v) is not int or v <= 0 or v > allowed[k] for k, v in bounds.items()):
        raise ValueError('Invalid bounded image-removal limits.')
    if (baseline_stars is None) != (baseline_mask is None):
        raise ValueError('Both approved baseline residual and mask are required together.')
    if baseline_stars is not None and (baseline_stars.shape != image.shape or baseline_stars.dtype != image.dtype or
            baseline_mask.shape != image.shape[:2] or baseline_mask.dtype != np.uint8 or
            np.any(baseline_stars > image) or np.any(np.any(baseline_stars != 0,axis=2) & (baseline_mask == 0))):
        raise ValueError('Approved baseline does not share the native source grid and positive masked accounting.')
    residual = baseline_stars.copy() if baseline_stars is not None else np.zeros_like(image)
    mask = baseline_mask.copy() if baseline_mask is not None else np.zeros(image.shape[:2], np.uint8)
    selected = {}
    for point in reference_points or []:
        px, py = point_value(point,image)
        selected[(min(image.shape[1]-1,round(px)),min(image.shape[0]-1,round(py)))] = point
    screens = {t['id']: screen_template(t) for t in bank}
    halo = int(math.ceil(max(t['detectionSigmaPixels'] for t in bank)*10))+2
    tile, height, width = bounds['tileSize'], image.shape[0], image.shape[1]
    counts = dict(detected=0, screened=0, verified=0, accepted=0, extended=0, referenceVerified=0)
    rejected, matches = {}, []
    total_tiles = math.ceil(height/tile)*math.ceil(width/tile)
    for index, (y, x) in enumerate((y, x) for y in range(0, height, tile) for x in range(0, width, tile)):
        x0, y0, x1, y1 = max(0, x-halo), max(0, y-halo), min(width, x+tile+halo), min(height, y+tile+halo)
        patch = light(image[y0:y1, x0:x1])
        candidates = {}
        for template in bank:
            sigma = template['detectionSigmaPixels']
            response = ndimage.gaussian_filter(patch, sigma, mode='reflect')-ndimage.gaussian_filter(patch, sigma*2.5, mode='reflect')
            central = response[y-y0:min(y+tile,height)-y0, x-x0:min(x+tile,width)-x0]
            scatter = max(.0001, 1.4826*float(np.median(np.abs(central-np.median(central)))))
            ys, xs = np.nonzero((response == ndimage.maximum_filter(response, max(3, int(round(sigma*2)) | 1))) &
                                (response > max(.002, scatter*4)))
            for py, px in zip(ys, xs):
                nx, ny = int(px+x0), int(py+y0)
                if x <= nx < min(width,x+tile) and y <= ny < min(height,y+tile):
                    candidates.setdefault((nx, ny), []).append(template)
        counts['detected'] += len(candidates)
        if counts['detected'] > bounds['maximumDetections']:
            raise ValueError('Learned detector capacity exceeded; no completed image produced and no candidates silently truncated.')
        # An accepted reference preview must not be lost at the cheaper discovery/screening stages.
        for point in selected:
            if x <= point[0] < min(width,x+tile) and y <= point[1] < min(height,y+tile):
                candidates.setdefault(point,bank)
        last_progress = time.monotonic()
        for candidate_index, ((nx, ny), templates) in enumerate(candidates.items()):
            if progress and candidate_index and (candidate_index % 2048 == 0 or time.monotonic()-last_progress >= 2):
                progress(dict(stage='screening-stars', current=candidate_index, total=len(candidates),
                    message=f'Tile {index+1} of {total_tiles}: checked {candidate_index} of {len(candidates)} peaks', counts=counts.copy()))
                last_progress = time.monotonic()
            is_reference = (nx,ny) in selected
            plausible = is_reference
            if not is_reference:
                for template in templates:
                    passed, reason = screen_candidate(image, nx, ny, template, screens[template['id']])
                    plausible |= passed
                    if passed:
                        break
                counts['screened'] += 1
            if not plausible:
                rejected[reason] = rejected.get(reason, 0)+1
                continue
            if counts['verified'] >= bounds['maximumVerifications']:
                raise ValueError('Profile verification capacity exceeded; no completed image produced and no candidates silently truncated.')
            counts['verified'] += 1
            counts['referenceVerified'] += int(is_reference)
            sample, state = fit_star(image, selected.get((nx,ny),dict(x=nx,y=ny)), maximum_radius)
            model, _, local_mask, verdict = bank_preview(sample, state, bank)
            if not verdict['accepted']:
                for reason in verdict['reasons']:
                    rejected[reason] = rejected.get(reason, 0)+1
                continue
            box = sample['cutout']
            bx, by, w, h = (box[key] for key in ('x', 'y', 'width', 'height'))
            extends = bool(np.any(model > residual[by:by+h, bx:bx+w]))
            counts['extended'] += int(extends)
            np.maximum(residual[by:by+h, bx:bx+w], model, out=residual[by:by+h, bx:bx+w])
            np.maximum(mask[by:by+h, bx:bx+w], local_mask, out=mask[by:by+h, bx:bx+w])
            counts['accepted'] += 1
            mask_y, mask_x = np.nonzero(local_mask)
            matches.append(dict(seed=dict(x=nx,y=ny), centroid=sample['point'], profileId=verdict['profileId'],
                fwhmPixels=sample['metrics']['fwhmPixels'],
                maskBounds=dict(x=bx+int(mask_x.min()), y=by+int(mask_y.min()),
                                width=int(mask_x.max()-mask_x.min()+1), height=int(mask_y.max()-mask_y.min()+1)),
                maskPixels=int(np.count_nonzero(local_mask)), extendsResidual=extends, selectedReference=is_reference,
                bankFitRelativeRmse=verdict['bankFitRelativeRmse']))
        if progress:
            progress(dict(stage='removing-stars', current=index+1, total=total_tiles,
                          message=f'Checked native tile {index+1} of {total_tiles}; matched {counts["accepted"]} stars', counts=counts.copy()))
    return image-residual, residual, mask, counts, rejected, matches


def validate_apply_calibration(request, source, script_hash, image):
    pin = request.get('calibration')
    if not isinstance(pin, dict) or set(pin) != {'recipePath', 'recipeSha256'}:
        raise ValueError('Apply requires a pinned completed calibration recipe.')
    recipe = pinned_json(dict(path=pin['recipePath'], sha256=pin['recipeSha256']))
    points = request.get('points')
    if not isinstance(points, list) or not 1 <= len(points) <= 50:
        raise ValueError('Apply needs the exact selected calibration points.')
    for point in points:
        point_value(point, image)
    if (recipe.get('schema') != 'cssearth-star-profile-bank@1' or recipe.get('scope') != 'native-cutout-validation' or
            recipe.get('source') != source or recipe.get('referencePoints') != points or recipe.get('scriptSha256') != script_hash):
        raise ValueError('Calibration differs from the source, selected references or current sampler.')
    bank = recipe.get('profileBank')
    if not isinstance(bank, list) or not 1 <= len(bank) <= 6:
        raise ValueError('Apply requires at least one qualified learned profile.')
    ids = set()
    for template in bank:
        if not isinstance(template.get('id'), str) or template['id'] in ids:
            raise ValueError('Invalid learned profile identity.')
        ids.add(template['id'])
        for key, low, high in (('fwhmPixels',1,128), ('beta',1.1,8), ('ellipticity',0,.45),
                               ('maximumEllipticity',0,.45), ('detectionSigmaPixels',.1,64),
                               ('maskRadiusPixels',1,128), ('relativeProfileFloor',.01,.01)):
            value = template.get(key)
            if isinstance(value, bool) or not isinstance(value,(int,float)) or not math.isfinite(value) or not low <= value <= high:
                raise ValueError('Invalid learned profile parameter: '+key)
        support = template.get('supportedFwhmPixels')
        if not isinstance(support,list) or len(support)!=2 or not 0 < support[0] <= template['fwhmPixels'] <= support[1] <= 160:
            raise ValueError('Invalid learned profile width support.')
    return recipe, bank


def approved_baseline(request, source, image):
    pin = request.get('baseline')
    if not isinstance(pin,dict) or set(pin) != {'receiptPath','receiptSha256','outputDirectory'}:
        raise ValueError('Apply requires the pinned approved baseline.')
    receipt = pinned_json(dict(path=pin['receiptPath'],sha256=pin['receiptSha256']))
    if (receipt.get('schema') != 'cssearth-star-separation-receipt@1' or
            receipt.get('sourceSha256') != source['sha256'] or receipt.get('source',{}).get('sha256') != source['sha256'] or
            receipt.get('source',{}).get('nativeDimensions') != source['nativeDimensions']):
        raise ValueError('Approved baseline receipt belongs to a different source grid.')
    folder, images, pins = Path(pin['outputDirectory']), {}, {}
    for name in ('diffuse.png','stars.png','star-mask.png'):
        path, evidence = folder/name, receipt.get('outputs',{}).get(name,{})
        if not path.is_file() or path.stat().st_size != evidence.get('bytes') or sha256(path) != evidence.get('sha256'):
            raise ValueError('Approved baseline artifact is absent or altered: '+name)
        pixels = cv2.imread(str(path),cv2.IMREAD_UNCHANGED)
        expected_shape, expected_type = (image.shape[:2],np.uint8) if name == 'star-mask.png' else (image.shape,image.dtype)
        if pixels is None or pixels.shape != expected_shape or pixels.dtype != expected_type:
            raise ValueError('Approved baseline artifact has a different native grid or type.')
        images[name], pins[name] = pixels, evidence
    for y in range(0,image.shape[0],256):
        diffuse, stars, mask = (images[name][y:y+256] for name in ('diffuse.png','stars.png','star-mask.png'))
        if (not np.array_equal(diffuse.astype(np.uint32)+stars,image[y:y+256]) or
                np.any(np.any(stars != 0,axis=2) & (mask == 0))):
            raise ValueError('Approved baseline fails original = diffuse + stars or outside-mask accounting.')
    return images['stars.png'], images['star-mask.png'], {**pin,'outputs':pins}


def cached_fit(image, source_hash, point, radius, cache_directory, script_hash=None):
    identity = dict(schema='cssearth-star-fit-cache@1', sourceSha256=source_hash,
                    scriptSha256=script_hash or sha256(__file__), requestedPoint=point, maximumRadius=radius,
                    dependencies=dict(numpy=np.__version__, scipy=scipy.__version__, opencv=cv2.__version__))
    key = hashlib.sha256(json.dumps(identity, sort_keys=True).encode()).hexdigest()
    path = cache_directory/(key+'.json')
    if path.is_file():
        cached = json.loads(path.read_text())
        if cached.get('identity') != identity:
            raise ValueError('Fit-cache identity differs.')
        sample, state = cached['sample'], cached['state']
        box = sample['cutout']
        x0, y0, w, h = (box[key] for key in ('x', 'y', 'width', 'height'))
        if (not all(type(v) is int for v in (x0, y0, w, h)) or min(x0, y0) < 0 or min(w, h) < 1 or
                x0+w > image.shape[1] or y0+h > image.shape[0] or sample['requestedPoint'] != point):
            raise ValueError('Invalid cached native cutout.')
        p, amplitudes = np.array(state['parameters']), state['amplitudes']
        if p.shape != (10,) or len(amplitudes) != 3 or not np.isfinite([*p, *amplitudes]).all():
            raise ValueError('Invalid cached fit coefficients.')
        yy, xx = np.mgrid[y0:y0+h, x0:x0+w].astype(float)
        ix, iy = min(round(point['x']), image.shape[1]-1), min(round(point['y']), image.shape[0]-1)
        return sample, dict(patch=image[y0:y0+h, x0:x0+w], xx=xx-ix, yy=yy-iy, parameters=p, amplitudes=amplitudes), True
    sample, internals = fit_star(image, point, radius)
    cache_directory.mkdir(parents=True, exist_ok=True)
    cached = dict(identity=identity, sample=sample, state=dict(parameters=internals['parameters'].tolist(), amplitudes=internals['amplitudes']))
    temporary = path.with_suffix('.'+str(os.getpid())+'.tmp')
    temporary.write_text(json.dumps(cached, allow_nan=False))
    temporary.replace(path)
    return sample, internals, False


def write_image(path, image):
    if not cv2.imwrite(str(path), image, [cv2.IMWRITE_PNG_COMPRESSION, 3]):
        raise OSError('Could not write sample image.')


def reduced_preview(image, maximum):
    scale = min(1, maximum/max(image.shape[:2]))
    size = (max(1, round(image.shape[1]*scale)), max(1, round(image.shape[0]*scale)))
    sample = cv2.resize(image, size, interpolation=cv2.INTER_AREA) if scale < 1 else image
    if image.dtype == np.uint16:
        sample = np.rint(sample.astype(float)/257).astype(np.uint8)
    return sample


def run_apply(request, image, source, output, options, script_hash, started, emit):
    learned_recipe, bank = validate_apply_calibration(request, source, script_hash, image)
    baseline_stars, baseline_mask, baseline = approved_baseline(request,source,image)
    if output.resolve() == Path(baseline['outputDirectory']).resolve():
        raise ValueError('Apply outputs must not overwrite the approved baseline.')
    output.mkdir(parents=True, exist_ok=True)
    for name in ('receipt.json', 'result.json'):
        (output/name).unlink(missing_ok=True)
    emit(dict(stage='apply-calibration-verified', current=0, total=1, message='Verified the selected native-star calibration'))
    diffuse, stars, mask, counts, rejected, matches = remove_with_bank(image, bank, options['maximumRadius'], progress=emit,
        baseline_stars=baseline_stars,baseline_mask=baseline_mask,reference_points=learned_recipe['referencePoints'])
    checks = dict(maximumReconstructionErrorCodeValues=0, changedPixelsOutsideMask=0, baselineRestoredPixels=0, encodedRoundTripExact=False)
    for y in range(0, image.shape[0], 256):
        original = image[y:y+256].astype(np.int32)
        difference = original-diffuse[y:y+256].astype(np.int32)-stars[y:y+256].astype(np.int32)
        checks['maximumReconstructionErrorCodeValues'] = max(checks['maximumReconstructionErrorCodeValues'], int(np.abs(difference).max()))
        checks['changedPixelsOutsideMask'] += int(np.count_nonzero(np.any(diffuse[y:y+256] != image[y:y+256], axis=2) & (mask[y:y+256] == 0)))
        checks['baselineRestoredPixels'] += int(np.count_nonzero(np.any(stars[y:y+256] < baseline_stars[y:y+256],axis=2)))
    if checks['maximumReconstructionErrorCodeValues'] or checks['changedPixelsOutsideMask'] or checks['baselineRestoredPixels']:
        raise AssertionError('Full native-grid removal accounting failed.')
    native = {'diffuse': 'diffuse.png', 'stars': 'stars.png', 'mask': 'star-mask.png'}
    for index, (name, expected) in enumerate((('diffuse.png', diffuse), ('stars.png', stars), ('star-mask.png', mask))):
        emit(dict(stage='writing-native-image', current=index+1, total=3, message=f'Writing native {name}'))
        write_image(output/name, expected)
        reloaded = cv2.imread(str(output/name), cv2.IMREAD_UNCHANGED)
        if reloaded is None or reloaded.dtype != expected.dtype or not np.array_equal(reloaded, expected):
            raise AssertionError('Encoded native PNG changed pixels: '+name)
        del reloaded
    checks['encodedRoundTripExact'] = True
    previews = dict(diffuse='diffuse-preview.png', stars='stars-preview.png', comparison='comparison.png')
    write_image(output/previews['diffuse'], reduced_preview(diffuse, 4096))
    write_image(output/previews['stars'], reduced_preview(stars, 4096))
    write_image(output/previews['comparison'], np.concatenate([reduced_preview(im, 1200) for im in (image, diffuse, stars)], axis=1))
    write_image(output/'overview.png', reduced_preview(image, 1200))
    match_path = output/'matches.json'
    match_path.write_text(json.dumps(dict(nativeDimensions=source['nativeDimensions'], count=len(matches), matches=matches), allow_nan=False)+'\n')
    recipe = dict(schema='cssearth-star-image-removal@1', source=source, calibration=request['calibration'],baseline=baseline,
        scriptSha256=script_hash, parameters={**APPLY_LIMITS, 'maximumDetections': image.shape[0]*image.shape[1],
                                            'maximumRadius': options['maximumRadius']},
        matches=dict(path='matches.json', sha256=sha256(match_path), count=len(matches)),
        method='Extend the approved native baseline using learned-scale DoG detection and conservative screening. Selected references bypass discovery/screening only. Every match passes unchanged fit/bank quality guards. Maximum positive RGB residual across baseline and new estimates; subtract from source once.',
        scope='full-native-image-only; no volume or 3D preparation')
    (output/'applied-recipe.json').write_text(json.dumps(recipe, indent=2, allow_nan=False)+'\n')
    pins = {path.name: sha256(path) for path in sorted(output.glob('*.png'))}
    applied = dict(nativeDimensions=source['nativeDimensions'], sourceDtype=str(image.dtype), images=native, previews=previews,
                   counts=counts, rejected=rejected, verification=checks, calibrationRecipeSha256=request['calibration']['recipeSha256'],
                   baselineReceiptSha256=baseline['receiptSha256'])
    receipt = dict(schema='cssearth-star-image-removal-receipt@1', source=source, sourceSha256=source['sha256'],
        scriptSha256=script_hash, requestSha256=hashlib.sha256(json.dumps(request, sort_keys=True).encode()).hexdigest(),
        calibration=request['calibration'], baseline=baseline, recipeSha256=sha256(output/'applied-recipe.json'),
        dependencies=dict(numpy=np.__version__, scipy=scipy.__version__, opencv=cv2.__version__),
        counts=counts, rejected=rejected, verification=checks, matches=recipe['matches'], artifactSha256=pins,
        coordinateConvention='Exact input native pixel grid; no EXIF orientation, resampling, sky subtraction or cropping.',
        limitations=['Inferred compact light, not physical stellar membership or calibrated photometry.',
                     'Only learned profiles are searched; saturated, crowded and poor-fitting candidates remain.',
                     'Conservative linear screening can reject additional candidates; passing it never bypasses the original quality guards.',
                     'Compact nebular knots can resemble stars. This is not scientifically reliable deblending.'],
        elapsedSeconds=round(time.monotonic()-started, 3))
    (output/'receipt.json').write_text(json.dumps(receipt, indent=2, allow_nan=False)+'\n')
    overview = cv2.imread(str(output/'overview.png'), cv2.IMREAD_UNCHANGED)
    result = dict(schema='cssearth-star-sampling-result@1', operation='apply', sourceSha256=source['sha256'],
        nativeDimensions=source['nativeDimensions'], sourceDtype=str(image.dtype), samples=[],
        overview=dict(path='overview.png', dimensions=[overview.shape[1], overview.shape[0]]),
        calibration=dict(profileBank=bank, sampleCount=len(learned_recipe['referencePoints']),
                         qualifiedCount=sum(t['referenceCount'] for t in bank)),
        appliedImage=applied, recipe=recipe, artifactSha256=pins, artifactsRelativeTo=str(output),
        provenance=dict(scriptSha256=script_hash, requestSha256=receipt['requestSha256'], receiptSha256=sha256(output/'receipt.json')),
        limitations=receipt['limitations'], elapsedSeconds=receipt['elapsedSeconds'])
    (output/'result.json').write_text(json.dumps(result, indent=2, allow_nan=False)+'\n')
    return result


def validate_bank(image, source_hash, references, bank, output, radius, script_hash, emit):
    points = bank_candidates(image, bank, references, emit) if bank else []
    checked, cache_hits = [], 0
    for index, (x, y) in enumerate(points):
        sample, state, hit = cached_fit(image, source_hash, dict(x=float(x), y=float(y)), radius, output.parent/'fits-cache', script_hash)
        cache_hits += int(hit)
        model, residual, mask, verdict = bank_preview(sample, state, bank)
        checked.append(({**sample, **verdict, 'id': 'bank-'+sample['id']}, state, model, residual, mask))
        emit(dict(stage='validating', current=index+1, total=len(points), message=f'Tested learned profiles on candidate {index+1} of {len(points)}'))
    accepted = [row for row in checked if row[0]['accepted']]
    rejected = [row for row in checked if not row[0]['accepted']]
    displayed = (accepted[:10]+rejected[:max(2, 12-len(accepted[:10]))])[:12]
    samples = []
    for sample, state, model, residual, mask in displayed:
        sample['images'] = {name: sample['id']+'-'+name+'.png' for name in ('source', 'model', 'residual', 'comparison', 'mask')}
        for name, value in (('source', state['patch']), ('model', model), ('residual', residual), ('mask', mask),
                            ('comparison', np.concatenate([state['patch'], model, residual], axis=1))):
            write_image(output/sample['images'][name], value)
        sample['previewAccountingExact'] = bool(np.array_equal(model.astype(np.uint32)+residual, state['patch']))
        sample['changedPixelsOutsideMask'] = int(np.count_nonzero(np.any(state['patch'] != residual, axis=2) & (mask == 0)))
        if not sample['previewAccountingExact'] or sample['changedPixelsOutsideMask']:
            raise AssertionError('Calibrated native crop accounting failed.')
        samples.append(sample)
    return samples, dict(candidateCount=len(points), acceptedCount=len(accepted), displayedCount=len(samples),
                        cacheHits=cache_hits, meaning='Bounded unselected candidate check, not a full-image completeness or accuracy estimate.')


def run(request):
    started = time.monotonic()
    script_hash = sha256(__file__)
    emit = lambda value: print(json.dumps(value), flush=True)
    required = {'schema', 'operation', 'source', 'outputDirectory'}
    if (not isinstance(request, dict) or not required <= set(request) or
            set(request)-required-{'detections', 'point', 'points', 'options', 'controls', 'calibration', 'baseline'} or
            request['schema'] != 'cssearth-star-sampling@1' or request['operation'] not in ('survey', 'inspect', 'preview', 'apply')):
        raise ValueError('Invalid native star-sampling request.')
    o, c = settings(request.get('options'), request.get('controls'))
    source, operation = request['source'], request['operation']
    image = read_source(source)
    output = Path(request['outputDirectory'])
    if '.local' not in output.resolve().parts or output.resolve() == Path(source['path']).resolve().parent:
        raise ValueError('Sample artifacts require a distinct ignored .local directory.')
    if operation == 'apply':
        return run_apply(request, image, source, output, o, script_hash, started, emit)
    if operation == 'survey':
        points, method = catalogue_points(image, source, request.get('detections'), o['maximumCandidates'], emit)
    elif operation == 'inspect':
        snapped = snap_point(image, request.get('point'))
        points, method = [point_value(snapped, image)], 'manual-native-point-snapped-within32px'
    else:
        values = request.get('points')
        if not isinstance(values, list) or not 1 <= len(values) <= 50:
            raise ValueError('Preview requires1–50 selected native points.')
        points, method = [point_value(p, image) for p in values], 'selected-native-points'
    output.mkdir(parents=True, exist_ok=True)
    results, cache_hits = [], 0
    for index, point in enumerate(points):
        seed = dict(x=float(point[0]), y=float(point[1]))
        sample, internals, cached = cached_fit(image, source['sha256'], seed, o['maximumRadius'], output.parent/'fits-cache', script_hash)
        cache_hits += int(cached)
        emit(dict(stage='fitting', current=index+1, total=len(points), message=f'Measured star {index+1} of {len(points)}'))
        if operation == 'inspect':
            sample['inputPoint'] = request['point']
        if operation == 'survey' and any(math.hypot(sample['point']['x']-s['point']['x'], sample['point']['y']-s['point']['y']) <
                max(2, min(sample['metrics']['fwhmPixels'], s['metrics']['fwhmPixels'])/2) for s, _ in results):
            continue
        results.append((sample, internals))
    if operation == 'survey':
        results = select_samples(results, o['sampleCount'], source['nativeDimensions'])
    learned_bank = profile_bank(list({sample['id']:sample for sample,_ in results}.values())) if operation == 'preview' else None
    contributing = {reference for template in learned_bank or [] for reference in template['referenceIds']}
    samples = []
    seen = set()
    for sample, internals in results:
        if sample['id'] in seen:
            continue
        seen.add(sample['id'])
        mask = None
        if operation == 'preview':
            model,residual,mask,verdict = bank_preview(sample,internals,learned_bank)
            sample.update(verdict,contributesProfile=sample['id'] in contributing)
        else:
            model, residual = preview_model(internals, c)
        artifacts = [('source',internals['patch']),('model',model),('residual',residual),
                     ('comparison',np.concatenate([internals['patch'],model,residual],axis=1))]
        if mask is not None:
            artifacts.append(('mask',mask))
            sample['changedPixelsOutsideMask'] = int(np.count_nonzero(np.any(internals['patch']!=residual,axis=2)&(mask==0)))
        sample['images'] = {name:sample['id']+'-'+name+'.png' for name,_ in artifacts}
        for name,value in artifacts:
            write_image(output/sample['images'][name], value)
        sample['previewAccountingExact'] = bool(np.array_equal(model.astype(np.uint32)+residual, internals['patch']))
        samples.append(sample)
        emit(dict(stage='previews', current=len(samples), total=len(results), message=f'Wrote native sample {len(samples)} of {len(results)}'))
    scale = min(1, 1200/max(image.shape[:2]))
    size = (max(1, round(image.shape[1]*scale)), max(1, round(image.shape[0]*scale)))
    overview = cv2.resize(image, size, interpolation=cv2.INTER_AREA) if scale < 1 else image
    write_image(output/'overview.png', overview)
    calibrated = calibration(samples, c)
    validation = []
    if operation == 'preview':
        bank = learned_bank
        validation, checks = validate_bank(image, source['sha256'], samples, bank, output, o['maximumRadius'], script_hash, emit)
        calibrated.update(profileBank=bank, referenceCount=len(samples), excludedReferenceIds=[s['id'] for s in samples if not s['qualified']],
                          matchedReferenceCount=sum(s['accepted'] for s in samples),
                          recommendedDetectionSigmasPixels=[p['detectionSigmaPixels'] for p in bank], validation=checks,
                          meaning='Shared empirical profile bank from qualified references, applied to unselected native candidates; no full-image processing.')
    result = dict(schema='cssearth-star-sampling-result@1', operation=operation, sourceSha256=source['sha256'],
        nativeDimensions=source['nativeDimensions'], sourceDtype=str(image.dtype),
        overview=dict(path='overview.png', dimensions=list(size)), samples=samples, calibration=calibrated,
        artifactsRelativeTo=str(output), detectionMethod=method, limitations=LIMITATIONS,
        fitCache=dict(hits=cache_hits, candidates=len(points), controlsIndependent=True),
        recipe=dict(schema=request['schema'], source=source, operation='preview', outputDirectory=str(output),
                    points=[s['requestedPoint'] for s in samples], options=o, controls=c),
        provenance=dict(scriptSha256=script_hash, requestSha256=hashlib.sha256(json.dumps(request, sort_keys=True).encode()).hexdigest(),
                        detections=request.get('detections'), dependencies=dict(numpy=np.__version__, scipy=scipy.__version__, opencv=cv2.__version__)),
        elapsedSeconds=round(time.monotonic()-started, 3))
    if operation == 'preview':
        result['validationSamples'] = validation
        result['replayRequest'] = result['recipe']
        result['recipe'] = dict(schema='cssearth-star-profile-bank@1', source=source, scope='native-cutout-validation',
                              referencePoints=[s['requestedPoint'] for s in samples], profileBank=calibrated['profileBank'],
                              excludedReferenceIds=calibrated['excludedReferenceIds'], scriptSha256=script_hash)
    result['artifactSha256'] = {path.name: sha256(path) for path in sorted(output.glob('*.png'))}
    (output/'result.json').write_text(json.dumps(result, indent=2, allow_nan=False)+'\n')
    return result


if __name__ == '__main__':
    try:
        result = run(json.load(sys.stdin))
        print(json.dumps(dict(stage='complete', result=str(Path(result['artifactsRelativeTo'])/'result.json'),
                              sampleCount=len(result['samples']), qualifiedCount=result['calibration']['qualifiedCount'])))
    except (ValueError, OSError, KeyError, TypeError) as error:
        print(json.dumps(dict(stage='star-sampling-error', error=str(error))), file=sys.stderr)
        sys.exit(1)
