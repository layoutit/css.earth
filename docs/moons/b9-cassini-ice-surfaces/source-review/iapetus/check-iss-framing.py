"""Bounded original VIMS-continuum versus independent ISS-mosaic framing check.

Read the pinned original ISS band once (16.6MiB), sample existing source N
coordinates without fitting, and compare explicit wrong-frame alternatives.
No source image warp, pointing correction, geometric change or photometric fit.
Correlation is diagnostic; it does not establish a subpixel registration bound.
Run in a parent-approved small numerical slot.
"""
import argparse
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import resource
import struct
import time

ROOT = Path(__file__).resolve().parents[5]


def digest(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for block in iter(lambda: stream.read(65536), b''):
            h.update(block)
    return h.hexdigest()


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def ranks(np, values):
    order = np.argsort(values, kind='stable')
    result = np.empty(len(values), dtype=float)
    start = 0
    while start < len(values):
        end = start+1
        while end < len(values) and values[order[end]] == values[order[start]]:
            end += 1
        result[order[start:end]] = (start+end-1)/2
        start = end
    return result


def correlation(np, a, b):
    if len(a) < 3 or np.ptp(a) == 0 or np.ptp(b) == 0:
        return None
    return float(np.corrcoef(a, b)[0, 1])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--recipe', type=Path, default=ROOT/'output/b9-source-intake/iapetus/prepare-trial.json')
    parser.add_argument('--output', type=Path, default=Path(__file__).with_name('iss-framing.json'))
    args = parser.parse_args()
    import numpy as np
    import rasterio
    from PIL import Image, ImageDraw, ImageFont
    started = time.monotonic()
    manifest_path = ROOT/'src/planets/iapetus/source/manifest.json'
    manifest = json.loads(manifest_path.read_text())
    entry = next(row for row in manifest['inputs'] if row['id'] == 'cassini-voyager-2008-iapetus')
    iss = manifest_path.parent/entry['path']
    if iss.stat().st_size != entry['expectedBytes'] or digest(iss) != entry['expectedSha256']:
        raise ValueError('Original ISS mosaic pin differs')
    plan = json.loads(args.recipe.read_text())
    if plan['target'] != 'IAPETUS' or len(plan['observations']) > 3:
        raise ValueError('Unqualified source cohort')
    helper = load('independent_dense_camera', Path(__file__).with_name('qualify-rasterizer.py'))
    independent = load('independent_iapetus_math', Path(__file__).with_name('qualify-detector-footprints.py'))
    with rasterio.Env(GDAL_CACHEMAX=32*1024*1024, GDAL_NUM_THREADS='1'):
        with rasterio.open(iss) as src:
            image = src.read(1)
            transform = src.transform
            crs = src.crs.to_dict()
            if (image.shape != (2880, 5760) or src.count != 1 or image.dtype != 'uint8'
                    or crs.get('proj') != 'eqc' or crs.get('lon_0') != 0
                    or transform.b != 0 or transform.d != 0):
                raise ValueError('Unexpected original ISS map format/projection')
    radius = entry['projection']['referenceRadiusMeters']
    def sample(lon, lat):
        x = np.radians((lon+180)%360-180)*radius
        y = np.radians(lat)*radius
        col = np.floor((x-transform.c)/transform.a).astype(int)
        row = np.floor((y-transform.f)/transform.e).astype(int)
        inside = (row >= 0) & (row < image.shape[0]) & (col >= 0) & (col < image.shape[1])
        values = np.zeros(lon.shape, dtype='uint8')
        values[inside] = image[row[inside], col[inside]]
        return values, inside & (values != 0)
    alternatives = [('released-east-north', 1, 0, 1), ('longitude-reversed', -1, 0, 1),
                    ('longitude-shifted-180', 1, 180, 1), ('latitude-reversed', 1, 0, -1),
                    ('longitude-and-latitude-reversed', -1, 0, -1),
                    ('longitude-reversed-plus-180', -1, 180, 1)]
    panel = Image.new('RGB', (720, 140+330*len(plan['observations'])), '#15191e')
    draw, font = ImageDraw.Draw(panel), ImageFont.load_default(size=17)
    draw.text((20, 15), 'Iapetus: original VIMS continuum and independent ISS framing', font=font, fill='white')
    draw.text((20, 43), 'Native sample arrays; source gaps are not geographic cells.', font=font, fill='#bdc7d2')
    draw.text((20, 70), 'No pointing or photometric fit. Different wavelengths and illumination.', font=font, fill='#bdc7d2')
    output = []
    for number, obs in enumerate(plan['observations']):
        for key in ('calibrated', 'navigation'):
            if digest(args.recipe.parent/obs[key]) != plan['pins'][obs[key]]:
                raise ValueError('VIMS pin differs')
        source = helper.SourceCamera(args.recipe.parent/obs['navigation'], 'IAPETUS', independent)
        n = source.side*source.height
        with (args.recipe.parent/obs['calibrated']).open('rb') as stream:
            stream.seek(65536+(25-1)*n*4)
            continuum = np.array(struct.unpack('<'+'f'*n, stream.read(n*4)))
        nav = {band: np.asarray(values) for band, values in source.nav.items()}
        valid = np.isfinite(continuum) & (continuum > 0)
        valid &= np.isfinite(np.stack(list(nav.values()))).all(axis=0)
        valid &= ((nav[1] >= 10) & (nav[1] <= 120) & (nav[2] >= 0) & (nav[2] < 70)
                  & (nav[3] >= 0) & (nav[3] < 70) & (nav[4] >= -90) & (nav[4] <= 90)
                  & (nav[5] >= 0) & (nav[5] <= 360) & (nav[6] > 0))
        # Never cast special-pixel navigation to integer raster addresses.
        lat, lon = np.where(valid, nav[4], 0), np.where(valid, nav[5], 0)
        comparisons = []
        baseline_values, baseline_valid = sample(lon, lat)
        for name, lon_sign, shift, lat_sign in alternatives:
            values, mapped = sample(lon_sign*lon+shift, lat_sign*lat)
            take = valid & baseline_valid & mapped
            a, b = continuum[take], values[take].astype(float)
            comparisons.append({'frame': name, 'comparedNativeSamples': int(take.sum()),
                                'pearson': correlation(np, a, b),
                                'spearman': correlation(np, ranks(np, a), ranks(np, b))})
        shape = (source.height, source.side)
        native_gray = np.clip(np.rint(continuum/.5*255), 0, 255).astype('uint8').reshape(shape)
        mapped_gray = baseline_values.reshape(shape)
        for col, values in enumerate((native_gray, mapped_gray)):
            rgb = np.repeat(values[:, :, None], 3, axis=2)
            rgb[~(valid & baseline_valid).reshape(shape)] = [63, 70, 78]
            im = Image.fromarray(rgb).resize((280, 280), Image.Resampling.NEAREST)
            panel.paste(im, (20+360*col, 135+number*330))
        draw.text((20, 108+number*330), obs['id']+' : original1.28um I/F', font=font, fill='white')
        draw.text((380, 108+number*330), 'ISS at original N coordinates', font=font, fill='white')
        baseline = comparisons[0]
        draw.text((20, 419+number*330), f"Unshifted Spearman: {baseline['spearman']:.3f}; samples: {baseline['comparedNativeSamples']}", font=font, fill='#bdc7d2')
        output.append({'id': obs['id'], 'comparisons': comparisons,
                       'quantity': 'released IR band25 continuum I/F versus ISS grayscale; diagnostic only'})
    image_path = args.output.with_suffix('.png')
    panel.save(image_path)
    report = {'schema': 'iapetus-independent-iss-framing@1', 'sourceIssSha256': entry['expectedSha256'],
              'recipeSha256': digest(args.recipe), 'scriptSha256': digest(__file__),
              'sourceIssTransform': tuple(transform), 'sourceIssCrs': crs, 'sourceRadiusMeters': radius,
              'observations': output, 'panel': image_path.name, 'panelSha256': digest(image_path),
              'scope': 'Independent gross-framing comparison. No control-point fit, subpixel registration or pointing-uncertainty bound.',
              'limits': ['Different wavelengths, photographed shading, VIMS filtering and resolution affect correlation.',
                         'Shared native samples are spatially correlated; correlation is not a calibrated significance test.',
                         'Alternative comparisons use pairwise common nonmissing samples; counts are recorded.',
                         'No zero-valued ISS missing pixel is used as dark surface evidence.'],
              'wallSeconds': time.monotonic()-started,
              'peakRssBytesMacOS': resource.getrusage(resource.RUSAGE_SELF).ru_maxrss}
    args.output.write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
