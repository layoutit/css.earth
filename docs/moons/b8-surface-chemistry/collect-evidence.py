"""Retain unmodified final browser artifacts, deduplicating identical screenshots."""
from pathlib import Path
import hashlib
import json
import shutil

root = Path.cwd()
destination = root / 'docs/moons/b8-surface-chemistry/evidence'
index = {'schema': 'cssearth-b8-browser-review-index@1',
         'qualification': 'Machine checks complete; visual review is recorded separately.',
         'reports': [], 'artifacts': []}
retained = {}


def digest(data):
    return hashlib.sha256(data).hexdigest()


def records(value):
    if isinstance(value, dict):
        if isinstance(value.get('path'), str) and 'bytes' in value and 'sha256' in value:
            yield value
        for nested in value.values():
            yield from records(nested)
    elif isinstance(value, list):
        for nested in value:
            yield from records(nested)


for body in ['io', 'ganymede', 'enceladus']:
    for dpr in [1, 2]:
        label = f'b8-{body}-qualified-dpr{dpr}'
        receipt = json.loads((root / f'output/b3-resume/{label}.json').read_text())
        assert receipt['status'] == 'PASS', label
        lines = (root / f'output/b3-resume/{label}.log').read_text().splitlines()
        report_path = Path(next(line for line in reversed(lines) if line.endswith('/report.json')))
        raw = report_path.read_bytes()
        report = json.loads(raw)
        assert report['status'] == 'CAPTURED_UNREVIEWED'
        assert report['shutdown']['browserClose'] == 'COMPLETE'
        assert len(report['cases']) == 1
        case = report['cases'][0]
        assert (case['id'], case['dpr']) == (body, dpr)
        assert case['errors'] == [] and case['contextClose'] == 'COMPLETE'
        target = destination / 'browser' / f'{body}-dpr{dpr}.json'
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(raw)
        index['reports'].append({'body': body, 'dpr': dpr, 'head': report['head'],
                                 'path': target.relative_to(destination).as_posix(),
                                 'sha256': digest(raw), 'viewLightingCases': len(case['views']),
                                 'browserClose': 'COMPLETE', 'runtimeErrors': 0})
        seen = set()
        for record in records(report):
            relative = Path(record['path'])
            if not relative.as_posix().startswith('output/playwright/b8-surfaces/'):
                continue
            if record['path'] in seen:
                continue
            seen.add(record['path'])
            data = (root / relative).read_bytes()
            assert len(data) == record['bytes'] and digest(data) == record['sha256']
            key = (record['sha256'], relative.suffix)
            if key not in retained:
                folder = 'screenshots' if relative.suffix == '.png' else 'styles'
                copy = destination / folder / f'{body}-dpr{dpr}-{relative.name}'
                copy.parent.mkdir(parents=True, exist_ok=True)
                copy.write_bytes(data)
                retained[key] = copy.relative_to(destination).as_posix()
            index['artifacts'].append({'originalPath': record['path'],
                                       'path': retained[key], 'bytes': len(data),
                                       'sha256': record['sha256']})

assert len({report['head'] for report in index['reports']}) == 1
assert sum(report['viewLightingCases'] for report in index['reports']) == 32
index['uniqueRetainedArtifacts'] = len(retained)
(destination / 'browser-index.json').write_text(json.dumps(index, indent=2) + '\n')

for source, name in [
    ('output/b8-qualification/packages.json', 'packages.json'),
    ('output/b8-source-reproduction/run-4rv1kB/receipt.json', 'source-reproduction.json'),
    ('output/b8-source-reproduction/run-4rv1kB/enceladus/vims-chemistry/qualification-receipt.json',
     'sources/enceladus-independent-fresh.json'),
]:
    target = destination / name
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(root / source, target)
print(json.dumps({'reports': len(index['reports']), 'viewLightingCases': 32,
                  'uniqueRetainedArtifacts': len(retained)}))
