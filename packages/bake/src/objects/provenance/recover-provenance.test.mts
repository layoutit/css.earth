import { projectRoot } from '@cssearth/core/node';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { sourceTest } from '@cssearth/objects/node/source-test';
import type { PreparedOutput } from '@cssearth/bake/delivery';
import { recoverObjectProvenance } from '@cssearth/bake/objects/provenance';
const test = sourceTest();

test('a provenance run for named objects writes their records and the shared catalogue, and no other package', async () => {
  const root = projectRoot(import.meta.url), modes: unknown[] = [], written: string[] = [];
  const catalogue = [{ path: resolve(root, 'site/prepared-sources.json'), text: '{}\n' }, { path: resolve(root, 'site/prepared-facilities.json'), text: '{}\n' }];
  // What a compilation from authoring inputs also returns: another package's record and inventory (M31 was one of 16).
  const unrelated = [{ path: resolve(root, 'src/objects/m31/prepared/provenance.json'), text: '{}\n' }, { path: resolve(root, 'src/objects/m31/inventory.json'), text: '{}\n' }];
  const run = (ids: readonly string[] | null) => recoverObjectProvenance(ids, { root,
    compile: async options => { modes.push(options?.packageMode); return { outputs: [...unrelated, ...catalogue], catalogueOutputs: catalogue, preparedSources: { usage: { edges: [] } } }; },
    write: async (outputs: readonly PreparedOutput[]) => { written.push(...outputs.map(output => output.path.slice(root.length + 1))); } });
  await run(['achilles']);
  assert.deepEqual(written, ['src/objects/achilles/prepared/provenance.json', 'site/prepared-sources.json', 'site/prepared-facilities.json']);
  assert.deepEqual(modes, ['published'], 'the other packages enter the catalogue as installed, as dev:prepare and deploy compile it');
});
