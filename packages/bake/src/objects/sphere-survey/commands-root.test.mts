import { projectRoot as findProjectRoot } from '@cssearth/core/node';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import test from 'node:test';

const ROOT = findProjectRoot(import.meta.url);
/** The first file each command reads for a body, relative to the checkout. */
const FIRST_READ: Readonly<Record<string, string>> = {
  'published-comparison.mts': 'src/objects/no-such-body/source/preparation/published-comparison.json',
  'sphere-survey-setup.mts': 'packages/astronomy/data/bodies/no-such-body.json',
  'sphere-survey-install.mts': 'src/objects/no-such-body/source/preparation/terrestrial.json',
};

test('the survey commands read the checkout they belong to, not the directory they are run from', () => {
  for (const [command, path] of Object.entries(FIRST_READ)) {
    const run = spawnSync(process.execPath, [resolve(ROOT, 'packages/bake/cli', command), 'no-such-body'],
      { cwd: resolve(ROOT, 'packages/bake'), encoding: 'utf8' });
    assert.notEqual(run.status, 0, command);
    assert.ok(run.stderr.includes(`open '${resolve(ROOT, path)}'`), `${command} reads ${path} from the checkout:\n${run.stderr.slice(0, 600)}`);
  }
});
