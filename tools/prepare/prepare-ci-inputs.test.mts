import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { sha256 } from '../../src/platform/sha256.mts';
import { ciPreparationInputs, ciUniverseInputs, requireCiInputMode, restoreCiPreparationInputs, restoreCiUniverseInputs } from './prepare-ci-inputs.mts';

async function fixture(t: { after: (cleanup: () => Promise<unknown>) => void }) {
  const root = await mkdtemp(resolve(tmpdir(), 'cssearth-preparation-inputs-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const payloads = new Map<string, Buffer>();
  const json = async (path: string, value: unknown) => {
    const file = resolve(root, path);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(value));
  };
  type Asset = { location: string; filename: string; bytes: number; sha256: string };
  // Adds files to the object's one inventory: `prepared` (or a `runtime` set rooted in prepared/) or public textures.
  const inventory = async (id: string, kind: 'prepared' | 'runtime', filenames: string[], resourceRoot?: 'prepared') => {
    const location = kind === 'prepared' || resourceRoot === 'prepared' ? 'prepared' : 'public';
    const assets = filenames.map(filename => {
      const bytes = Buffer.from(`${id}/${filename}`);
      const digest = sha256(bytes);
      payloads.set(`runtime-assets/${digest}/${filename}`, bytes);
      return { location, filename, bytes: bytes.length, sha256: digest };
    });
    const file = resolve(root, `src/objects/${id}/inventory.json`);
    const current: Asset[] = await readFile(file, 'utf8').then(text => JSON.parse(text).assets).catch(() => []);
    const kept = current.filter(asset => !assets.some(next => next.location === asset.location && next.filename === asset.filename));
    await json(`src/objects/${id}/inventory.json`, { schema: 'cssearth-inventory@1', assets: [...kept, ...assets] });
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
  return { root, fetcher, inventory };
}

async function universeFixture(t: { after: (cleanup: () => Promise<unknown>) => void }) {
  const result = await fixture(t);
  await result.inventory('mimas', 'runtime', ['surface.webp', 'features.json']);
  await result.inventory('new-body', 'runtime', ['unrelated.webp', 'new-body-photometric-phase-curve.svg', 'unrelated.svg']);
  await result.inventory('heliosphere', 'prepared', ['shell.json', 'atlas.webp']);
  await result.inventory('stellar-neighbourhood', 'prepared', ['stars.json', 'stars.bin', 'point-atlas.png']);
  await result.inventory('milky-way', 'runtime', ['unused-preview.webp']);
  await result.inventory('m31', 'runtime', ['layers.json', 'image.webp'], 'prepared');
  // Two manifest kinds may name the same prepared JSON; one validated installation suffices.
  await result.inventory('local-group', 'prepared', ['catalogue.json']);
  return result;
}

test('preparation selection retains all prepared packages and real fixture textures, not unrelated public banks', async t => {
  const { root } = await fixture(t);
  const assets = await ciPreparationInputs(root);
  assert.deepEqual(assets.map(asset => `${asset.id}/${asset.filename}`).sort(), [
    'helix/lenses.json', 'helix/presentation.json', 'helix/provenance.json', 'helix/slice.webp',
    'local-group/catalogue.json', 'local-group/presentation.json', 'local-group/provenance.json',
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

test('universe selection keeps registry JSON and actual renderer banks without unrelated imagery', async t => {
  const { root } = await universeFixture(t);
  const assets = await ciUniverseInputs(root);
  assert.deepEqual(assets.map(asset => `${asset.id}/${asset.filename}`).sort(), [
    'heliosphere/atlas.webp', 'heliosphere/shell.json',
    'helix/lenses.json', 'helix/presentation.json', 'helix/provenance.json',
    'local-group/catalogue.json', 'local-group/presentation.json', 'local-group/provenance.json',
    'm31/layers.json',
    'milky-way/slices/z/one.webp', 'milky-way/volume.json',
    'mimas/features.json', 'mimas/runtime.json', 'mimas/scene.json',
    'new-body/new-body-photometric-phase-curve.svg', 'new-body/runtime.json', 'new-body/scene.json',
    'stellar-neighbourhood/stars.bin', 'stellar-neighbourhood/stars.json',
  ]);
  assert.equal(new Set(assets.map(asset => asset.file)).size, assets.length);
  assert.deepEqual(assets.filter(asset => asset.file.startsWith(resolve(root, 'public') + '/')).map(asset => asset.filename).sort(),
    ['features.json', 'new-body-photometric-phase-curve.svg']);
  assert.deepEqual(assets.filter(asset => !asset.filename.endsWith('.json')).map(asset => `${asset.id}/${asset.filename}`).sort(), [
    'heliosphere/atlas.webp', 'milky-way/slices/z/one.webp', 'new-body/new-body-photometric-phase-curve.svg', 'stellar-neighbourhood/stars.bin',
  ]);
});

test('universe inputs install from empty assets, reuse offline and reject a mutated numerical bank', async t => {
  const { root, fetcher } = await universeFixture(t);
  const assets = await ciUniverseInputs(root);
  const expected = { files: assets.length, bytes: assets.reduce((sum, asset) => sum + asset.bytes, 0) };
  assert.deepEqual(await restoreCiUniverseInputs({ root, fetcher }), { ...expected, installed: assets.length, reused: 0, skipped: 0 });
  assert.deepEqual(await restoreCiUniverseInputs({ root, fetcher: async () => { throw new Error('Cached inputs must be offline.'); } }),
    { ...expected, installed: 0, reused: assets.length, skipped: 0 });
  const bank = assets.find(asset => asset.id === 'stellar-neighbourhood' && asset.filename === 'stars.bin');
  assert.ok(bank);
  const original = await readFile(bank.file);
  await writeFile(bank.file, Buffer.alloc(original.length));
  await assert.rejects(restoreCiUniverseInputs({ root, fetcher: async () => new Response(Buffer.alloc(original.length)) }), /hash drifted/);
  await restoreCiUniverseInputs({ root, fetcher });
  assert.deepEqual(await readFile(bank.file), original);
});

test('universe missing renderer imagery is fatal even if deployment allows missing assets', async t => {
  const { root, fetcher } = await universeFixture(t);
  await restoreCiUniverseInputs({ root, fetcher });
  const atlas = (await ciUniverseInputs(root)).find(asset => asset.id === 'heliosphere' && asset.filename === 'atlas.webp');
  assert.ok(atlas);
  await rm(atlas.file);
  const previous = process.env.CSSEARTH_ALLOW_MISSING_ASSETS;
  process.env.CSSEARTH_ALLOW_MISSING_ASSETS = '1';
  try {
    await assert.rejects(restoreCiUniverseInputs({ root, fetcher: async () => new Response(null, { status: 404 }) }), /heliosphere\/atlas.webp \(HTTP 404\)/);
    await assert.rejects(readFile(atlas.file), { code: 'ENOENT' });
  } finally {
    if (previous === undefined) delete process.env.CSSEARTH_ALLOW_MISSING_ASSETS;
    else process.env.CSSEARTH_ALLOW_MISSING_ASSETS = previous;
  }
});

test('universe phase charts are SHA-verified and remain required for newly inventoried bodies', async t => {
  const { root, fetcher } = await universeFixture(t);
  await restoreCiUniverseInputs({ root, fetcher });
  const chart = (await ciUniverseInputs(root)).find(asset => asset.filename === 'new-body-photometric-phase-curve.svg');
  assert.ok(chart, 'The source-check chart family includes future bodies without a fixed planet list.');
  const original = await readFile(chart.file);
  await writeFile(chart.file, Buffer.alloc(original.length));
  await assert.rejects(restoreCiUniverseInputs({ root, fetcher: async () => new Response(Buffer.alloc(original.length)) }), /hash drifted/);
  await rm(chart.file);
  await assert.rejects(restoreCiUniverseInputs({ root, fetcher: async () => new Response(null, { status: 404 }) }),
    /new-body\/new-body-photometric-phase-curve\.svg \(HTTP 404\)/);
  await assert.rejects(readFile(chart.file), { code: 'ENOENT' });
  await restoreCiUniverseInputs({ root, fetcher });
  assert.deepEqual(await readFile(chart.file), original);
});

test('the CLI accepts only the implemented input modes and rejects broader or permissive flags', () => {
  assert.equal(requireCiInputMode(['universe']), 'universe');
  assert.equal(requireCiInputMode(['universe-preparation']), 'universe-preparation');
  for (const args of [[], ['everything'], ['--allow-missing'], ['universe-preparation', '--allow-missing'], ['universe', '--allow-missing']]) {
    assert.throws(() => requireCiInputMode(args), /Usage:/);
  }
});
