import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, copyFile, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { restoreCompactLmc } from './compact-lmc.js';
import { hash } from './io.js';

const root = process.cwd();
const manifestPath = 'src/objects/lmc/source/bake-inputs/inputs.json';
test('accepted LMC slices replay from compact fields without native sources or network', async () => {
  const cold = await mkdtemp(resolve(tmpdir(), 'compact-lmc-test-'));
  const manifest = await readFile(resolve(root, manifestPath));
  const input = JSON.parse(manifest.toString());
  const paths = [manifestPath, input.densityRecipe.path, input.atlasInputs.path,
    'src/objects/lmc/source/bake-inputs/density/density.ktx2',
    'src/objects/lmc/source/bake-inputs/density/provenance.json',
    ...input.lenses.flatMap((lens: {material: {path: string}; provenance: {path: string}}) => [lens.material.path, lens.provenance.path])];
  const fetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('Compact replay must not download.'); };
  try {
    for (const path of paths) { await mkdir(dirname(resolve(cold, path)), {recursive: true}); await copyFile(resolve(root, path), resolve(cold, path)); }
    const results = await restoreCompactLmc(cold, {path: manifestPath, sha256: hash(manifest)}, resolve(cold, 'out'));
    assert.equal(results.length, 3);
    const expected = JSON.parse(await readFile(resolve(cold, input.atlasInputs.path), 'utf8'));
    for (const result of results) {
      const lens = expected.lenses.find((value: {id: string}) => value.id === result.imageId);
      assert.equal(lens.resources.length, 144);
      for (const resource of lens.resources) {
        const bytes = await readFile(resolve(result.directory, resource.path.slice(result.imageId.length + 1)));
        assert.equal(hash(bytes), resource.sha256);
      }
    }
  } finally { globalThis.fetch = fetch; await rm(cold, {recursive: true, force: true}); }
});

test('compact input pins reject altered snapshots before baking', async () => {
  const cold = await mkdtemp(resolve(tmpdir(), 'compact-lmc-pin-'));
  try {
    await writeFile(resolve(cold, 'input.json'), '{}');
    await assert.rejects(restoreCompactLmc(cold, {path: 'input.json', sha256: '0'.repeat(64)}, resolve(cold, 'out')), /Input hash differs/);
  } finally { await rm(cold, {recursive: true, force: true}); }
});
