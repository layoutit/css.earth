import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '../..');
const cli = resolve(root, 'packages/bake/cli/prepare-factsheets.mts');

for (const [label, cwd] of [['outside the repository', tmpdir()], ['packages/bake', resolve(root, 'packages/bake')]] as const) {
  test(`prepare-factsheets --check resolves its own checkout when run from ${label}`, () => {
    const run = spawnSync(process.execPath, [cli, '--check', '--quiet', 'moon'], { cwd, encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr);
    const report = JSON.parse(run.stdout.trim().split('\n').at(-1)!);
    assert.equal(report.check, true);
    assert.equal(report.objects, 1);
  });
}
