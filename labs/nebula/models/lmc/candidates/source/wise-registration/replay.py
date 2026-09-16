#!/usr/bin/env python3
"""Verify or replay the fixed WISE WCS catalogue check; no cloud processing."""
import argparse
import ast
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import urllib.request

package = Path(__file__).resolve().parent
root = next(p for p in package.parents if (p / 'labs/nebula/models/lmc/candidates/source/wise-registration/validate-image-registration.pinned.py').is_file())
os.chdir(root)
# Translate file locations after source organization, never scientific parameters or pinned bytes.
def relocated(value):
    if isinstance(value, str):
        return value.replace('labs/nebula/src/validate-image-registration.py',
                             'labs/nebula/models/lmc/candidates/source/wise-registration/validate-image-registration.pinned.py').replace(
                             'labs/nebula/models/lmc-candidates/', 'labs/nebula/models/lmc/candidates/')
    if isinstance(value, list):
        return [relocated(item) for item in value]
    if isinstance(value, dict):
        return {key: relocated(item) for key, item in value.items()}
    return value

procedure = relocated(json.loads((package / 'procedure.json').read_text()))


def digest(path):
    h = hashlib.sha256()
    with open(path, 'rb') as stream:
        for block in iter(lambda: stream.read(1048576), b''):
            h.update(block)
    return h.hexdigest()


def verify(path, expected):
    if digest(path) != expected:
        raise ValueError('Pinned input changed: ' + str(path))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--verify-only', action='store_true')
    args = parser.parse_args()
    for item in procedure['pinnedFiles']:
        verify(item['path'], item['sha256'])
        if item['path'].endswith('.py'):
            ast.parse(Path(item['path']).read_text(), filename=item['path'])
    if args.verify_only:
        print('WISE_REPLAY_HASHES_AND_SYNTAX_VERIFIED')
        return
    for item in procedure['inputs']:
        path = Path(item['path'])
        if not path.exists():
            path.parent.mkdir(parents=True, exist_ok=True)
            partial = path.with_name(path.name + '.download')
            urllib.request.urlretrieve(item['url'], partial)
            verify(partial, item['sha256'])
            partial.replace(path)
        verify(path, item['sha256'])
    output = Path('.local/nebula-lab/image-candidates/wise-registration/catalogue-check')
    output.mkdir(parents=True, exist_ok=True)
    (output / 'query.json').write_bytes((package / 'query.json').read_bytes())
    source = Path(procedure['command'][1])
    helper = output / 'relocated-check-wise-catalogue.py'
    helper.write_text(relocated(source.read_text()))
    subprocess.run([sys.executable, str(helper), *procedure['command'][2:]], check=True)
    result = json.loads((output / 'wise-direction-gate.json').read_text())
    if not result['pass']:
        raise ValueError('WISE fixed-WCS gate did not pass')
    print('WISE_FIXED_WCS_REPLAY_PASSED', result['uniqueMatchedStars'])


if __name__ == '__main__':
    main()
