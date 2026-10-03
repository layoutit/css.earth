import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
test('checkout bootstrap installs before restoration and generates before compiler preparation', async () => {
  const source = await readFile(new URL('./setup.mts', import.meta.url), 'utf8');
  const steps = ["['install', '--frozen-lockfile']", "['setup:prepared']", "['.github/scripts/ci/build-ci.mts', 'full']", "['prepare:typecheck']"];
  const positions = steps.map(step => source.indexOf(step));
  assert.ok(positions.every(position => position >= 0));
  assert.deepEqual([...positions].sort((a, b) => a - b), positions);
  assert.match(source, /CI: 'true'/u);
  const preparation = await readFile(new URL('../prepare-typecheck.mts', import.meta.url), 'utf8');
  assert.match(preparation, /inventoryAssets\(root, \['earth'\], \{ location: 'public', filenames: \['earth-places\.json'\] \}\)/u);
  assert.match(preparation, /uniqueAssets\(\[\.\.\.earthPlaces,/u);
});
