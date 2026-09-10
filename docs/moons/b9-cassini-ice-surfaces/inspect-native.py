"""Inspect downloaded native bands without projecting a surface or claiming coverage."""
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SPEC = importlib.util.spec_from_file_location('ice', ROOT / 'tools/objects/acquisition/cassini-ice-surfaces.py')
ice = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(ice)

for body, target, radius, maximum in [('iapetus', 'IAPETUS', 736000, 40000),
                                       ('tethys', 'TETHYS', 531000, 40000)]:
    root = ROOT / 'output/b9-source-intake' / body
    receipts = json.loads((root / 'native/download-receipts.json').read_text())
    entries = []
    for item in receipts:
        if not item['file'].startswith('C'):
            continue
        key = item['file'][1:-7]
        label, planes = ice.read_cube(root / 'native' / item['file'], [25, 44, 58, 70, 81], 256, target)
        wavelengths = [float(x) for x in ice.sequence(label, 'Center')]
        entries.append({'id': key, 'calibrated': 'native/' + item['file'],
                        'navigation': f'native/N{key}_ir.cub',
                        'rawOriginal': f'../../../docs/moons/b9-cassini-ice-surfaces/source-review/tethys/v{key}.qub',
                        'wavelengthsMicrometers': {str(b): wavelengths[b - 1] for b in planes}})
    plan = {'schema': ice.SCHEMA, 'target': target,
            'status': 'SOURCE TRIAL ONLY; detector support and registration not qualified',
            'observations': entries, 'channels': {'rgb': [70, 44, 25], 'depth': [58, 70, 81]},
            'pins': {'native/' + r['file']: r['sha256'] for r in receipts},
            'photometricCorrection': 'none', 'absolutePointingAccuracy': 'unresolved',
            'aperturePolicy': ice.navigation.APERTURE_POLICY,
            'apertureInsetRadians': [1e-7 if body == 'iapetus' else 1e-6] * 2,
            'detectorQualityPolicy': ice.detector_quality.POLICY,
            'detectorQualityPreparerSha256': ice.transfer.digest(ice._QUALITY_SPEC.origin),
            'registrationEvidence': {
                'file': '../../../docs/moons/b9-cassini-ice-surfaces/source-review/' + body + '.md',
                'sha256': ice.transfer.digest(ROOT / 'docs/moons/b9-cassini-ice-surfaces/source-review' / (body + '.md')),
                'qualification': 'SOURCE TRIAL ONLY: absolute registration unqualified'},
            'width': 1024, 'height': 512, 'radiusMeters': radius,
            'outputs': {'depth': body + '-depth-trial.tif', 'rgb': body + '-rgb-trial.tif',
                        'rgbDisplay': body + '-rgb-display-trial.tif'},
            'rgbDisplay': {'ranges': [[0, .45 if body == 'iapetus' else .65]] * 3, 'gamma': 2.2},
            'receipt': 'trial-receipt.json',
            'policy': {'minimumPhaseDegrees': 10, 'maximumPhaseDegrees': 120,
                       'maximumIncidenceEmissionDegrees': 70, 'maximumResolutionMeters': maximum,
                       'maximumCenterErrorPixels': .01}}
    for entry in entries:
        name = entry['rawOriginal']
        plan['pins'][name] = ice.transfer.digest(root / name)
    for name, pin in plan['pins'].items():
        if ice.transfer.digest(root / name) != pin:
            raise ValueError('Downloaded pin mismatch: ' + name)
    reports = [ice.read_observation(root, entry, plan)['report'] for entry in entries]
    (root / 'prepare-trial.json').write_text(json.dumps(plan, indent=2) + '\n')
    (root / 'numeric-trial.json').write_text(json.dumps(reports, indent=2) + '\n')
    print(body, [(r['id'], r['dimensions'], r['geometryAcceptedNativeCenters']) for r in reports], flush=True)
