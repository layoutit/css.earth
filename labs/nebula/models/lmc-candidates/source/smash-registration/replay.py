#!/usr/bin/env python3
"""Reconstruct the pinned research helper and replay image registration only."""
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
pin = procedure['packaging']


def digest(path):
    h = hashlib.sha256()
    with open(path, 'rb') as stream:
        for block in iter(lambda: stream.read(1048576), b''):
            h.update(block)
    return h.hexdigest()


def require_hash(path, expected):
    if digest(path) != expected:
        raise ValueError('Pinned bytes differ: ' + str(path))


def reconstruct(destination):
    require_hash(pin['baseValidatorPath'], pin['baseValidatorSha256'])
    require_hash(package / pin['patchFile'], pin['patchSha256'])
    # Patch into a fresh temporary file; never modify the tracked base validator.
    subprocess.run(['patch', '-o', str(destination), pin['baseValidatorPath'],
                    str(package / pin['patchFile'])], check=True)
    require_hash(destination, pin['reconstructedHelperSha256'])
    ast.parse(destination.read_text(), filename=str(destination))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--verify-only', action='store_true', help='Hashes, helper reconstruction and syntax only; no downloads or registration.')
    args = parser.parse_args()
    require_hash(pin['referenceRecipePath'], pin['referenceRecipeSha256'])
    for item in pin['preservedFiles']:
        path = package / item['file']
        require_hash(path, item['sha256'])
        if path.suffix == '.py':
            ast.parse(path.read_text(), filename=str(path))
    with tempfile.TemporaryDirectory(prefix='smash-registration-') as directory:
        helper = Path(directory) / 'validate-mosaic.py'
        reconstruct(helper)
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
            urllib.request.urlretrieve(item['url'], partial)
            require_hash(partial, item['sha256'])
            partial.replace(path)
        require_hash(path, item['sha256'])
    for command in procedure['commands']:
        subprocess.run([sys.executable, *command[1:]], check=True)
    gate = json.loads((target.parent / 'direction-gate.json').read_text())
    outskirts = json.loads((target.parent / 'dss2-outskirts-check.json').read_text())
    if not gate['pass'] or gate['uniqueMatchedStars'] < 20000 or gate['heldOutCount'] < 6000:
        raise ValueError('Central registration did not reproduce its positive evidence.')
    print('REGISTRATION_REPLAY_FINISHED; central pass:', gate['pass'],
          '; external outskirts precision pass:', outskirts['pass'])


if __name__ == '__main__':
    main()
