import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { sha256 } from '../src/platform/sha256.mts';
import { ciPreparationInputs, requireCiInputMode, restoreCiPreparationInputs } from './prepare-ci-inputs.mts';

async function fixture(t: { after: (cleanup: () => Promise<unknown>) => void }) {
  const root = await mkdtemp(resolve(tmpdir(), 'cssearth-preparation-inputs-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const payloads = new Map<string, Buffer>();
  const json = async (path: string, value: unknown) => {
    const file = resolve(root, path);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(value));
  };
  const inventory = async (id: string, kind: 'prepared' | 'runtime', filenames: string[], resourceRoot?: 'prepared') => {
    const assets = filenames.map(filename => {
      const bytes = Buffer.from(`${id}/${filename}`);
      const digest = sha256(bytes);
      payloads.set(`runtime-assets/${digest}/${filename}`, bytes);
      return { filename, bytes: bytes.length, sha256: digest };
    });
    await json(`src/objects/${id}/${kind}-assets.json`, {
      schema: `css${id}-${kind}-assets@1`, ...(kind === 'prepared' || resourceRoot ? { resourceRoot: 'prepared' } : {}), assets,
    });
  };
  await inventory('mimas', 'prepared', ['runtime.json', 'scene.json']);
  await inventory('mimas', 'runtime', ['surface.webp']);
  // A newly inventoried body joins navigation coverage without updating this helper's selection.
  await inventory('new-body', 'prepared', ['runtime.json', 'scene.json']);
  await inventory('new-body', 'runtime', ['unrelated.webp']);
  await inventory('milky-way', 'prepared', ['volume.json', 'slices/z/one.webp']);
  await inventory('helix', 'prepared', ['lenses.json', 'slice.webp', 'presentation.json', 'provenance.json']);
  await inventory('helix', 'runtime', ['unrelated-preview.webp']);
  await json('src/objects/helix/source/presentation.json', { schema: 'cssearth-volume-presentation-source@1', objectId: 'helix' });
  await inventory('local-group', 'runtime', ['catalogue.json', 'presentation.json', 'provenance.json'], 'prepared');
  await json('src/objects/local-group/source/presentation.json', { provenance: { products: [] } });
  const fetcher: typeof fetch = async url => {
    const key = new URL(String(url)).pathname.slice(1), bytes = payloads.get(key);
    assert.ok(bytes, `Only declared fixture bytes may be requested: ${key}`);
    return new Response(Uint8Array.from(bytes));
  };
  return { root, fetcher };
}

test('preparation selection retains all prepared packages and real fixture textures, not unrelated public banks', async t => {
  const { root } = await fixture(t);
  const assets = await ciPreparationInputs(root);
  assert.deepEqual(assets.map(asset => `${asset.id}/${asset.filename}`).sort(), [
    'helix/lenses.json', 'helix/presentation.json', 'helix/provenance.json', 'helix/slice.webp',
    'local-group/presentation.json', 'local-group/provenance.json',
    'milky-way/slices/z/one.webp', 'milky-way/volume.json',
    'mimas/runtime.json', 'mimas/scene.json', 'mimas/surface.webp',
    'new-body/runtime.json', 'new-body/scene.json',
  ]);
  assert.equal(new Set(assets.map(asset => asset.file)).size, assets.length, 'Metadata shared with a prepared inventory installs once.');
  assert.deepEqual(assets.filter(asset => asset.file.startsWith(resolve(root, 'public') + '/')).map(asset => asset.id), ['mimas']);
});

test('selected inputs install, reuse offline, and reject corrupted bytes through the existing SHA verifier', async t => {
  const { root, fetcher } = await fixture(t);
  const assets = await ciPreparationInputs(root);
  const expected = { files: assets.length, bytes: assets.reduce((sum, asset) => sum + asset.bytes, 0) };
  assert.deepEqual(await restoreCiPreparationInputs({ root, fetcher }), { ...expected, installed: assets.length, reused: 0, skipped: 0 });
  assert.deepEqual(await restoreCiPreparationInputs({ root, fetcher: async () => { throw new Error('Cached inputs must be offline.'); } }),
    { ...expected, installed: 0, reused: assets.length, skipped: 0 });
  const asset = assets.find(asset => asset.id === 'mimas' && asset.filename === 'surface.webp');
  assert.ok(asset);
  const original = await readFile(asset.file);
  await writeFile(asset.file, Buffer.alloc(original.length));
  await assert.rejects(restoreCiPreparationInputs({ root, fetcher: async () => new Response(Buffer.alloc(original.length)) }), /hash drifted/);
  assert.deepEqual(await readFile(asset.file), Buffer.alloc(original.length), 'A failed download never publishes unverified bytes.');
  await restoreCiPreparationInputs({ root, fetcher });
  assert.deepEqual(await readFile(asset.file), original);
});

test('a missing required fixture remains a failure even with the deployment allow-missing environment', async t => {
  const { root, fetcher } = await fixture(t);
  await restoreCiPreparationInputs({ root, fetcher });
  const asset = (await ciPreparationInputs(root)).find(asset => asset.id === 'mimas' && asset.filename === 'surface.webp');
  assert.ok(asset);
  await rm(asset.file);
  const previous = process.env.CSSEARTH_ALLOW_MISSING_ASSETS;
  process.env.CSSEARTH_ALLOW_MISSING_ASSETS = '1';
  try {
    await assert.rejects(restoreCiPreparationInputs({ root, fetcher: async () => new Response(null, { status: 404 }) }), /mimas\/surface.webp \(HTTP 404\)/);
    await assert.rejects(readFile(asset.file), { code: 'ENOENT' });
  } finally {
    if (previous === undefined) delete process.env.CSSEARTH_ALLOW_MISSING_ASSETS;
    else process.env.CSSEARTH_ALLOW_MISSING_ASSETS = previous;
  }
});

test('the CLI accepts only the implemented preparation mode and rejects broader or permissive flags', () => {
  assert.equal(requireCiInputMode(['universe-preparation']), 'universe-preparation');
  for (const args of [[], ['universe'], ['--allow-missing'], ['universe-preparation', '--allow-missing']]) {
    assert.throws(() => requireCiInputMode(args), /Usage:/);
  }
});
