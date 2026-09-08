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
root = next(p for p in package.parents if (p / 'labs/nebula/src/validate-image-registration.py').is_file())
os.chdir(root)
procedure = json.loads((package / 'procedure.json').read_text())


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
    subprocess.run([sys.executable, *procedure['command'][1:]], check=True)
    result = json.loads((output / 'wise-direction-gate.json').read_text())
    if not result['pass']:
        raise ValueError('WISE fixed-WCS gate did not pass')
    print('WISE_FIXED_WCS_REPLAY_PASSED', result['uniqueMatchedStars'])


if __name__ == '__main__':
    main()
