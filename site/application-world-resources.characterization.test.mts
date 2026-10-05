import assert from 'node:assert/strict';
import { test, mock, beforeEach, after } from 'node:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { OBJECT_SCHEMA } from '@cssearth/objects';
import { APPLICATION_WORLD_CONTEXT } from './world-context-plan.mts';
import { CONTEXT_DATASETS } from './context-datasets.mts';

const renderer = await import('@cssearth/renderer/universe');
const world = await import('./world-context-plan.mts');
const entries = await import('./object-entries.mts');
const visibility = await import('./application-world-visibility.mts');
mock.module(new URL('./application-world-visibility.mts', import.meta.url).href, { namedExports: { ...visibility, worldVisibilityPolicy: { ...visibility.worldVisibilityPolicy, compact: process.env.RESOURCE_PHONE === 'true' } } });
const frame = { referenceFrame: 'sun-icrf', epochJdTt: 1, originM: [0, 0, 0], localToReferenceXyzw: [0, 0, 0, 1], metersPerUnit: 1, boundsUnits: { min: [-1, -1, -1], max: [1, 1, 1] } };
const descriptor = (id: string, type: string, properties: Record<string, unknown> = {}, format = 'cssearth-fixture@1') => ({ schema: OBJECT_SCHEMA, id, type, properties, prepared: { format, url: 'prepared/payload.json' } });
const volumeId = APPLICATION_WORLD_CONTEXT.volume.objectId, starId = APPLICATION_WORLD_CONTEXT.stars.objectId;
const descriptors = [descriptor(volumeId, 'density-volume', { host: 'inside' }), descriptor(starId, 'point-appearance'),
  descriptor('shell', 'surface-shell'), descriptor('layers', 'image-layer-bank', { frame, preparation: { source: 'source/recipe.json' }, cataloguePoints: ['dots'] }),
  descriptor('volume', 'volume-dataset-bank', { frame, cataloguePoints: ['stars'] }),
  descriptor('points', 'catalogue-point-bank', { host: 'sun' }), descriptor('unhosted', 'catalogue-point-bank'),
  descriptor('field', 'galaxy-point-field', { farBanks: { banks: ['prepared/far.bin'], fromDistancePc: 2 } }),
  descriptor('inside', 'fixture', { zoom: {}, catalog: { name: 'Inside host' } }),
  descriptor('plain-mesh', 'map-sphere', {}, 'cssearth-image-mesh@1'),
  descriptor('bad-mesh', 'map-sphere', { views: [] }, 'cssearth-image-mesh@1'),
  descriptor('mesh', 'map-sphere', { host: 'inside', views: { default: 'off', datasets: { off: 'hidden', open: 'cutaway', full: 'full' } } }, 'cssearth-image-mesh@1')];
const declarations: Record<string, unknown> = Object.fromEntries(descriptors.map(item => [`../src/objects/${item.id}/object.json`, item]));
const filesFor = (id: string, value: unknown = descriptors.find(item => item.id === id)) => Object.fromEntries([
  [`../src/objects/${id}/object.json`, value],
  ...['payload.json', 'far.bin', 'globular-clusters.bin', 'old-star-dots.bin', 'dots.bin', 'stars.bin', 'backing.json', 'texture.webp'].map(path => [`../src/objects/${id}/prepared/${path}`, `/fixture/${id}/${path}`]),
]);
const assets = Object.assign({}, ...descriptors.map(item => filesFor(item.id)));
const availability: Record<string, { available: boolean }> = { volume: { available: true }, carried: { available: true }, unavailable: { available: false } };
let options!: Parameters<typeof renderer.createPreparedUniverse>[0];
let onEntry!: (id: string, value: unknown) => void;
let onSystems!: (plan: typeof APPLICATION_WORLD_CONTEXT) => void;
const effects: unknown[] = [];
const requests: string[] = [];
let bankResponse: Response | null = null;
let catalogLoads = 0, plannerCount = 0;
let loadFailure: Error | null = new Error('initial volume decode');
mock.module(new URL('./prepared-context-objects.mts', import.meta.url).href, { namedExports: { CONTEXT_OBJECT_DESCRIPTORS: declarations, CONTEXT_OBJECT_ASSET_URLS: assets, CONTEXT_GALAXY_SAMPLE: {} } });
mock.module(new URL('./context-availability.mts', import.meta.url).href, { namedExports: { CONTEXT_AVAILABILITY: availability } });
mock.module(new URL('./world-context-plan.mts', import.meta.url).href, { namedExports: { ...world,
  WORLD_DOT_BANKS: ['inside'], onWorldSystems: (callback: typeof onSystems) => { onSystems = callback; return () => {}; } } });
mock.module(new URL('./object-entries.mts', import.meta.url).href, { namedExports: { ...entries, onObjectEntry: (callback: typeof onEntry) => { onEntry = callback; return () => {}; } } });
mock.module(new URL('./dot-catalogues.mts', import.meta.url).href, { namedExports: { loadCatalogueDots: async () => { catalogLoads++; return { fixture: true }; } } });
mock.module('@cssearth/renderer/universe', { namedExports: { ...renderer,
  loadPreparedCssVolume: async () => { if (loadFailure) throw loadFailure; return { volume: true }; },
  loadPreparedPointAppearance: async () => ({ points: true }),
  loadPreparedCssSurfaceShell: async () => ({ shell: true }),
  loadPreparedCssImageLayers: async () => ({ layers: true }),
  loadPreparedVolumeDatasets: async () => ({ datasets: true }),
  createPreparedUniverse: (value: typeof options) => { options = value; return { createFramePlanner: () => ({ id: ++plannerCount }),
    addBanks: (banks: unknown) => effects.push(['banks', banks]), addSystems: (...args: unknown[]) => effects.push(['systems', ...args]) }; } } });
mock.method(globalThis, 'fetch', async (url: string | URL | Request) => {
  requests.push(String(url));
  const match = /context-assets\/([^/]+)\.json/u.exec(String(url));
  return bankResponse ?? Response.json(filesFor(match?.[1] ?? 'layers'));
});
Object.defineProperty(globalThis, 'location', { value: { origin: 'https://offline.test' }, configurable: true });
let loadApplicationUniverse: typeof import('./application-world-resources.mts')['loadApplicationUniverse'];
// Each case runs in its own Node test process with a canonical subject import.
// This resets the private universe singleton without query URLs (which L4 does
// not attribute to canonical sources). Mutable collaborators and dataset state
// are reset below. Any case can run alone via --test-name-pattern.
// The generated billboard table is not tracked and CI does not restore it. Each isolated case process starts with a loader
// hook, written to a temporary directory, that answers the module's `?raw` import of that file with a valid empty table.
// Nothing is written beside the sources and the real file, when present, is never read.
const hookDirectory = process.env.RESOURCE_CASE ? '' : mkdtempSync(join(tmpdir(), 'resources-hook-'));
if (hookDirectory) {
  const table = JSON.stringify({ schema: 'cssearth-dataset-billboards@2', imagePx: 256, banks: [] });
  writeFileSync(join(hookDirectory, 'hook.mjs'), `const ID = 'cssearth-fixture:dataset-billboards';
export const resolve = (specifier, context, next) => specifier.endsWith('prepared-dataset-billboards.json?raw')
  ? { url: ID, format: 'module', shortCircuit: true } : next(specifier, context);
export const load = (url, context, next) => url === ID
  ? { format: 'module', shortCircuit: true, source: ${JSON.stringify(`export default ${JSON.stringify(table)};`)} } : next(url, context);
`);
  writeFileSync(join(hookDirectory, 'register.mjs'), `import { register } from 'node:module';\nregister(${JSON.stringify(pathToFileURL(join(hookDirectory, 'hook.mjs')).href)});\n`);
  after(() => rmSync(hookDirectory, { recursive: true, force: true }));
}
function isolatedTest(name: string, run: () => Promise<void>, phone = false) {
  test(name, async () => {
    if (process.env.RESOURCE_CASE === name) { await run(); return; }
    const env: NodeJS.ProcessEnv = { ...process.env, RESOURCE_CASE: name, RESOURCE_PHONE: String(phone) };
    delete env.NODE_TEST_CONTEXT; // Start an independent runner, not an IPC child of this one.
    const child = spawnSync(process.execPath, [...process.execArgv.filter(argument => !argument.startsWith('--test-shard')), '--import', pathToFileURL(join(hookDirectory, 'register.mjs')).href, '--test', '--test-name-pattern', name, fileURLToPath(import.meta.url)],
      { encoding: 'utf8', timeout: 30000, env });
    assert.equal(child.status, 0, child.stdout + child.stderr);
    assert.match(child.stdout, /# pass 1(?:\n|\r)/u, 'the isolated case must actually run');
    assert.match(child.stdout, /# fail 0/u);
  });
}
const originalDeclarations = structuredClone(declarations);
beforeEach(async () => {
  Object.assign(declarations, structuredClone(originalDeclarations));
  CONTEXT_DATASETS.delete('mesh'); effects.length = requests.length = 0;
  bankResponse = null; catalogLoads = plannerCount = 0; loadFailure = null;
  if (process.env.RESOURCE_CASE) ({ loadApplicationUniverse } = await import('./application-world-resources.mts'));
});

isolatedTest('initial decode failure permits retry; concurrent successful loads share one universe and adopt the prestarted planner once', async () => {
  const failure = loadFailure = new Error('initial volume decode');
  await assert.rejects(loadApplicationUniverse(), error => error === failure);
  loadFailure = null;
  const fieldKey = '../src/objects/field/object.json', field = declarations[fieldKey];
  declarations[fieldKey] = descriptor('field', 'galaxy-point-field', { farBanks: { banks: [3], fromDistancePc: 0 } });
  await assert.rejects(loadApplicationUniverse(), /properties.farBanks: expected banks/);
  declarations[fieldKey] = descriptor('field', 'galaxy-point-field', { farBanks: { banks: ['prepared/far.bin'], fromDistancePc: 0 } });
  await assert.rejects(loadApplicationUniverse(), /properties.farBanks: expected banks/);
  declarations[fieldKey] = { schema: OBJECT_SCHEMA, id: 'field', type: 'galaxy-point-field', properties: {} };
  await assert.rejects(loadApplicationUniverse(), /a galaxy point field names its prepared dots/);
  declarations[fieldKey] = field;
  const first = loadApplicationUniverse(), second = loadApplicationUniverse(); assert.equal(first, second);
  const universe = await first;
  assert.deepEqual(universe.createFramePlanner(), { id: 1 }); assert.deepEqual(universe.createFramePlanner(), { id: 2 });
  assert.equal(await loadApplicationUniverse(), universe);
  assert.deepEqual(options.environmentLinks, { [volumeId]: '/inside/' }); assert.ok(options.contextBanks?.includes('mesh'));
  assert.equal(options.plainDots?.minimumDiameterPixels, 1.5);
  assert.deepEqual(options.pointBanks?.find(bank => bank.id === 'inside/plain-stars'), { id: 'inside/plain-stars', url: '/world/dots/inside.bin', host: 'inside', stars: true });
  assert.equal(options.sky, true);
  assert.deepEqual(options.backgroundCataloguePoints, [{ url: '/fixture/field/payload.json' }, { url: '/fixture/field/far.bin', fromDistanceM: 2 * 3.085677581491367e16 }]);
  assert.equal(options.resolveResource?.('texture.webp'), `/fixture/${volumeId}/texture.webp`);
  assert.equal(options.resolvePointResource?.('texture.webp'), `/fixture/${starId}/texture.webp`);
  assert.throws(() => options.resolveResource?.('missing.webp'), /Prepared context resource unavailable: prepared\/missing.webp\./);
  const shells = await universe.loadShells(); assert.equal(await universe.loadShells(), shells);
  assert.deepEqual(shells[0]?.payload, { shell: true }); assert.equal(shells[0]?.resolveResource('texture.webp'), '/fixture/shell/texture.webp');
});

isolatedTest('bank loaders reject unknown ids and failed file lists; successful loaders expose texture and catalogue URLs', async () => {
  await loadApplicationUniverse();
  await assert.rejects(options.loadImageLayer!('unknown'), /Unknown prepared image-layer bank: unknown\./);
  await assert.rejects(options.loadVolumeDataset!('unknown'), /Unknown prepared volume dataset bank: unknown\./);
  bankResponse = new Response('', { status: 503 });
  await assert.rejects(options.loadImageLayer!('layers'), /file list request failed \(503\)/);
  bankResponse = Response.json([]);
  await assert.rejects(options.loadImageLayer!('layers'), /is not a file list/);
  bankResponse = null;
  const layers = await options.loadImageLayer!('layers');
  assert.deepEqual(layers.payload, { layers: true }); assert.equal(layers.resolveResource('texture.webp'), '/fixture/layers/texture.webp');
  assert.deepEqual(layers.cataloguePointUrls, ['/fixture/layers/dots.bin']);
  const volume = await options.loadVolumeDataset!('volume');
  assert.deepEqual(volume.payload, { datasets: true }); assert.deepEqual(volume.cataloguePointUrls, ['/fixture/volume/stars.bin']);
  assert.equal(volume.resolveResource('texture.webp'), '/fixture/volume/texture.webp');
  assert.ok(requests.includes('/world/context-assets/layers.json')); assert.ok(requests.includes('/world/context-assets/volume.json'));
  const [a, b] = await Promise.all([options.loadCatalog!(), options.loadCatalog!()]);
  assert.deepEqual(a, b); assert.equal(catalogLoads, 1); await options.loadCatalog!(); assert.equal(catalogLoads, 1);
  const [plainMesh, badMesh, mesh] = options.imageMeshes!;
  assert.ok(plainMesh && badMesh && mesh); assert.equal(plainMesh.cutaway?.(), true); assert.equal(plainMesh.hidden?.(), false);
  assert.throws(() => badMesh.cutaway?.(), /expected its datasets' views and the default dataset/);
  assert.equal(mesh.resolveResource('texture.webp'), '/fixture/mesh/texture.webp');
  assert.equal(mesh.hidden?.(), true); assert.equal(mesh.cutaway?.(), false); assert.equal(mesh.hiddenCaption, 'Inside host');
  CONTEXT_DATASETS.set('mesh', 'open'); assert.equal(mesh.cutaway?.(), true); assert.equal(mesh.hidden?.(), false);
  CONTEXT_DATASETS.set('mesh', 'full'); assert.equal(mesh.cutaway?.(), false); assert.equal(mesh.hidden?.(), false);
  CONTEXT_DATASETS.set('mesh', 'missing'); assert.throws(() => mesh.cutaway?.(), /a view is cutaway, full or hidden, not undefined/);
  CONTEXT_DATASETS.delete('mesh');
});

isolatedTest('carried banks validate structure, ignore duplicates and unavailable payloads, and join live world systems', async () => {
  await loadApplicationUniverse();
  onEntry('host', null); onEntry('host', {});
  assert.throws(() => onEntry('host', { banks: 3 }), /expected a list of banks/);
  assert.throws(() => onEntry('host', { banks: [null] }), /expected a descriptor with its files/);
  assert.throws(() => onEntry('host', { banks: [{ files: [] }] }), /expected a descriptor with its files/);
  const carried = descriptor('carried', 'volume-dataset-bank', { frame }), points = descriptor('carried-points', 'catalogue-point-bank', { host: 'host' });
  onEntry('host', { banks: [{ descriptor: carried, files: filesFor('carried', carried) }, { descriptor: points, files: filesFor('carried-points', points) },
    { descriptor: descriptor('unavailable', 'volume-dataset-bank', { frame }) }] });
  const effect = effects.at(-1); assert.ok(Array.isArray(effect));
  assert.deepEqual(effect[1], { volumeDatasetBanks: [{ id: 'carried', frame }], pointBanks: [{ id: 'carried-points', url: '/fixture/carried-points/payload.json', host: 'host' }] });
  onEntry('host', { banks: [{ descriptor: carried }] }); assert.deepEqual(effects.at(-1), ['banks', { volumeDatasetBanks: [], pointBanks: [] }]);
  assert.throws(() => onEntry('host', { banks: [{ descriptor: descriptor('wrong', 'surface-shell') }] }), /an entry carries volume dataset banks and catalogue dots only/);
  const added = { ...APPLICATION_WORLD_CONTEXT.bodies[0]!, id: 'added-body' };
  const next = { ...APPLICATION_WORLD_CONTEXT, bodies: [...APPLICATION_WORLD_CONTEXT.bodies, added] };
  onSystems(next); onSystems(next);
  const systems = effects.filter(effect => Array.isArray(effect) && effect[0] === 'systems');
  assert.equal(systems.length, 2);
  assert.ok(Array.isArray(systems[0]) && Array.isArray(systems[1]));
  assert.notDeepEqual(systems[0][2], systems[1][2], 'the second callback carries no already-drawn body sprites');
  assert.deepEqual(systems[1][2], {});
});

isolatedTest('phone viewport disables the prepared sky', async () => {
  await loadApplicationUniverse(); assert.equal(options.sky, false);
}, true);
