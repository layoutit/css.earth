import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { resolve } from 'node:path';
import { projectRoot } from '@cssearth/core/node';
import { testLaneFiles } from '../ci/affected-tests.mts';
import { discoverObjectTests } from '@cssearth/bake/run-implemented-objects/source';

const root = projectRoot(import.meta.url);
test('per-object discovery keeps shared suites and every body-owned suite collected in root lanes', async () => {
  const files = await discoverObjectTests('earth', { projectRoot: root });
  assert.ok(files.includes(resolve(root, 'site/world/runtime-package.test.mts')));
  assert.ok(files.includes(resolve(root, 'packages/bake/src/raster/raster-pages.test.mts')));
  const lanes = testLaneFiles(root, JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as unknown, ['test:packages', 'test:site']);
  for (const file of [...lanes.packages, ...lanes.site].filter(file => file.startsWith('src/objects/earth/')))
    assert.ok(files.includes(resolve(root, file)), file);
  assert.equal(files.length, new Set(files).size);
});
