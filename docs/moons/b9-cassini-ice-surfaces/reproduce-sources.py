#!/usr/bin/env python3
"""Rebuild all three final B9 source-map packages, serially, in a fresh directory.

Example (from repository root):
  output/b9-python/bin/python docs/moons/b9-cassini-ice-surfaces/reproduce-sources.py

Use --python to choose another existing interpreter with NumPy and Rasterio.
The default interpreter is sys.executable. No installs/downloads are performed.
Only pinned original inputs, recipe evidence, the original recipes, and Phoebe's
fixed terrain/rotation dependencies are copied. Generated TIFFs and preparation
receipts are never seeded into the temporary workspace. Every regenerated TIFF
must match both the package manifest and the original package bytes exactly.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import time

ROOT = Path(__file__).resolve().parents[3]
BODIES = ('tethys', 'iapetus', 'phoebe')
CODE_FILES = ('cassini-ice-surfaces.py', 'cassini-phoebe-surfaces.py',
              'cassini-fixed-mesh.py', 'cassini-vims-navigation.py',
              'cassini-vims-detector-quality.py', 'enceladus-vims-spectral.py')


def digest(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for data in iter(lambda: stream.read(65536), b''):
            h.update(data)
    return h.hexdigest()


def require(condition, message):
    if not condition:
        raise ValueError(message)


def checked_path(base, relative, boundary):
    path = (base / relative).resolve()
    require(path.is_relative_to(boundary.resolve()), 'Dependency escaped package: ' + relative)
    require(path.is_file(), 'Missing package dependency: ' + str(path))
    return path


def manifest_index(manifest):
    result = {}
    for group in ('inputs', 'generatedIntermediates', 'documents'):
        for entry in manifest.get(group, []):
            name = entry['path']
            if name in result:
                require(result[name].get('expectedSha256') == entry.get('expectedSha256')
                        and result[name].get('expectedBytes') == entry.get('expectedBytes'),
                        'Conflicting manifest pins: ' + name)
            result[name] = entry
    return result


def verify_manifest_file(source, path, index):
    name = path.relative_to(source).as_posix()
    require(name in index, 'File absent from source manifest: ' + name)
    pin = index[name]
    require(type(pin.get('expectedBytes')) is int and isinstance(pin.get('expectedSha256'), str),
            'File lacks manifest byte/hash pins: ' + name)
    require(path.stat().st_size == pin['expectedBytes'] and digest(path) == pin['expectedSha256'],
            'Package manifest pin differs: ' + name)
    return {'path': path.relative_to(ROOT).as_posix(), 'bytes': pin['expectedBytes'],
            'sha256': pin['expectedSha256']}


def expected_products(plan):
    require(set(plan['outputs']) == {'depth', 'rgb', 'rgbDisplay'}, 'Unexpected product set')
    result = set(plan['outputs'].values())
    for key in ('depth', 'rgb'):
        path = Path(plan['outputs'][key])
        result.update(str(path.with_name(path.stem + suffix + '.tif'))
                      for suffix in ('-observation', '-source-pixel'))
    require(len(result) == 7 and all(Path(x).name == x and x.endswith('.tif') for x in result),
            'Unqualified generated product paths')
    return sorted(result)


def byte_equal(first, second):
    if first.stat().st_size != second.stat().st_size:
        return False
    with first.open('rb') as a, second.open('rb') as b:
        while True:
            left, right = a.read(65536), b.read(65536)
            if left != right:
                return False
            if not left:
                return True


def stage_body(body, workspace):
    source = ROOT / 'src/planets' / body / 'source'
    package = source / 'cassini-ice'
    recipe_path = package / 'prepare.json'
    plan = json.loads(recipe_path.read_text())
    require(plan['target'] == body.upper(), 'Recipe target mismatch')
    index = manifest_index(json.loads((source / 'manifest.json').read_text()))
    copied = [verify_manifest_file(source, recipe_path, index)]
    dependencies = dict(plan['pins'])
    if 'registrationEvidence' in plan:
        evidence = plan['registrationEvidence']
        existing = dependencies.setdefault(evidence['file'], evidence['sha256'])
        require(existing == evidence['sha256'], 'Conflicting registration evidence pins')
    allowed_outside = ({(package / plan[key]).resolve() for key in ('terrain', 'rotationPath')}
                       if body == 'phoebe' else set())
    require(not (set(dependencies) & set(expected_products(plan))), 'Generated product used as input')
    for name, expected_hash in dependencies.items():
        path = checked_path(package, name, source.parent)
        require(path.is_relative_to(package) or path in allowed_outside,
                'Unqualified non-source dependency: ' + name)
        require(path.suffix.lower() not in ('.tif', '.tiff') and path.name != plan['receipt'],
                'Generated TIFF/receipt cannot seed reproduction')
        require(digest(path) == expected_hash, 'Recipe dependency pin differs: ' + name)
        if path.is_relative_to(source):
            copied.append(verify_manifest_file(source, path, index))
        else:
            # The fixed prepared Phoebe mesh is pinned by the recipe and mapper.
            require(body == 'phoebe' and path == (package / plan['terrain']).resolve(),
                    'Unexpected prepared dependency')
            copied.append({'path': path.relative_to(ROOT).as_posix(),
                           'bytes': path.stat().st_size, 'sha256': expected_hash})
    products = []
    names = expected_products(plan)
    actual = sorted(p.name for p in package.glob('*.tif'))
    declared = sorted(Path(name).name for name in index
                      if name.startswith('cassini-ice/') and name.lower().endswith(('.tif', '.tiff')))
    require(actual == names and declared == names, 'Unaccounted/missing package TIFF for ' + body)
    for name in names:
        products.append(verify_manifest_file(source, package / name, index))
    copied_by_path = {entry['path']: entry for entry in copied}
    for entry in copied_by_path.values():
        destination = workspace / entry['path']
        require(not destination.exists(), 'Temporary dependency destination already exists')
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ROOT / entry['path'], destination)
        require(digest(destination) == entry['sha256'], 'Staged dependency pin differs')
    temp_recipe = workspace / recipe_path.relative_to(ROOT)
    require(not list(temp_recipe.parent.glob('*.tif')) and not (temp_recipe.parent / plan['receipt']).exists(),
            'Generated output was copied into temporary workspace')
    return {'body': body, 'recipe': recipe_path.relative_to(ROOT).as_posix(),
            'recipeSha256': digest(recipe_path), 'dependencies': list(copied_by_path.values()),
            'sourceManifest': (source / 'manifest.json').relative_to(ROOT).as_posix(),
            'sourceManifestSha256': digest(source / 'manifest.json'),
            'products': products, 'generatedReceipt': plan['receipt']}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--python', default=sys.executable, help='Existing scientific Python interpreter')
    parser.add_argument('--output', type=Path, default=ROOT / 'output/b9-source-reproduction',
                        help='Parent directory for a new isolated run and its receipt')
    args = parser.parse_args()
    # Preserve virtualenv entrypoints: resolving their symlink bypasses pyvenv.cfg.
    interpreter = os.path.abspath(shutil.which(args.python) or args.python)
    require(Path(interpreter).is_file(), 'Python interpreter does not exist')
    args.output.mkdir(parents=True, exist_ok=True)
    run = Path(tempfile.mkdtemp(prefix='run-', dir=args.output.resolve()))
    workspace = run / 'workspace'
    workspace.mkdir()
    env = dict(os.environ, OPENBLAS_NUM_THREADS='1', OMP_NUM_THREADS='1', MKL_NUM_THREADS='1',
               NUMEXPR_NUM_THREADS='1', GDAL_NUM_THREADS='1', PYTHONDONTWRITEBYTECODE='1')
    report = {'schema': 'b9-packaged-source-reproduction@1', 'status': 'RUNNING',
              'startedUtc': datetime.now(timezone.utc).isoformat(), 'python': interpreter,
              'scriptSha256': digest(__file__), 'serialBodyOrder': list(BODIES),
              'seededGeneratedFiles': [], 'bodies': [], 'toolPins': {},
              'scope': 'Exact reproduction of the seven source-map TIFFs per body; no atlas, runtime, or browser qualification.'}
    receipt_path = run / 'receipt.json'
    def save():
        receipt_path.write_text(json.dumps(report, indent=2) + '\n')
    started = time.monotonic()
    try:
        for name in CODE_FILES:
            path = ROOT / 'tools/objects/acquisition' / name
            report['toolPins'][path.relative_to(ROOT).as_posix()] = digest(path)
        # Stage all bodies before computing, so missing inputs fail before jobs.
        stages = [stage_body(body, workspace) for body in BODIES]
        save()
        for stage in stages:
            body = stage['body']
            tool = ROOT / 'tools/objects/acquisition' / ('cassini-phoebe-surfaces.py' if body == 'phoebe'
                                                         else 'cassini-ice-surfaces.py')
            recipe = workspace / stage['recipe']
            start = time.monotonic()
            log = run / (body + '.log')
            with log.open('wb') as stream:
                process = subprocess.run([interpreter, str(tool), str(recipe)], cwd=workspace, env=env,
                                         stdout=stream, stderr=subprocess.STDOUT, check=False)
            result = {'body': body, 'recipeSha256': stage['recipeSha256'],
                      'sourceManifestSha256': stage['sourceManifestSha256'],
                      'dependencyCount': len(stage['dependencies']),
                      'dependencyBytes': sum(x['bytes'] for x in stage['dependencies']),
                      'returnCode': process.returncode, 'wallSeconds': time.monotonic()-start,
                      'log': log.name, 'products': []}
            report['bodies'].append(result)
            save()
            require(process.returncode == 0, body + ' preparer failed; inspect ' + str(log))
            expected_names = sorted(Path(x['path']).name for x in stage['products'])
            require(sorted(p.name for p in recipe.parent.glob('*.tif')) == expected_names,
                    'Generated TIFF set differs for ' + body)
            for expected in stage['products']:
                original, generated = ROOT / expected['path'], workspace / expected['path']
                size, actual_hash = generated.stat().st_size, digest(generated)
                exact = byte_equal(original, generated)
                result['products'].append({'file': generated.name, 'bytes': size, 'sha256': actual_hash,
                                            'manifestSha256': expected['sha256'], 'exactBytes': exact})
                require(size == expected['bytes'] and actual_hash == expected['sha256'] and exact,
                        'Regenerated TIFF differs: ' + expected['path'])
            generated_receipt = recipe.parent / stage['generatedReceipt']
            require(generated_receipt.is_file(), 'Preparer did not write a new receipt')
            result['generatedReceiptSha256'] = digest(generated_receipt)
            result['status'] = 'PASS'
            save()
            print(body + ': PASS; all 7 TIFFs match exact bytes and manifest hashes', flush=True)
        for stage in stages:
            require(digest(ROOT / stage['sourceManifest']) == stage['sourceManifestSha256'],
                    'Source manifest changed during reproduction: ' + stage['body'])
            for entry in stage['dependencies'] + stage['products']:
                path = ROOT / entry['path']
                require(path.stat().st_size == entry['bytes'] and digest(path) == entry['sha256'],
                        'Original package changed during reproduction: ' + entry['path'])
        for relative, expected_hash in report['toolPins'].items():
            require(digest(ROOT / relative) == expected_hash, 'Preparer code changed during reproduction')
        report['status'] = 'PASS'
        report['matchedTiffs'] = sum(len(x['products']) for x in report['bodies'])
        report['originalPackagesUnchanged'] = True
    except Exception as error:
        report['status'] = 'FAIL'
        report['error'] = str(error)
        raise
    finally:
        report['wallSeconds'] = time.monotonic()-started
        report['finishedUtc'] = datetime.now(timezone.utc).isoformat()
        save()
        print('Reproduction receipt: ' + str(receipt_path), flush=True)


if __name__ == '__main__':
    main()
