import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { copyFile, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { relative, resolve } from 'node:path';
import test from 'node:test';
import { setupObjectIds } from './runtime-assets.mts';
import { validateObjectPackageFiles } from './object-package-contract.mts';

const project = resolve(import.meta.dirname, '..');
const pin = (path, bytes) => ({ path, expectedBytes: bytes.length,
  expectedSha256: createHash('sha256').update(bytes).digest('hex') });
const json = (path, value) => writeFile(path, JSON.stringify(value));
async function fixture(t, id = 'titan') {
  const root = await mkdtemp(resolve(tmpdir(), 'cssearth-restore-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const dir of ['tools/objects/dist', 'site', `src/planets/${id}/source/preparation`, `src/planets/${id}/prepared`, `public/scenes/${id}`]) {
    await mkdir(resolve(root, dir), { recursive: true });
  }
  await copyFile(resolve(project, 'tools/restore-source-inputs.mts'), resolve(root, 'tools/restore-source-inputs.mts'));
  await copyFile(resolve(project, 'tools/runtime-assets.mts'), resolve(root, 'tools/runtime-assets.mts'));
  await copyFile(resolve(project, 'tools/source-values.mts'), resolve(root, 'tools/source-values.mts'));
  await copyFile(resolve(project, 'tools/objects/dist/operations.js'), resolve(root, 'tools/objects/dist/operations.js'));
  await symlink(resolve(project, 'src/platform'), resolve(root, 'src/platform'));
  await symlink(resolve(project, 'node_modules'), resolve(root, 'node_modules'));
  await writeFile(resolve(root, 'site/objects.mts'), `export const OBJECTS = [{id:'${id}',name:'${id}'}];`);
  await json(resolve(root, `src/planets/${id}/object.json`), { id });
  return root;
}
async function run(root, args) {
  await new Promise((accept, reject) => {
    const child = spawn(process.execPath, args, { cwd: root });
    let output = '';
    child.stdout.on('data', data => output += data);
    child.stderr.on('data', data => output += data);
    child.on('error', reject);
    child.on('close', code => code === 0 ? accept() : reject(new Error(output)));
  });
}

test('every registered body has its package files and tracked or restorable sources', async () => {
  const tracked = new Set(execFileSync('git', ['ls-files', '--cached', '-z'], {
    cwd: project, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
  }).split('\0'));
  const missing = [];
  for (const id of setupObjectIds([])) {
    await validateObjectPackageFiles({ id }, { projectRoot: project,
      accessFile: async path => assert.ok(tracked.has(relative(project, path)), path) });
    const source = `src/planets/${id}/source`;
    const [manifest, plan] = await Promise.all(['manifest.json', 'preparation/acquisition.json']
      .map(async path => JSON.parse(await readFile(resolve(project, source, path), 'utf8'))));
    const restored = new Set(plan.operations.map(operation => operation.path));
    for (const entry of [...manifest.inputs, ...manifest.documents, ...manifest.generatedIntermediates]) {
      // The archive-backed Earth restore runs before acquisition; exercised below.
      if (id === 'earth' && entry.path === 'science/mur-gibs.png') continue;
      const path = `${source}/${entry.path}`;
      if (!tracked.has(path) && !restored.has(entry.path)) missing.push(path);
    }
  }
  assert.deepEqual(missing, [], 'Required source files must be tracked or have an acquisition operation.');
});

test('checkout restores a missing compressed observation without refreshing existing inputs', async t => {
  const root = await fixture(t), source = resolve(root, 'src/planets/titan/source');
  const existing = Buffer.from('existing infrared'), radar = Buffer.from('pinned compressed radar');
  const requests = [];
  const server = createServer((req, res) => { requests.push(req.url); res.end(radar); });
  await new Promise(accept => server.listen(0, '127.0.0.1', accept));
  t.after(() => new Promise(accept => server.close(accept)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const inputs = [['existing.png', existing], ['observation.IMG.gz', radar]].map(([path, bytes]) => ({
    ...pin(path, bytes), id: path, origin: `${origin}/${path}`, sourceBinding: {kind: 'local', reason: 'Authored test fixture'}, consumers: ['surface'],
    credit: 'Fixture', license: 'CC0', acquisition: 'Pinned download', redistribution: 'Allowed',
  }));
  const plan = Buffer.from(JSON.stringify({ schema: 'cssearth-acquisition-plan@1', operations:
    inputs.map(entry => ({ kind: 'download', groups: ['refresh'], path: entry.path, url: entry.origin })) }));
  await writeFile(resolve(source, 'existing.png'), existing);
  await writeFile(resolve(source, 'preparation/acquisition.json'), plan);
  await json(resolve(source, 'manifest.json'), { schema: 'csstitan-authoritative-sources@2', inputs,
    documents: [{ ...pin('preparation/acquisition.json', plan), purpose: 'Acquisition plan' }], generatedIntermediates: [] });
  await run(root, ['tools/restore-source-inputs.mts', '--object=titan']);
  assert.deepEqual(requests, ['/observation.IMG.gz']);
  assert.deepEqual(await readFile(resolve(source, 'observation.IMG.gz')), radar);
  assert.deepEqual(await readFile(resolve(source, 'existing.png')), existing);

  const manifestPath = resolve(source, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  manifest.generatedIntermediates.push({ ...pin('presentation/context.png', Buffer.from('reviewed context')),
    generator: 'fixture-renderer' });
  await json(manifestPath, manifest);
  await assert.rejects(run(root, ['tools/restore-source-inputs.mts', '--object=titan']),
    /No authored acquisition restores: presentation\/context\.png/);
});

test('Earth restores a missing MUR mosaic before verification and preserves existing files', async t => {
  const root = await fixture(t, 'earth'), source = resolve(root, 'src/planets/earth/source');
  const mosaic = Buffer.from('pinned mosaic'), archive = Buffer.from('pinned archive');
  const restore = resolve(root, 'tools/objects/paged-ellipsoid/mur-imagery.mts');
  for (const dir of ['src/planets/earth/source/science', 'tools/objects/paged-ellipsoid', 'tools/objects/geographic-pages/operations']) {
    await mkdir(resolve(root, dir), { recursive: true });
  }
  await writeFile(restore, `
    import assert from 'node:assert/strict';
    import { writeFile } from 'node:fs/promises';
    import { resolve } from 'node:path';
    assert.equal(process.argv[2], 'restore');
    await writeFile(resolve(process.argv[3], 'mur-gibs.png'), 'pinned mosaic');
  `);
  await writeFile(resolve(root, 'tools/objects/geographic-pages/operations/acquire-pinned-global-wmts.mts'), '');
  await writeFile(resolve(source, 'science/mur-gibs-tiles.tar.gz'), archive);
  await json(resolve(source, 'manifest.json'), { schema: 'cssearth-authoritative-sources@2', inputs: [{
    ...pin('science/mur-gibs-tiles.tar.gz', archive), id: 'tiles', origin: 'Fixture archive', sourceBinding: {kind: 'local', reason: 'Authored test fixture'}, consumers: ['enso'],
    credit: 'Fixture', license: 'CC0', acquisition: 'Pinned archive', redistribution: 'Allowed',
  }], generatedIntermediates: [{ ...pin('science/mur-gibs.png', mosaic), generator: 'MUR archive restore' }], documents: [] });
  const args = ['tools/restore-source-inputs.mts', '--object=earth'];
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
  const root = await fixture(t), prepared = resolve(root, 'src/planets/titan/prepared');
  const url = name => `/scenes/titan/${name}.webp`;
  for (const name of ['surface', 'thumbnail', 'chart', 'source-map']) {
    await writeFile(resolve(root, `public/scenes/titan/${name}.webp`), name);
  }
  await json(resolve(prepared, 'runtime.json'), { scene: { image: url('surface') } });
  await json(resolve(prepared, 'controls.json'), { lenses: [{ thumbnailUrl: url('thumbnail') }] });
  await json(resolve(prepared, 'content.json'), { charts: [{ src: url('chart') }] });
  await json(resolve(prepared, 'surfaces.json'), { intermediateMap: url('source-map') });
  await run(root, ['tools/objects/dist/operations.js', 'manifest', 'titan']);
  const manifest = JSON.parse(await readFile(resolve(root, 'src/planets/titan/runtime-assets.json'), 'utf8'));
  assert.deepEqual(manifest.assets.map(asset => asset.filename), ['chart.webp', 'surface.webp', 'thumbnail.webp']);
  assert.equal(await readFile(resolve(root, 'public/scenes/titan/source-map.webp'), 'utf8'), 'source-map');
});
