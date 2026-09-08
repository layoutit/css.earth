#!/usr/bin/env python3
"""Replay measured-star alignment only; no cloud processing or image rewriting."""
import argparse
import ast
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
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


def require_hash(path, expected):
    if digest(path) != expected:
        raise ValueError('Pinned bytes differ: ' + str(path))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--verify-only', action='store_true')
    args = parser.parse_args()
    pin = procedure['packaging']
    for item in pin['dependencies']:
        require_hash(item['path'], item['sha256'])
    for item in pin['preservedFiles']:
        path = package / item['file']
        require_hash(path, item['sha256'])
        if path.suffix == '.py':
            ast.parse(path.read_text(), filename=str(path))
    with tempfile.TemporaryDirectory(prefix='naztronomy-registration-') as directory:
        helper = Path(directory) / 'validate-mosaic.py'
        subprocess.run(['patch', '-o', str(helper), pin['baseValidatorPath'], pin['patchPath']], check=True)
        require_hash(helper, pin['reconstructedHelperSha256'])
        ast.parse(helper.read_text(), filename=str(helper))
        if args.verify_only:
            print('RECONSTRUCTED_HELPER_HASH_AND_SYNTAX_VERIFIED')
            return
        target = Path(pin['reconstructedHelperPath'])
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(helper, target)
    for item in pin['preservedFiles']:
        shutil.copyfile(package / item['file'], target.parent / item['file'])
    for item in procedure['inputs']:
        path = Path(item['path'])
        if not path.exists():
            path.parent.mkdir(parents=True, exist_ok=True)
            partial = path.with_name(path.name + '.download')
            request = urllib.request.Request(item['url'], headers=item.get('headers', {}))
            with urllib.request.urlopen(request, timeout=180) as response, partial.open('wb') as output:
                shutil.copyfileobj(response, output)
            require_hash(partial, item['sha256'])
            partial.replace(path)
        require_hash(path, item['sha256'])
    for command in procedure['commands']:
        subprocess.run([sys.executable, *command[1:]], check=True)
    gate = json.loads((target.parent / 'direction-gate.json').read_text())
    if not gate['pass'] or gate['uniqueMatchedStars'] < 4000 or gate['heldOutCount'] < 1300:
        raise ValueError('Registration did not reproduce its positive evidence.')
    print('REGISTRATION_REPLAY_FINISHED; pass:', gate['pass'], '; stars:', gate['uniqueMatchedStars'])


if __name__ == '__main__':
    main()
