#!/usr/bin/env python3
"""Preflight every selected aligned source, then run native star separation sequentially."""
import argparse
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import subprocess
import sys
import tempfile
import urllib.request

PIPELINE = Path(__file__).with_name('star-separation.py')
spec = importlib.util.spec_from_file_location('candidate_star_separation', PIPELINE)
separation = importlib.util.module_from_spec(spec)
spec.loader.exec_module(separation)
OUTPUTS = ('star-detections.json', 'star-detection-map.png', 'diffuse.png', 'stars.png',
           'star-mask.png', 'accepted-stars.json', 'comparison.png')


def digest(path):
    return separation.sha256(path)


def document(path, expected=None):
    data = Path(path).read_bytes()
    if expected is not None and hashlib.sha256(data).hexdigest() != expected:
        raise ValueError('Pinned JSON hash differs: ' + str(path))
    return json.loads(data)


def indexed(records):
    result = {}
    for record in records:
        key = record.get('id')
        if not isinstance(key, str) or not key or key in result:
            raise ValueError('Missing or duplicate candidate id.')
        result[key] = record
    return result


def acquire(source, catalogue):
    path = Path(source['path'])
    if not path.exists():
        url = catalogue.get('url')
        if not isinstance(url, str) or not url.startswith(('https://', 'http://')):
            raise ValueError('Missing source has no catalogue download URL.')
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = None
        try:
            with tempfile.NamedTemporaryFile(dir=path.parent, prefix=path.name + '.', delete=False) as output:
                temporary = Path(output.name)
                with urllib.request.urlopen(url, timeout=60) as response:
                    while block := response.read(1024 * 1024):
                        output.write(block)
            if digest(temporary) != source['sha256']:
                raise ValueError('Downloaded source SHA256 differs.')
            if path.exists():
                raise ValueError('Source appeared during download; refusing to replace it.')
            temporary.replace(path)
        finally:
            if temporary is not None and temporary.exists():
                temporary.unlink()
    if digest(path) != source['sha256']:
        raise ValueError('Existing source SHA256 differs: ' + str(path))


def preflight(plan_path):
    plan = document(plan_path)
    if plan.get('schema') != 'cssearth-image-processing-plan@1' or not plan.get('selections'):
        raise ValueError('Invalid image-processing plan.')
    report = document(plan['alignmentReport']['path'], plan['alignmentReport']['sha256'])
    if report.get('status') != 'passed' or report.get('pass') is not True:
        raise ValueError('Alignment report has not passed.')
    approved = indexed(report['sources'])
    active = indexed(image for target in document(plan['catalogue'])['targets'] for image in target['images'])
    selections = indexed(plan['selections'])
    if set(report['selectedIds']) != set(approved):
        raise ValueError('Alignment report source ids are inconsistent.')
    jobs, destinations = [], set()
    # Close every recipe, alignment and catalogue binding before downloads or execution.
    for candidate_id, selection in selections.items():
        proof, catalogue = approved.get(candidate_id), active.get(candidate_id)
        if not proof or not catalogue or proof.get('pass') is not True or proof.get('status') != 'passed':
            raise ValueError('Candidate lacks a passing alignment gate: ' + candidate_id)
        gate = document(proof['gate']['path'], proof['gate']['sha256'])
        if gate.get('pass') is False:
            raise ValueError('Underlying direction gate failed.')
        recipe = document(selection['recipe'], selection['recipeSha256'])
        if recipe.get('schema') != 'cssearth-star-separation@1' or set(recipe) - {'schema', 'source', 'outputDirectory', 'detections', 'parameters', 'preview'}:
            raise ValueError('Invalid separation recipe.')
        source = recipe['source']
        if (source['sha256'] != proof['sourceSha256'] or source['sha256'] != catalogue['sha256'] or
                source['nativeDimensions'] != proof['sourceDimensions'] or
                Path(source['path']).resolve() != Path(proof['sourcePath']).resolve() or
                Path(source['path']).resolve() != Path(catalogue['path']).resolve()):
            raise ValueError('Recipe source differs from aligned catalogue source.')
        geometry = proof['geometry']
        expected = ({'kind': 'matched-star-homography', 'registration': catalogue['registration']}
                    if catalogue.get('registration') else {'kind': 'fixed-publisher-wcs', 'wcs': catalogue.get('wcs')})
        if geometry != expected:
            raise ValueError('Active catalogue geometry differs from alignment report.')
        params = separation.parameters(recipe.get('parameters'))
        preview = {**separation.PREVIEW, **recipe.get('preview', {})}
        if (set(preview) != set(separation.PREVIEW) or any(isinstance(v, bool) or not isinstance(v, (int, float)) or
                not math.isfinite(v) or v <= 0 for v in preview.values()) or preview['maxDimension'] > 2000):
            raise ValueError('Invalid separation preview parameters.')
        destination = Path(recipe['outputDirectory']).resolve()
        if '.local' not in destination.parts or destination in destinations:
            raise ValueError('Outputs must have distinct ignored .local directories.')
        destinations.add(destination)
        if recipe.get('detections'):
            item = recipe['detections']
            separation.validate_centroids(document(item['path'], item['sha256']), source['path'], source['sha256'],
                                          source['nativeDimensions'], params['maximumDetections'])
        jobs.append((selection, recipe, catalogue))
    for selection, recipe, catalogue in jobs:
        acquire(recipe['source'], catalogue)
        image = separation.read_image(recipe['source']['path'])
        if [image.shape[1], image.shape[0]] != recipe['source']['nativeDimensions']:
            raise ValueError('Decoded native source dimensions differ.')
        del image
    return jobs


def process_recipe(selection, recipe):
    receipt_path = Path(recipe['outputDirectory']) / 'receipt.json'
    before = receipt_path.stat().st_mtime_ns if receipt_path.exists() else None
    script_hash = digest(PIPELINE)
    complete = False
    with subprocess.Popen([sys.executable, str(PIPELINE), selection['recipe']], stdout=subprocess.PIPE, text=True) as process:
        for line in process.stdout:
            print(line, end='', flush=True)
            try:
                complete |= json.loads(line).get('stage') == 'complete'
            except (ValueError, AttributeError):
                pass
        if process.wait() != 0:
            raise RuntimeError('Star-separation process failed.')
    if not complete or not receipt_path.exists() or receipt_path.stat().st_mtime_ns == before:
        raise ValueError('No fresh positive separation completion evidence.')
    receipt = document(receipt_path)
    source, checks = recipe['source'], receipt.get('verification', {})
    if (receipt.get('schema') != 'cssearth-star-separation-receipt@1' or receipt.get('status') != 'inspectable-trial' or
            receipt.get('sourceSha256') != source['sha256'] or receipt.get('recipeSha256') != selection['recipeSha256'] or
            receipt.get('scriptSha256') != script_hash or receipt.get('source', {}).get('sha256') != source['sha256'] or
            receipt.get('source', {}).get('nativeDimensions') != source['nativeDimensions'] or
            Path(receipt.get('source', {}).get('path', '')).resolve() != Path(source['path']).resolve() or
            receipt.get('detectionsWrittenBeforeSeparation') is not True or checks.get('nativeDimensions') != source['nativeDimensions'] or
            checks.get('encodedRoundTripExact') is not True or checks.get('maximumReconstructionErrorCodeValues') != 0 or
            checks.get('changedPixelsOutsideMask') != 0):
        raise ValueError('Separation receipt does not prove this pinned native-grid trial.')
    for name in OUTPUTS:
        path, evidence = receipt_path.parent / name, receipt.get('outputs', {}).get(name, {})
        if not path.is_file() or path.stat().st_size <= 0 or path.stat().st_size != evidence.get('bytes') or digest(path) != evidence.get('sha256'):
            raise ValueError('Missing or altered separation output: ' + name)
    detected, accepted = receipt.get('detectedCount'), receipt.get('acceptedCount')
    if type(detected) is not int or type(accepted) is not int or not 0 <= accepted <= detected:
        raise ValueError('Invalid separation counts.')
    detections = document(receipt_path.parent / 'star-detections.json')
    accepted_stars = document(receipt_path.parent / 'accepted-stars.json')
    separation.validate_centroids(detections, source['path'], source['sha256'], source['nativeDimensions'], detected)
    if (detections.get('count') != detected or accepted_stars.get('count') != accepted or
            not isinstance(accepted_stars.get('candidates'), list) or len(accepted_stars['candidates']) != accepted):
        raise ValueError('Separation counts disagree with written artifacts.')


def run(plan_path, check_only=False):
    jobs = preflight(plan_path)
    print(json.dumps({'stage': 'all-sources-preflight-passed', 'ids': [s['id'] for s, _, _ in jobs]}), flush=True)
    if not check_only:
        for selection, recipe, _ in jobs:
            process_recipe(selection, recipe)
        print(json.dumps({'stage': 'batch-complete', 'count': len(jobs)}), flush=True)
    return jobs


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('plan')
    parser.add_argument('--check-only', action='store_true')
    args = parser.parse_args()
    run(args.plan, args.check_only)
