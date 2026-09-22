import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { copyFile, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { relative, resolve } from 'node:path';
import test, { type TestContext } from 'node:test';
import type { AddressInfo } from 'node:net';
import { SCENE_OBJECTS } from '../../site/objects.mts';
import { validateObjectPackageFiles } from '../contract/object-package-contract.mts';
import { requireArray, requireRecord, requireString } from '../sources/source-values.mts';
import { parseAcquisitionPlan } from '../objects/dist/operations.js';
import { requireInventory } from '../../src/platform/runtime-asset-closure.mts';

const project = resolve(import.meta.dirname, '../..');
const pin = (path: string, _bytes: Uint8Array) => ({ path });
const json = (path: string, value: unknown): Promise<void> => writeFile(path, JSON.stringify(value));
async function fixture(t: TestContext, id = 'titan'): Promise<string> {
  const root = await mkdtemp(resolve(tmpdir(), 'cssearth-restore-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const dir of ['tools/assets', 'tools/sources', 'tools/objects/dist', 'site', `src/objects/${id}/source/preparation`, `src/objects/${id}/prepared`, `public/scenes/${id}`]) {
    await mkdir(resolve(root, dir), { recursive: true });
  }
  await copyFile(resolve(project, 'tools/assets/restore-source-inputs.mts'), resolve(root, 'tools/assets/restore-source-inputs.mts'));
  await copyFile(resolve(project, 'tools/assets/runtime-assets.mts'), resolve(root, 'tools/assets/runtime-assets.mts'));
  // `runtime-assets.mts` imports `RUNTIME_ASSET_ORIGIN` from here; without it the fixture root cannot resolve.
  await copyFile(resolve(project, 'tools/assets/asset-origin.mts'), resolve(root, 'tools/assets/asset-origin.mts'));
  await copyFile(resolve(project, 'tools/assets/source-mirror.mts'), resolve(root, 'tools/assets/source-mirror.mts'));
  await copyFile(resolve(project, 'tools/sources/source-values.mts'), resolve(root, 'tools/sources/source-values.mts'));
  await copyFile(resolve(project, 'tools/objects/dist/operations.js'), resolve(root, 'tools/objects/dist/operations.js'));
  await symlink(resolve(project, 'src/platform'), resolve(root, 'src/platform'));
  await symlink(resolve(project, 'node_modules'), resolve(root, 'node_modules'));
  await writeFile(resolve(root, 'site/objects.mts'), `export const OBJECTS = [{id:'${id}',name:'${id}'}];\nexport const SCENE_OBJECTS = OBJECTS;`);
  await json(resolve(root, `src/objects/${id}/object.json`), { id });
  return root;
}
async function run(root: string, args: readonly string[]): Promise<void> {
  await new Promise<void>((accept, reject) => {
    const child = spawn(process.execPath, args, { cwd: root });
    let output = '';
    child.stdout.on('data', data => output += data);
    child.stderr.on('data', data => output += data);
    child.on('error', reject);
    child.on('close', code => code === 0 ? accept() : reject(new Error(output)));
  });
}

type Scan = { missingSources: string[] };
let scan: Promise<Scan> | undefined;
const scanPackages = () => scan ??= runScan();

async function runScan(): Promise<Scan> {
  const tracked = new Set(execFileSync('git', ['ls-files', '--cached', '-z'], {
    cwd: project, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
  }).split('\0'));
  const missingSources: string[] = [];
  for (const id of SCENE_OBJECTS.map(object => object.id)) {
    // Nothing under prepared/ is git-tracked: a clean checkout restores the baked files from R2 via the object's
    // inventory.json. Every other required file keeps the original "must be tracked" proof.
    const preparedPrefix = `src/objects/${id}/prepared/`;
    await validateObjectPackageFiles({ id, name: id }, { projectRoot: project,
      accessFile: async path => {
        if (typeof path !== 'string') throw new TypeError('Fixture access must receive a string path.');
        const relativePath = relative(project, path);
        if (relativePath.startsWith(preparedPrefix)) {
          const filename = relativePath.slice(preparedPrefix.length);
          const inventory = requireInventory(id, JSON.parse(
            await readFile(resolve(project, 'src/objects', id, 'inventory.json'), 'utf8')));
          assert.ok(inventory.assets.some(asset => asset.location === 'prepared' && asset.filename === filename), path);
          return;
        }
        assert.ok(tracked.has(relativePath), path);
      } });
    const source = `src/objects/${id}/source`;
    const inputs: unknown[] = await Promise.all(['manifest.json', 'preparation/acquisition.json']
      .map(async path => JSON.parse(await readFile(resolve(project, source, path), 'utf8'))));
    const manifest = requireRecord(inputs[0]), plan = parseAcquisitionPlan(inputs[1]);
    // Verification-only operations compare existing evidence; they create no file.
    const restored = new Set(plan.operations.flatMap(operation => 'path' in operation ? [operation.path] : []));
    for (const value of [...requireArray(manifest.inputs), ...requireArray(manifest.documents), ...requireArray(manifest.generatedIntermediates)]) {
      const entry = requireRecord(value);
      const entryPath = requireString(entry.path);
      // The archive-backed Earth restore runs before acquisition; exercised below.
      if (id === 'earth' && entryPath === 'science/mur-gibs.png') continue;
      const path = `${source}/${entryPath}`;
      if (!tracked.has(path) && !restored.has(entryPath)) missingSources.push(path);
    }
  }
  return { missingSources: missingSources.sort() };
}

test('every registered body has a complete shipped closure with tracked or restorable sources', async () => {
  const { missingSources } = await scanPackages();
  assert.deepEqual(missingSources, [], 'Required source files must be tracked or have an acquisition operation.');
});

test('checkout restores a missing compressed observation without refreshing existing inputs', async t => {
  const root = await fixture(t), source = resolve(root, 'src/objects/titan/source');
  const existing = Buffer.from('existing infrared'), radar = Buffer.from('pinned compressed radar');
  const requests: (string | undefined)[] = [];
  const server = createServer((req, res) => { requests.push(req.url); res.end(radar); });
  await new Promise<void>(accept => server.listen(0, '127.0.0.1', accept));
  t.after(() => new Promise<void>(accept => server.close(() => accept())));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const origin = `http://127.0.0.1:${address.port}`;
  const inputs: readonly (readonly [string, Uint8Array])[] = [['existing.png', existing], ['observation.IMG.gz', radar]];
  const records = inputs.map(([path, bytes]) => ({
    ...pin(path, bytes), id: path, origin: `${origin}/${path}`, sourceBinding: {kind: 'local', reason: 'Authored test fixture'}, consumers: ['surface'],
    credit: 'Fixture', license: 'CC0', acquisition: 'Pinned download', redistribution: 'Allowed',
  }));
  const plan = Buffer.from(JSON.stringify({ schema: 'cssearth-acquisition-plan@1', operations:
    records.map(entry => ({ kind: 'download', groups: ['refresh'], path: entry.path, url: entry.origin })) }));
  await writeFile(resolve(source, 'existing.png'), existing);
  await writeFile(resolve(source, 'preparation/acquisition.json'), plan);
  await json(resolve(source, 'manifest.json'), { schema: 'csstitan-authoritative-sources@2', inputs: records,
    documents: [{ ...pin('preparation/acquisition.json', plan), purpose: 'Acquisition plan' }], generatedIntermediates: [] });
  await run(root, ['tools/assets/restore-source-inputs.mts', '--object=titan']);
  assert.deepEqual(requests, ['/observation.IMG.gz']);
  assert.deepEqual(await readFile(resolve(source, 'observation.IMG.gz')), radar);
  assert.deepEqual(await readFile(resolve(source, 'existing.png')), existing);

  const manifestPath = resolve(source, 'manifest.json');
  const manifestInput: unknown = JSON.parse(await readFile(manifestPath, 'utf8'));
  const manifest = requireRecord(manifestInput), generated = requireArray(manifest.generatedIntermediates);
  generated.push({ ...pin('presentation/context.png', Buffer.from('reviewed context')),
    generator: 'fixture-renderer' });
  await json(manifestPath, manifest);
  await assert.rejects(run(root, ['tools/assets/restore-source-inputs.mts', '--object=titan']),
    /No authored acquisition restores: presentation\/context\.png/);
});

test('repository volume package restores a missing download from the object source mirror', async t => {
  const root = await fixture(t, 'nebula'), bytes = Buffer.from('mirrored repository volume');
  const requests: (string | undefined)[] = [];
  const server = createServer((req, res) => { requests.push(req.url); res.end(bytes); });
  await new Promise<void>(accept => server.listen(0, '127.0.0.1', accept));
  t.after(() => new Promise<void>(accept => server.close(() => accept())));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const origin = `http://127.0.0.1:${address.port}`;
  await writeFile(resolve(root, 'tools/assets/asset-origin.mts'), `export const RUNTIME_ASSET_ORIGIN = ${JSON.stringify(origin)};\n`);
  await json(resolve(root, 'src/objects/nebula/source/manifest.json'), {
    schema: 'cssearth-volume-source-manifest@1', pathBase: 'repository', inputs: [{
      id: 'volume', path: 'src/objects/nebula/source.bin', origin: `${origin}/publisher.bin`,
    }], documents: [{ id: 'preview', path: 'src/objects/nebula/preview.png', origin: `${origin}/preview.png` }], generatedIntermediates: [],
  });
  await json(resolve(root, 'src/objects/nebula/source/presentation.json'), {
    schema: 'cssearth-volume-presentation-source@1',
  });
  await rm(resolve(root, 'site/objects.mts'));
  await run(root, ['tools/assets/restore-source-inputs.mts', '--repository-volumes']);
  assert.deepEqual(requests, ['/source-cache/nebula/src/objects/nebula/source.bin', '/source-cache/nebula/src/objects/nebula/preview.png']);
  assert.deepEqual(await readFile(resolve(root, 'src/objects/nebula/source.bin')), bytes);
  assert.deepEqual(await readFile(resolve(root, 'src/objects/nebula/preview.png')), bytes);

  const kept = Buffer.from('a present file is never replaced');
  await writeFile(resolve(root, 'src/objects/nebula/preview.png'), kept);
  await run(root, ['tools/assets/restore-source-inputs.mts', '--repository-volumes']);
  assert.deepEqual(await readFile(resolve(root, 'src/objects/nebula/preview.png')), kept);
  assert.equal(requests.length, 2, 'a present file is not fetched again');
});

test('Earth restores a missing MUR mosaic before verification and preserves existing files', async t => {
  const root = await fixture(t, 'earth'), source = resolve(root, 'src/objects/earth/source');
  const mosaic = Buffer.from('pinned mosaic'), archive = Buffer.from('pinned archive');
  const restore = resolve(root, 'tools/objects/paged-ellipsoid/mur-imagery.mts');
  for (const dir of ['src/objects/earth/source/science', 'tools/objects/paged-ellipsoid']) {
    await mkdir(resolve(root, dir), { recursive: true });
  }
  await writeFile(restore, `
    import assert from 'node:assert/strict';
    import { writeFile } from 'node:fs/promises';
    import { resolve } from 'node:path';
    assert.equal(process.argv[2], 'restore');
    await writeFile(resolve(process.argv[3], 'mur-gibs.png'), 'pinned mosaic');
  `);
  await writeFile(resolve(source, 'science/mur-gibs-tiles.tar.gz'), archive);
  await json(resolve(source, 'manifest.json'), { schema: 'cssearth-authoritative-sources@2', inputs: [{
    ...pin('science/mur-gibs-tiles.tar.gz', archive), id: 'tiles', origin: 'Fixture archive', sourceBinding: {kind: 'local', reason: 'Authored test fixture'}, consumers: ['enso'],
    credit: 'Fixture', license: 'CC0', acquisition: 'Pinned archive', redistribution: 'Allowed',
  }], generatedIntermediates: [{ ...pin('science/mur-gibs.png', mosaic), generator: 'MUR archive restore' }], documents: [] });
  const args = ['tools/assets/restore-source-inputs.mts', '--object=earth'];
  await run(root, args);
  assert.deepEqual(await readFile(resolve(source, 'science/mur-gibs.png')), mosaic);

  await writeFile(restore, "throw new Error('Existing mosaic must not be restored.');");
  await run(root, args);
  const corrupted = Buffer.from('wrong! mosaic');
  await writeFile(resolve(source, 'science/mur-gibs.png'), corrupted);
  await assert.rejects(run(root, args), /Source hash drifted for science\/mur-gibs\.png/);
  assert.deepEqual(await readFile(resolve(source, 'science/mur-gibs.png')), corrupted);
});

test('manifest refresh keeps runtime and shell images but excludes preparation maps', async t => {
  const root = await fixture(t), prepared = resolve(root, 'src/objects/titan/prepared');
  const url = (name: string): string => `/scenes/titan/${name}.webp`;
  for (const name of ['surface', 'thumbnail', 'chart', 'source-map']) {
    await writeFile(resolve(root, `public/scenes/titan/${name}.webp`), name);
  }
  await json(resolve(prepared, 'runtime.json'), { scene: { image: url('surface') } });
  await json(resolve(prepared, 'controls.json'), { lenses: [{ thumbnailUrl: url('thumbnail') }] });
  await json(resolve(prepared, 'content.json'), { charts: [{ src: url('chart') }] });
  await json(resolve(prepared, 'surfaces.json'), { intermediateMap: url('source-map') });
  await run(root, ['tools/objects/dist/operations.js', 'manifest', 'titan']);
  const manifestInput: unknown = JSON.parse(await readFile(resolve(root, 'src/objects/titan/inventory.json'), 'utf8'));
  const manifest = requireRecord(manifestInput);
  assert.deepEqual(requireArray(manifest.assets).map(asset => requireString(requireRecord(asset).filename)), ['chart.webp', 'surface.webp', 'thumbnail.webp']);
  assert.equal(await readFile(resolve(root, 'public/scenes/titan/source-map.webp'), 'utf8'), 'source-map');
});
