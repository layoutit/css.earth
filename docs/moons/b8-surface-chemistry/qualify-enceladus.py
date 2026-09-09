"""Independent native byte/value checks and source-bound scientific panels.

Does not import the converter. Uses struct byte offsets and a gnomonic planar
polygon test, independent of the converter's great-circle half-space test.
"""
from pathlib import Path
import hashlib
import json
import math
import re
import statistics
import struct

import numpy as np
from PIL import Image, ImageDraw, ImageFont
import rasterio

ROOT = Path(__file__).resolve().parent
PLAN = json.loads((ROOT/'prepare.json').read_text())
RANGES = {'depth': (.55, .81), 'ratio': (.01, .10)}
LABELS = {'depth': '2 micrometer fixed-channel depth', 'ratio': 'Near 3.1 / 1.66 micrometer ratio'}


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def decode(path, bands):
    blob = path.read_bytes()
    header = blob[:65536].decode('ascii').rstrip('\x00')
    width = int(re.search(r'\bSamples\s*=\s*(\d+)', header)[1])
    height = int(re.search(r'\bLines\s*=\s*(\d+)', header)[1])
    planes = {}
    for band in bands:
        values = struct.unpack_from('<'+'f'*(width*height), blob, 65536+(band-1)*width*height*4)
        planes[band] = np.asarray(values).reshape(height, width)
    return header, planes


def scalar_values(planes, waves):
    # Compute one native spectrum at a time in Python, independent of the
    # vectorized converter's indexing, median and continuum operations.
    outputs = {kind: np.full(planes[48].shape, -9999, dtype='float32') for kind in RANGES}
    for y, x in np.ndindex(planes[48].shape):
        sample = {band: float(array[y, x]) for band, array in planes.items()}
        if not all(math.isfinite(v) and v > -3.4e38 for v in sample.values()):
            continue
        weight = (waves[69]-waves[57])/(waves[80]-waves[57])
        continuum = sample[58]*(1-weight)+sample[81]*weight
        if continuum > 0:
            outputs['depth'][y, x] = 1-sample[70]/continuum
        if sample[48] > 0:
            outputs['ratio'][y, x] = statistics.median([sample[134], sample[135], sample[136]])/sample[48]
    return outputs


def vector(lat, lon):
    lat, lon = math.radians(lat), math.radians(lon)
    return np.array([math.cos(lat)*math.cos(lon), math.cos(lat)*math.sin(lon), math.sin(lat)])


def inside_gnomonic(query, vertices):
    # Great circles become straight lines in a tangent-plane projection.
    # Ray crossing at the origin provides a separate polygon inclusion test.
    east = np.cross([0, 0, 1], query)
    east /= np.linalg.norm(east)
    north = np.cross(query, east)
    points = []
    for vertex in vertices:
        denominator = float(vertex @ query)
        if denominator <= 0:
            return False
        points.append((float(vertex @ east)/denominator, float(vertex @ north)/denominator))
    inside = False
    for (ax, ay), (bx, by) in zip(points, points[1:]+points[:1]):
        if (ay > 0) != (by > 0) and ax+(-ay)*(bx-ax)/(by-ay) > 0:
            inside = not inside
    return inside


def color(values, mask, kind):
    low, high = RANGES[kind]
    level = np.clip((values-low)/(high-low), 0, 1)
    anchors = np.array([[30, 55, 110], [32, 148, 157], [250, 223, 107]])
    channels = [np.interp(level, [0, .5, 1], anchors[:, c]) for c in range(3)]
    rgb = np.stack(channels, axis=-1).astype('uint8')
    rgb[~mask] = [25, 28, 33]
    return Image.fromarray(rgb)


font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 17)
title = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 25)
small = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 14)
native_panel = Image.new('RGB', (1320, 1030), '#f5f5f0')
draw = ImageDraw.Draw(native_panel)
draw.text((20, 16), 'Enceladus | Native Cassini VIMS scalar observations', font=title, fill='#172332')
draw.text((20, 52), 'Source detector grids, nearest display enlargement. RC19 + Nantes archive filters retained; no photometric correction.', font=font, fill='#303840')
draw.text((20, 78), 'Dark = excluded native navigation/spectrum. These are scientific index panels, not natural-color photographs.', font=font, fill='#303840')
native = []
for number, entry in enumerate(PLAN['observations']):
    header, c = decode(ROOT/entry['calibrated'], [48, 58, 70, 81, 134, 135, 136])
    _, n = decode(ROOT/entry['navigation'], [1, 2, 3, 4, 5, 6])
    waves = [float(v) for v in re.search(r'\bCenter\s*=\s*\((.*?)\)', header, re.S)[1].split(',')]
    metrics = scalar_values(c, waves)
    good = (n[1] >= 10) & (n[1] <= 120) & (n[2] >= 0) & (n[2] < 80) & (n[3] >= 0) & (n[3] < 80) & (n[6] > 0) & (n[6] < 20000)
    native.append({'id': entry['id'], 'c': c, 'n': n, 'values': metrics, 'good': good})
    x, y = 20+(number % 3)*440, 125+(number//3)*425
    draw.text((x, y), f"{entry['id']} | {c[48].shape[1]} x {c[48].shape[0]} native", font=font, fill='#172332')
    for k, kind in enumerate(RANGES):
        values = metrics[kind]
        preview = color(values, good & (values != -9999), kind)
        preview = preview.resize((preview.width*5, preview.height*5), Image.Resampling.NEAREST)
        draw.text((x, y+28+k*187), LABELS[kind], font=small, fill='#303840')
        native_panel.paste(preview, (x, y+48+k*187))
draw.text((20, 980), 'Fixed scales: depth 0.55 to 0.81; ratio 0.01 to 0.10. Compare values cautiously: geometry, noise and wavelength drift remain.', font=font, fill='#303840')
draw.text((20, 1005), 'Data: NASA / Caltech-JPL / University of Arizona / Osuna-CNRS-Nantes Universite. CC-BY-4.0. Derived panels: cssEarth.', font=small, fill='#303840')
native_panel.save(ROOT/'evidence/native-spectral-panels.png')

panels = Image.new('RGB', (1130, 1265), '#f5f5f0')
draw = ImageDraw.Draw(panels)
draw.text((35, 15), 'Enceladus | Partial native spectral footprints', font=title, fill='#172332')
draw.text((35, 50), 'Archive-filtered values inside qualified center cells. Grid: 1024 x 512; native resolution about 7 to 18 km.', font=font, fill='#303840')
checks = []
for k, kind in enumerate(RANGES):
    output = ROOT/PLAN['outputs'][kind]
    with rasterio.open(output) as ds: values = ds.read(1)
    with rasterio.open(output.with_name(output.stem+'-observation.tif')) as ds: owners = ds.read(1)
    with rasterio.open(output.with_name(output.stem+'-source-pixel.tif')) as ds: pixels = ds.read(1)
    assert np.array_equal(values != -9999, owners != 0)
    assert np.array_equal(pixels != 0, owners != 0)
    anchors, geometry_count, unique = [], 0, {}
    for number, source in enumerate(native, 1):
        take = owners == number
        index = pixels[take]-1
        expected = source['values'][kind].reshape(-1)[index]
        assert np.array_equal(values[take], expected), 'Independent native-byte values disagree'
        unique[source['id']] = int(np.unique(index).size)
        locations = np.argwhere(take)
        for r, c in locations[np.linspace(0, len(locations)-1, 32).astype(int)]:
            sh, sw = source['n'][4].shape
            p = int(pixels[r, c])-1
            sy, sx = divmod(p, sw)
            lat, lon = 90-(r+.5)*180/values.shape[0], (c+.5)*360/values.shape[1]-180
            query = vector(lat, lon)
            support = []
            for yy in (sy-1, sy):
                for xx in (sx-1, sx):
                    if not (0 <= yy < sh-1 and 0 <= xx < sw-1): continue
                    points = [(yy, xx), (yy, xx+1), (yy+1, xx+1), (yy+1, xx)]
                    if not all(source['good'][q] for q in points): continue
                    vertices = [vector(source['n'][4][q], source['n'][5][q]) for q in points]
                    if inside_gnomonic(query, vertices): support.append([xx+1, yy+1])
            assert support, 'Output sample outside source center support'
            geometry_count += 1
            if len(anchors) < (number*3):
                anchors.append({'observation': source['id'], 'nativeSampleLineOneBased': [sx+1, sy+1],
                                'nativeLatitude': float(source['n'][4][sy, sx]), 'nativeEastLongitude': float(source['n'][5][sy, sx]),
                                'outputColumnRowZeroBased': [int(c), int(r)], 'outputLatitude': float(lat), 'outputLongitude': float(lon),
                                'sourceValuesByBand': {str(b): float(v[sy, sx]) for b, v in source['c'].items()},
                                'expectedFloat32': float(expected[np.where((locations == [r, c]).all(axis=1))[0][0]]),
                                'actualFloat32': float(values[r, c]), 'supportCellTopLeftOneBased': support})
    checks.append({'kind': kind, 'outputSha256': sha(output), 'independentExactValueMatches': int((owners != 0).sum()),
                   'independentGnomonicSupportChecks': geometry_count, 'uniqueNativeOwners': unique, 'anchors': anchors})
    top = 100+k*570
    draw.text((50, top-24), LABELS[kind]+' | range '+str(RANGES[kind]), font=font, fill='#172332')
    panels.paste(color(values, owners != 0, kind), (50, top))
    for label, x in [('-180 E', 50), ('0 E', 552), ('+180 E', 1010)]:
        draw.text((x, top+515), label, font=small, fill='#303840')
draw.text((35, 1230), 'Dark = unsupported. Surface-area footprint estimate 23.77%; no global coverage or absolute pointing accuracy claim.', font=font, fill='#303840')
panels.save(ROOT/'evidence/projected-spectral-panels.png')
report = {'schema': 'cssearth-enceladus-independent-qualification@1', 'scriptSha256': sha(__file__),
          'recipeSha256': sha(ROOT/'prepare.json'), 'checks': checks,
          'scope': 'Independent native struct bytes/formula and gnomonic source-cell containment; absolute spacecraft pointing unproven.',
          'sourceEvidence': [{'file': str(p.relative_to(ROOT)), 'sha256': sha(p)} for p in sorted((ROOT/'evidence').glob('*.png'))]}
(ROOT/'qualification-receipt.json').write_text(json.dumps(report, indent=2)+'\n')
print(json.dumps({'checkedValuesPerField': checks[0]['independentExactValueMatches'], 'geometryProbesPerField': checks[0]['independentGnomonicSupportChecks'], 'uniqueNativeOwners': sum(checks[0]['uniqueNativeOwners'].values())}))
