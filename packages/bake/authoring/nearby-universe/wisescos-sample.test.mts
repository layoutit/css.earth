import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { catalogueBankInputPath } from '@cssearth/bake/volume/node';
test('WISE color sampling uses the same bank path owner as catalogue preparation', async () => {
  const source = await readFile(new URL('./wisescos-sample.mts', import.meta.url), 'utf8');
  assert.match(source, /catalogueBankInputPath\(resolve\(sourceDirectory, '\.\.'\), 'desi-bright-galaxies', repository\)/u);
  const root = resolve('/fixture');
  assert.equal(catalogueBankInputPath(resolve(root, 'src/objects/nearby-universe-galaxies'), 'desi-bright-galaxies', root),
    resolve(root, 'output/catalogue-points/nearby-universe-galaxies/desi-bright-galaxies.json'));
  assert.doesNotMatch(source, /catalogue-points\/nearby-universe\//u);
});
