"""Unfitted Phoebe source-image prediction against the unchanged prepared mesh.

No map, fit, classification threshold, acquired-scene change or coverage claim.
Run only in the root-coordinated single numeric slot with BLAS threads set to1.
"""
from pathlib import Path
import argparse
import hashlib
import importlib.util
import json
import math
import os
import re
import resource
import struct
import time

assert os.environ.get('OPENBLAS_NUM_THREADS') == '1'
assert os.environ.get('OMP_NUM_THREADS') == '1'
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[5]
OUT = Path(__file__).resolve().parent
NATIVE = ROOT/'output/b9-source-intake/phoebe/native'
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--candidate-offsets',action='store_true',help='Predict only the independently fitted IR1822 candidate; perform no additional fit.')
args=parser.parse_args()
candidate=json.loads((OUT/'native-registration-fit.json').read_text()) if args.candidate_offsets else None
angular_offsets=tuple(candidate['twoAxisFit']['offsetsRadians']) if candidate else (0.,0.)
cohort=(('1465671822_1','IR'),) if candidate else (('1465670650_1','VIS'),('1465670650_1','IR'),('1465671822_1','VIS'),('1465671822_1','IR'))
output_stem='native-registration-candidate' if candidate else 'native-registration-unfitted'
PINNED = {
    'src/planets/phoebe/prepared/terrain.json': 'a6eb3c92075986288ddfc6e59d85391891ca0d96dc0f2c427ea7fbab2e576178',
    'src/planets/phoebe/source/preparation/rotation.json': '5dba43a0956e9dd4b84819ea83d253431569afb4b5126661ef5a9c28c2a39713',
}
SOURCE_PINS = json.loads((NATIVE/'download-receipts.json').read_text())
for pin in SOURCE_PINS:
    PINNED[str((NATIVE/pin['file']).relative_to(ROOT))] = pin['sha256']


def pinned_bytes(path):
    raw = (ROOT/path).read_bytes()
    assert hashlib.sha256(raw).hexdigest() == PINNED[path], path
    return raw


for path in PINNED:
    pinned_bytes(path)
camera_path = ROOT/'tools/objects/acquisition/cassini-vims-navigation.py'
spec = importlib.util.spec_from_file_location('native_camera', camera_path)
nav = importlib.util.module_from_spec(spec)
spec.loader.exec_module(nav)
terrain = json.loads(pinned_bytes('src/planets/phoebe/prepared/terrain.json'))
assert len(terrain['faces']) == 3500
# parseObjShape preserves XYZ; radial-terrain multiplies meters by230/106500.
triangles = np.array([f['vertices'] for f in terrain['faces']], dtype=np.float64)*(106.5/230)
a = triangles[:, 0]
edge1, edge2 = triangles[:, 1]-a, triangles[:, 2]-a
normals = np.cross(edge1, edge2)
normals /= np.linalg.norm(normals, axis=1)[:, None]
assert np.all(np.sum(normals*np.array([f['normal'] for f in terrain['faces']]), axis=1) > .999999)
rotation = json.loads(pinned_bytes('src/planets/phoebe/source/preparation/rotation.json'))
comparison = json.loads((OUT/'source-model-comparison.json').read_text())
translation = np.array(comparison['surfaceRefinement']['translationKm'])


def rz(t):
    c, s = math.cos(t), math.sin(t)
    return np.array(((c, s, 0.), (-s, c, 0.), (0., 0., 1.)))


def rx(t):
    c, s = math.cos(t), math.sin(t)
    return np.array(((1., 0., 0.), (0., c, s), (0., -s, c)))


def pck(et, ra, dec):
    """NAIF PCK: [W]3 [pi/2-dec]1 [pi/2+ra]3; ET seconds past J2000."""
    w = math.radians((178.58+931.639*(et/86400)) % 360)
    return rz(w) @ rx(math.radians(90-dec)) @ rz(math.radians(90+ra))


def intersect(observer, ray):
    """Closest positive Moller-Trumbore triangle hit; one ray at a time."""
    p = np.cross(np.broadcast_to(ray, edge2.shape), edge2)
    determinant = np.einsum('ij,ij->i', edge1, p)
    good = np.abs(determinant) > 1e-12
    inv = np.divide(1., determinant, out=np.zeros_like(determinant), where=good)
    tvec = observer-a
    u = np.einsum('ij,ij->i', tvec, p)*inv
    q = np.cross(tvec, edge1)
    v = (q @ ray)*inv
    distance = np.einsum('ij,ij->i', edge2, q)*inv
    good &= (u >= 0) & (v >= 0) & (u+v <= 1) & (distance > 1e-7)
    ids = np.flatnonzero(good)
    if len(ids) == 0:
        return None
    index = int(ids[np.argmin(distance[ids])])
    return index, observer+distance[index]*ray


def sun_table(raw):
    label = raw[:65536].decode('ascii').rstrip('\0')
    candidates = [t for t in re.findall(r'Object\s*=\s*Table\s*\n(.*?)End_Object', label, re.S)
                  if nav._field(t, 'Name') == 'SunPosition']
    assert len(candidates) == 1
    t = candidates[0]
    assert nav._field(t, 'CacheType') == 'Linear'
    assert nav._field(t, 'ByteOrder') == 'Lsb'
    assert nav._field(t, 'Records') == '2'
    fields = re.findall(r'Group\s*=\s*Field\s*\n(.*?)End_Group', t, re.S)
    assert [nav._field(f, 'Name') for f in fields] == ['J2000X', 'J2000Y', 'J2000Z', 'J2000XV', 'J2000YV', 'J2000ZV', 'ET']
    assert all(nav._field(f, 'Type') == 'Double' and nav._field(f, 'Size') == '1' for f in fields)
    start, length = int(nav._field(t, 'StartByte'))-1, int(nav._field(t, 'Bytes'))
    assert length == 112
    data = raw[start:start+length]
    rows = np.array(list(struct.iter_unpack('<7d', data)))
    assert rows[0, -1] < rows[1, -1] and np.all(np.isfinite(rows))
    return rows, {'bytes': length, 'sha256': hashlib.sha256(data).hexdigest()}


def linear_sun(rows, et):
    assert rows[0, -1] <= et <= rows[1, -1]
    fraction = (et-rows[0, -1])/(rows[1, -1]-rows[0, -1])
    return (1-fraction)*rows[0, :3]+fraction*rows[1, :3]


def stats(values):
    v = np.asarray(values)
    return {'count': len(v), 'min': float(np.min(v)), 'median': float(np.median(v)),
            'p95': float(np.percentile(v, 95)), 'max': float(np.max(v))} if len(v) else {'count': 0}


def display(values):
    valid = np.isfinite(values) & (np.abs(values) < 1e30)
    low, high = np.min(values[valid]), np.max(values[valid])
    gray = np.clip(np.round(255*(values-low)/(high-low)), 0, 255).astype(np.uint8)
    image = np.repeat(gray[..., None], 3, axis=2)
    image[~valid] = [235, 70, 205]
    return image


def boundary(mask):
    interior = mask.copy()
    for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
        shifted = np.zeros_like(mask)
        shifted[max(0,dy):mask.shape[0]+min(0,dy), max(0,dx):mask.shape[1]+min(0,dx)] = mask[max(0,-dy):mask.shape[0]-max(0,dy), max(0,-dx):mask.shape[1]-max(0,dx)]
        interior &= shifted
    return mask & ~interior


start = time.monotonic()
panel = Image.new('RGB', (1350, 400 if candidate else 1260), '#171b22')
draw = ImageDraw.Draw(panel)
font, small = ImageFont.load_default(size=17), ImageFont.load_default(size=13)
draw.text((20, 14), 'Phoebe: candidate offset prediction' if candidate else 'Phoebe: unfitted native-image registration check', font=font, fill='white')
draw.text((20, 42), 'Original native band | fixed3500-face Lambert diagnostic | native + predicted limb(cyan), lit edge(yellow)', font=small, fill='#bec8d2')
draw.text((20, 63), 'No photometric fit. Center rays only. Nominal pole and estimated origin; '+('previously fitted two angular offsets, no tracking fit.' if candidate else 'no image offsets or tracking corrections.'), font=small, fill='#bec8d2')
result = {
    'schema': 'cssearth-phoebe-unfitted-native-registration@1',
    'scope': ('Previously fitted candidate forward diagnostic' if candidate else 'Unfitted forward diagnostic')+'; no mapped-source registration acceptance, detector footprint, source classification threshold, photometric parity or source geometry changes.',
    'sourcePins': SOURCE_PINS,
    'fixedPins': PINNED,
    'cameraModuleSha256': hashlib.sha256(camera_path.read_bytes()).hexdigest(),
    'modelComparisonSha256': hashlib.sha256((OUT/'source-model-comparison.json').read_bytes()).hexdigest(),
    'method': {
        'pckFormula': '[W]3 [90-Dec]1 [90+RA]3 (coordinate rotations)',
        'pckSource': 'https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/req/pck.html#Orientation%20Models%20used%20by%20PCK%20Software',
        'poleSource': 'src/planets/phoebe/source/shape/README.txt',
        'nativePoleRaDecDegrees': [355, 68.7],
        'fixedPoleRaDecDegrees': [rotation['rightAscensionDegrees'], rotation['declinationDegrees']],
        'oldGaskellToNewEstimatedTranslationKm': translation.tolist(),
        'originLimit': 'Initialization assumes native SPICE target origin corresponds to historical model origin; author exact displacement and absolute pointing remain unresolved.',
        'terrainScaleToKm': 106.5/230,
        'terrainFaces': 3500,
        'prediction': 'Per-native-pixel midpoint camera ray, nominal PCK frame conversion and estimated origin, closest unchanged terrain triangle. Lambert cos(incidence) only, source Sun table, terrain self-shadow ray check; neither albedo nor instrument PSF fitted.',
        'display': 'Native linear min/max per band; Lambert linear0..1; nearest-neighbor8x; predicted center-cell boundary overlay is a diagnostic, not detector coverage.'
    }, 'observations': []}
if candidate:
    result['candidateOffsetSourceSha256']=hashlib.sha256((OUT/'native-registration-fit.json').read_bytes()).hexdigest()
    result['candidateLookOffsetsRadians']=angular_offsets
for row, (ident, channel) in enumerate(cohort):
    c, n = NATIVE/f'C{ident}_{channel.lower()}.cub', NATIVE/f'N{ident}_{channel.lower()}.cub'
    camera = nav.Camera.from_pair(c, n, expected_target='PHOEBE', expected_radii_km=(115.,110.,105.), expected_frame_id=10047, expected_channel=channel, ray_only=True)
    raw = c.read_bytes()
    label = raw[:65536].decode('ascii').rstrip('\0')
    bb = re.search(r'Group = BandBin\n(.*?)End_Group', label, re.S).group(1)
    wavelengths = [float(v) for v in nav._array(bb, 'Center')]
    band = min(range(len(wavelengths)), key=lambda k: abs(wavelengths[k]-(.7 if channel == 'VIS' else 1.8)))
    height, width = camera.height, camera.width
    measured = np.frombuffer(raw, dtype='<f4', count=width*height, offset=65536+band*width*height*4).copy().reshape(height,width)
    solar_rows, sun_pin = sun_table(n.read_bytes())
    lit, hit = np.zeros((height,width)), np.zeros((height,width),dtype=bool)
    center_errors, rotation_errors = [], []
    for y in range(height):
        for x in range(width):
            et = camera.pixel_time(x, y)
            body, pointing, native_observer = camera.state(et)
            body = np.asarray(body)
            observer, ray = camera.ray(x, y, et, offset_radians=angular_offsets, state=(body, pointing, native_observer))
            target_rotation = pck(et, rotation['rightAscensionDegrees'], rotation['declinationDegrees'])
            transfer = target_rotation @ body.T
            observer, ray = transfer @ observer+translation, transfer @ ray
            rotation_errors.append(max(math.degrees(nav.angular_distance(p, q)) for p, q in zip(pck(et,355,68.7), body)))
            residual = camera.center_residual(x,y)
            if residual is not None:
                center_errors.append(residual['lookErrorPixels'])
            predicted = intersect(observer, ray)
            if predicted is None:
                continue
            face, point = predicted
            hit[y,x] = True
            solar = target_rotation @ linear_sun(solar_rows, et)+translation
            to_sun = solar-point
            to_sun /= np.linalg.norm(to_sun)
            cosine = float(normals[face] @ to_sun)
            if cosine > 0 and intersect(point+normals[face]*1e-6, to_sun) is None:
                lit[y,x] = cosine
    native_image = display(measured)
    proxy = np.repeat(np.round(255*lit).astype(np.uint8)[...,None],3,axis=2)
    overlay = native_image.copy()
    overlay[boundary(hit)] = [20,235,245]
    overlay[boundary(lit>0)] = [255,220,40]
    y0 = 108+row*285
    draw.text((20,y0), f'{ident} {channel}: band{band+1}, {wavelengths[band]:.5f}um, {width}x{height}', font=font, fill='white')
    for col, pixels in enumerate((native_image,proxy,overlay)):
        panel.paste(Image.fromarray(pixels).resize((width*8,height*8),Image.Resampling.NEAREST),(20+col*440,y0+31))
    entry = {'observationId':ident,'channel':channel,'width':width,'height':height,'bandOneBased':band+1,'wavelengthMicrometers':wavelengths[band],
             'cameraInputEvidence':camera.input_evidence,'sunTable':sun_pin,'nativeCenterLookErrorPixels':stats(center_errors),
             'nativePckFormulaVsCachedRotationMaxAxisErrorDegrees':stats(rotation_errors),
             'predictedHitCount':int(np.sum(hit)),'predictedLitCount':int(np.sum(lit>0)),
             'nativeIfInsidePredictedLit':stats(measured[lit>0]),'nativeIfOutsidePredictedBody':stats(measured[~hit]),
             'nativeIfAll':stats(measured.ravel()),'nativeIfMedianLitToOutsideDifference':float(np.median(measured[lit>0])-np.median(measured[~hit]))}
    # Native source arrays and prediction are retained for independent holdout review.
    prefix='candidate-prediction' if candidate else 'native-prediction'
    (OUT/f'{prefix}-{ident}-{channel.lower()}.json').write_text(json.dumps({'width':width,'height':height,'nativeBandIf':measured.ravel().tolist(),'predictedHit':hit.ravel().tolist(),'predictedLambert':lit.ravel().tolist()},separators=(',',':'))+'\n')
    result['observations'].append(entry)
    print(json.dumps({k:entry[k] for k in ('observationId','channel','nativeCenterLookErrorPixels','nativePckFormulaVsCachedRotationMaxAxisErrorDegrees','predictedHitCount','predictedLitCount')}), flush=True)
panel.save(OUT/f'{output_stem}.png')
result['wallSeconds'] = time.monotonic()-start
result['peakRssBytesMacOS'] = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
for path in PINNED:
    pinned_bytes(path)
result['allInputsUnchanged'] = True
(OUT/f'{output_stem}.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({'wallSeconds':result['wallSeconds'],'peakRssBytesMacOS':result['peakRssBytesMacOS'],'allInputsUnchanged':True}))
