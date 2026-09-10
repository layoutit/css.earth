import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { copyFile, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';

const project = resolve(import.meta.dirname, '..');
const pin = (path, bytes) => ({ path, expectedBytes: bytes.length,
  expectedSha256: createHash('sha256').update(bytes).digest('hex') });
const json = (path, value) => writeFile(path, JSON.stringify(value));
async function fixture(t) {
  const root = await mkdtemp(resolve(tmpdir(), 'cssearth-restore-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const dir of ['tools/objects/dist', 'site', 'src/planets/titan/source/preparation', 'src/planets/titan/prepared', 'public/scenes/titan']) {
    await mkdir(resolve(root, dir), { recursive: true });
  }
  await copyFile(resolve(project, 'tools/restore-source-inputs.mts'), resolve(root, 'tools/restore-source-inputs.mts'));
  await copyFile(resolve(project, 'tools/runtime-assets.mts'), resolve(root, 'tools/runtime-assets.mts'));
  await copyFile(resolve(project, 'tools/objects/dist/operations.js'), resolve(root, 'tools/objects/dist/operations.js'));
  await symlink(resolve(project, 'src/platform'), resolve(root, 'src/platform'));
  await symlink(resolve(project, 'node_modules'), resolve(root, 'node_modules'));
  await writeFile(resolve(root, 'site/objects.mts'), "export const OBJECTS = [{id:'titan',name:'Titan'}];");
  await json(resolve(root, 'src/planets/titan/object.json'), { id: 'titan' });
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

test('checkout restores a missing compressed observation without refreshing existing inputs', async t => {
  const root = await fixture(t), source = resolve(root, 'src/planets/titan/source');
  const existing = Buffer.from('existing infrared'), radar = Buffer.from('pinned compressed radar');
  const requests = [];
  const server = createServer((req, res) => { requests.push(req.url); res.end(radar); });
  await new Promise(accept => server.listen(0, '127.0.0.1', accept));
  t.after(() => new Promise(accept => server.close(accept)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const inputs = [['existing.png', existing], ['observation.IMG.gz', radar]].map(([path, bytes]) => ({
    ...pin(path, bytes), id: path, origin: `${origin}/${path}`, consumers: ['surface'],
    credit: 'Fixture', license: 'CC0', acquisition: 'Pinned download', redistribution: 'Allowed',
  }));
  const plan = Buffer.from(JSON.stringify({ schema: 'cssearth-acquisition-plan@1', operations:
    inputs.map(entry => ({ kind: 'download', groups: ['refresh'], path: entry.path, url: entry.origin })) }));
  await writeFile(resolve(source, 'existing.png'), existing);
  await writeFile(resolve(source, 'preparation/acquisition.json'), plan);
  await json(resolve(source, 'manifest.json'), { schema: 'csstitan-authoritative-sources@1', inputs,
    documents: [{ ...pin('preparation/acquisition.json', plan), purpose: 'Acquisition plan' }], generatedIntermediates: [] });
  await run(root, ['tools/restore-source-inputs.mts', '--object=titan']);
  assert.deepEqual(requests, ['/observation.IMG.gz']);
  assert.deepEqual(await readFile(resolve(source, 'observation.IMG.gz')), radar);
  assert.deepEqual(await readFile(resolve(source, 'existing.png')), existing);
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
