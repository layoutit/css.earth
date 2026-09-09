"""Freeze the reviewed B6 captures and receipts without changing their bytes."""
import hashlib
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
DEST = ROOT / 'docs/moons/b6-mapped-science/evidence'
RUNS = [
    ('moon', '17-36-54.955Z', 'b6-browser-moon'),
    ('europa', '18-04-14.642Z', 'b6-browser-europa-complete'),
    ('callisto', '17-59-54.918Z', 'b6-browser-callisto-final'),
    ('charon-dpr1', '18-00-58.965Z', 'b6-browser-charon-final-dpr1'),
    ('charon-dpr2', '18-02-17.176Z', 'b6-browser-charon-final-dpr2'),
]
LENSES = {'moon': ['geology', 'silicate-signature'], 'europa': ['geology', 'infrared'],
          'callisto': ['infrared'], 'charon': ['albedo']}


def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def read(path):
    return json.loads(path.read_text())


index = {'status': 'PASS', 'scope': 'Six mapped views; selected-body qualification only',
         'files': [], 'cases': []}
copied = set()


def copy(source, destination):
    if destination in copied:
        return
    source = ROOT / source
    target = DEST / destination
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, target)
    assert digest(source) == digest(target)
    index['files'].append({'source': str(source.relative_to(ROOT)), 'path': destination,
                           'bytes': target.stat().st_size, 'sha256': digest(target)})
    copied.add(destination)


for name, suffix, label in RUNS:
    path = Path('output/playwright/b6-surfaces') / ('integrated-2026-09-09T' + suffix) / 'report.json'
    report = read(ROOT / path)
    assert report['status'] == 'CAPTURED_UNREVIEWED'
    assert report['shutdown']['browserClose'] == 'COMPLETE'
    for entry in report['frozenFiles']:
        assert digest(ROOT / entry['path']) == entry['sha256'], entry['path']
    copy(path, f'browser/{name}.json')
    for case in report['cases']:
        assert not case['errors']
        row = {'id': case['id'], 'dpr': case['dpr'], 'browser': report['browserVersion'],
               'viewport': report['viewport'], 'sourceReport': f'browser/{name}.json', 'views': []}
        for view in case['views']:
            before = view['beforeDrag']
            assert before['ownerSame'] and before['retainedStable'] and before['ready']
            assert before['surfacePaint']['leaves'] == 452
            if 'drag' in view:
                assert view['drag']['allNodesRetained'] and view['drag']['ownerSame']
            row['views'].append({'lens': view['lensId'], 'shadows': view['shadows'],
                                 'surfaceLeaves': before['surfacePaint']['leaves'],
                                 'dragChecked': 'drag' in view})
            if view['lensId'] not in LENSES[case['id']]:
                continue
            # Both DPRs, plus supported shadows. Keep original scene PNG bytes.
            shot = next(s for s in view['screenshots'] if s['path'].endswith('-scene.png'))
            assert digest(ROOT / shot['path']) == shot['sha256']
            filename = f"{case['id']}-dpr{case['dpr']}-{Path(shot['path']).name}"
            copy(shot['path'], 'screenshots/' + filename)
        index['cases'].append(row)
    copy(f'output/b3-resume/{label}.json', f'checks/{label}.json')
    for style in report['styleArtifacts']:
        target = 'styles/' + Path(style['path']).name
        copy(style['path'], target)

for body, lenses in LENSES.items():
    proof = read(ROOT / f'output/b6-source-proof/{body}.json')
    assert proof['status'] == 'PASS'
    assert proof['sourceManifestSha256'] == digest(ROOT / f'src/planets/{body}/source/manifest.json')
    copy(f'output/b6-source-proof/{body}.json', f'sources/{body}.json')
    for lens in lenses:
        copy(f'output/b6-previews/{body}-{lens}.png', f'sources/{body}-{lens}.png')

copy('output/b6-qualification/packages.json', 'checks/packages.json')
for label in ['b6-build-packages', 'b6-build-renderer-complete', 'b6-build-preparation',
              'b6-typecheck-preparation', 'b6-intake-tests', 'b6-focused-tests',
              'b6-json-restore', 'b6-runtime-delivery']:
    assert read(ROOT / f'output/b3-resume/{label}.json')['status'] == 'PASS'
    for extension in ['json', 'log']:
        copy(f'output/b3-resume/{label}.{extension}', f'checks/{label}.{extension}')
# Keep the earlier stopped declaration build visible beside the completed run.
for extension in ['json', 'log']:
    copy(f'output/b3-resume/b6-build-renderer.{extension}', f'checks/b6-build-renderer-stopped.{extension}')
copy('output/b6-delivery/run-Zorh3s/receipt.json', 'delivery.json')
copy('output/b6-delivery/run-Zorh3s/publication.json', 'publication.json')
index['totalBytes'] = sum(entry['bytes'] for entry in index['files'])
(DEST / 'index.json').write_text(json.dumps(index, indent=2) + '\n')
print(json.dumps({'files': len(index['files']), 'bytes': index['totalBytes'], 'cases': len(index['cases'])}))
