#!/usr/bin/env python3
"""Run B9 qualification checks serially through the existing resource guard.

Optional positional names select checks. Failures are recorded independently;
the final exit code is nonzero if any selected check fails. No preparation,
browser, publication or file restoration is performed by this runner.
"""
import glob
import json
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[3]
os.chdir(ROOT)
node_test = ['node', '--test', '--test-concurrency=1']
scientific = ['scientific-raster', 'scientific-quality', 'scientific-focus',
              'lens-texture-scale', 'radial-scientific-raster', 'observed-geotiff', 'profile']
checks = {
    'numeric': ['output/b9-python/bin/python', '-m', 'unittest', 'discover', '-s',
                'tools/objects/acquisition', '-p', 'test_cassini*.py'],
    'scientific': node_test + [f'tools/objects/terrestrial-layers/{name}.test.mjs' for name in scientific],
    'packages': ['pnpm', '-r', '--workspace-concurrency=1', '--filter', './packages/**',
                 'exec', 'vitest', 'run', '--maxWorkers=1', '--no-file-parallelism'],
    'renderer': ['pnpm', '--filter', '@cssearth/engine', 'exec', 'vitest', 'run', '--root',
                 '../../src/renderers/css', '--exclude', '**/preparation/**',
                 '--maxWorkers=1', '--no-file-parallelism'],
    'platform': node_test + sorted(glob.glob('src/platform/*.test.mjs') +
                                   glob.glob('src/navigation/*.test.mjs') + glob.glob('tools/*.test.mjs')),
    'shell': node_test + sorted(glob.glob('site/test/*.test.mjs')),
    'production': ['pnpm', 'exec', 'astro', 'build'],
}
selected = sys.argv[1:] or list(checks)
if not set(selected) <= checks.keys():
    raise SystemExit('Select from: ' + ', '.join(checks))
env = dict(os.environ, OPENBLAS_NUM_THREADS='1', OMP_NUM_THREADS='1')
summary = []
for name in selected:
    label = 'b9-main-test-' + name
    completed = subprocess.run([sys.executable,
        'docs/moons/b3-preparation/final/resource-tools/run-bounded.py', label,
        *checks[name]], env=env, check=False)
    receipt = json.loads(Path('output/b3-resume', label + '.json').read_text())
    summary.append({'check': name, 'returnCode': completed.returncode, **receipt})
Path('output/b9-qualification').mkdir(parents=True, exist_ok=True)
Path('output/b9-qualification/checks-summary.json').write_text(json.dumps(summary, indent=2) + '\n')
raise SystemExit(int(any(item['returnCode'] for item in summary)))
