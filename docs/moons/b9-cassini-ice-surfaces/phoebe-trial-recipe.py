"""Bind the independently reviewed Phoebe source registration for a small trial."""
from pathlib import Path
import hashlib
import json
import re

ROOT = Path(__file__).resolve().parents[3]
root = ROOT / 'output/b9-source-intake/phoebe'
review = '../../../docs/moons/b9-cassini-ice-surfaces/source-review/phoebe/'
def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()
def bound(path):
    return path, digest(root / path)

ident = '1465671822_1'
cal = f'native/C{ident}_ir.cub'
label = (root / cal).read_bytes()[:65536].decode('ascii').rstrip('\0')
centers = re.search(r'\bCenter\s*=\s*\(([^)]*)\)', label, re.S)[1]
waves = [float(v) for v in re.sub(r'-[ \t]*\r?\n[ \t]*', '', centers).split(',')]
entry = {'id': ident, 'calibrated': cal, 'navigation': f'native/N{ident}_ir.cub',
         'rawOriginal': f'../../../docs/moons/b9-cassini-ice-surfaces/source-review/tethys/v{ident}.qub',
         'region': review+'regional-mask.json', 'fitReceipt': review+'native-registration-fit.json',
         'wavelengthsMicrometers': {str(b): waves[b-1] for b in (25, 44, 58, 70, 81)}}
terrain = '../../../src/planets/phoebe/prepared/terrain.json'
rotation = '../../../src/planets/phoebe/source/preparation/rotation.json'
comparison = review+'source-model-comparison.json'
plan = {'schema': 'cssearth-phoebe-registered-vims-surfaces@1', 'target': 'PHOEBE',
        'status': 'SOURCE TRIAL ONLY; fixed-mesh mapping awaiting independent review',
        'observations': [entry], 'channels': {'rgb': [70, 44, 25], 'depth': [58, 70, 81]},
        'width': 720, 'height': 360, 'radiusMeters': 106500, 'terrain': terrain,
        'rotationPath': rotation, 'rotation': json.loads((root / rotation).read_text()),
        'originComparison': comparison,
        'originTranslationKilometers': json.loads((root / comparison).read_text())['surfaceRefinement']['translationKm'],
        'photometricCorrection': 'none', 'apertureInsetRadians': [1e-6, 1e-6],
        'exposureFractions': [n/8 for n in range(9)], 'maximumIncidenceEmissionDegrees': 60,
        'detectorQualityPreparerSha256': digest(ROOT / 'tools/objects/acquisition/cassini-vims-detector-quality.py'),
        'outputs': {'depth': 'phoebe-depth-trial.tif', 'rgb': 'phoebe-rgb-trial.tif',
                    'rgbDisplay': 'phoebe-rgb-display-trial.tif'},
        'rgbDisplay': {'ranges': [[0, .03]]*3, 'gamma': 2.2}, 'receipt': 'trial-receipt.json'}
plan['pins'] = dict(bound(p) for p in [*(entry[k] for k in ('calibrated', 'navigation', 'rawOriginal', 'region', 'fitReceipt')),
                                     terrain, rotation, comparison])
(root / 'prepare-trial.json').write_text(json.dumps(plan, indent=2)+'\n')
print(root / 'prepare-trial.json')
