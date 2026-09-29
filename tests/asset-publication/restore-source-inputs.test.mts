import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { copyFile, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { relative, resolve } from 'node:path';
import test, { type TestContext } from 'node:test';
import { validateObjectPackageFiles } from '../../site/build/object-package-contract.mts';
import { requireArray, requireRecord, requireString } from '@cssearth/core';
import { parseAcquisitionPlan } from '@cssearth/bake/objects/acquisition';
import { sourceFormatProblem } from '@cssearth/bake/objects/sources';
import { requireInventory } from '@cssearth/objects/node';
import { readPreparedObjects } from '@cssearth/objects/node';

const SCENE_OBJECTS = readPreparedObjects(resolve(import.meta.dirname, '../..')).sceneObjects;

const project = resolve(import.meta.dirname, '../..');
const pin = (path: string, _bytes: Uint8Array) => ({ path });
const json = (path: string, value: unknown): Promise<void> => writeFile(path, JSON.stringify(value));
async function fixture(t: TestContext, id = 'titan'): Promise<string> {
  const root = await mkdtemp(resolve(tmpdir(), 'cssearth-restore-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const dir of ['packages/bake/cli', 'site', `src/objects/${id}/source/preparation`, `src/objects/${id}/prepared`, `public/scenes/${id}`]) {
    await mkdir(resolve(root, dir), { recursive: true });
  }
  await writeRestore(root);
  await copyFile(resolve(project, 'packages/bake/cli/object-operations.mts'), resolve(root, 'packages/bake/cli/object-operations.mts'));
  await symlink(resolve(project, 'src/platform'), resolve(root, 'src/platform'));
  await symlink(resolve(project, 'node_modules'), resolve(root, 'node_modules'));
  await writeFile(resolve(root, 'site/objects.mts'), `export const OBJECTS = [{id:'${id}',name:'${id}'}];\nexport const SCENE_OBJECTS = OBJECTS;`);
  await json(resolve(root, `src/objects/${id}/object.json`), { id });
  return root;
}
/** The restore command of this fixture checkout: `restoreSourceInputs` for the checkout it runs in, reading the source mirror
 * at `assetOrigin` (the asset host when it is left out; a test points it at a local server). */
const RESTORE = 'restore-source-inputs.mts';
async function writeRestore(root: string, assetOrigin?: string): Promise<void> {
  await writeFile(resolve(root, RESTORE), `import { restoreSourceInputs } from '@cssearth/bake/asset-publication';\n` +
    `await restoreSourceInputs(process.argv.slice(2), { root: process.cwd()${assetOrigin === undefined ? '' : `, assetOrigin: ${JSON.stringify(assetOrigin)}`} });\n`);
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
  await json(resolve(source, 'manifest.json'), { schema: 'cssearth-authoritative-sources@2', inputs: records,
    documents: [{ ...pin('preparation/acquisition.json', plan), purpose: 'Acquisition plan' }], generatedIntermediates: [] });
  await run(root, [RESTORE, '--object=titan']);
  assert.deepEqual(requests, ['/observation.IMG.gz']);
  assert.deepEqual(await readFile(resolve(source, 'observation.IMG.gz')), radar);
  assert.deepEqual(await readFile(resolve(source, 'existing.png')), existing);

  const manifestPath = resolve(source, 'manifest.json');
  const manifestInput: unknown = JSON.parse(await readFile(manifestPath, 'utf8'));
  const manifest = requireRecord(manifestInput), generated = requireArray(manifest.generatedIntermediates);
  generated.push({ ...pin('presentation/context.png', Buffer.from('reviewed context')),
    generator: 'fixture-renderer' });
  await json(manifestPath, manifest);
  // A generated intermediate is not downloaded: absent from the source mirror, restore names the command that makes it.
  await assert.rejects(run(root, [RESTORE, '--object=titan']),
    /generated sources are missing[\s\S]*presentation\/context\.png: run node fixture-renderer/u);
});

test('repository volume package restores a missing download from the object source mirror', async t => {
  const root = await fixture(t, 'nebula'), bytes = Buffer.from('\x89PNG\r\n\x1a\nmirrored repository volume', 'latin1');
  const requests: (string | undefined)[] = [];
  const server = createServer((req, res) => { requests.push(req.url); res.end(bytes); });
  await new Promise<void>(accept => server.listen(0, '127.0.0.1', accept));
  t.after(() => new Promise<void>(accept => server.close(() => accept())));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const origin = `http://127.0.0.1:${address.port}`;
  await writeRestore(root, origin);
  await json(resolve(root, 'src/objects/nebula/source/manifest.json'), {
    schema: 'cssearth-volume-source-manifest@1', pathBase: 'repository', inputs: [{
      id: 'volume', path: 'src/objects/nebula/source.bin', origin: `${origin}/publisher.bin`,
    }], documents: [{ id: 'preview', path: 'src/objects/nebula/preview.png', origin: `${origin}/preview.png` }], generatedIntermediates: [],
  });
  await json(resolve(root, 'src/objects/nebula/source/presentation.json'), {
    schema: 'cssearth-volume-presentation-source@1',
  });
  await rm(resolve(root, 'site/objects.mts'));
  await run(root, [RESTORE, '--repository-volumes']);
  assert.deepEqual(requests, ['/source-cache/nebula/src/objects/nebula/source.bin', '/source-cache/nebula/src/objects/nebula/preview.png']);
  assert.deepEqual(await readFile(resolve(root, 'src/objects/nebula/source.bin')), bytes);
  assert.deepEqual(await readFile(resolve(root, 'src/objects/nebula/preview.png')), bytes);

  const kept = Buffer.from('\x89PNG\r\n\x1a\na present file is never replaced', 'latin1');
  await writeFile(resolve(root, 'src/objects/nebula/preview.png'), kept);
  await run(root, [RESTORE, '--repository-volumes']);
  assert.deepEqual(await readFile(resolve(root, 'src/objects/nebula/preview.png')), kept);
  assert.equal(requests.length, 2, 'a present file is not fetched again');
});

test('repository volume restore refuses a publisher page and takes a built input only from the source mirror', async t => {
  const root = await fixture(t, 'galaxy'), jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
  const page = Buffer.from('<!DOCTYPE html>\n<html lang="en"><head><title>Panorama of Spiral Galaxy</title></head></html>');
  // The mirror holds only what the test puts there; every other URL is a publisher page answering 200 with HTML.
  const mirror = new Map<string, Buffer>(), requests: (string | undefined)[] = [];
  const server = createServer((req, res) => {
    requests.push(req.url);
    const held = req.url === undefined ? undefined : mirror.get(req.url);
    if (req.url?.startsWith('/source-cache/') && !held) { res.writeHead(404); res.end('Not Found'); return; }
    res.writeHead(200, { 'content-type': held ? 'image/jpeg' : 'text/html' }); res.end(held ?? page);
  });
  await new Promise<void>(accept => server.listen(0, '127.0.0.1', accept));
  t.after(() => new Promise<void>(accept => server.close(() => accept())));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const origin = `http://127.0.0.1:${address.port}`;
  await writeRestore(root, origin);
  const composite = 'src/objects/galaxy/source/optical-composite.jpg', generator = 'packages/bake/authoring/galaxy/compose-optical.mts';
  const manifest = (input: Record<string, unknown>) => json(resolve(root, 'src/objects/galaxy/source/manifest.json'), {
    schema: 'cssearth-volume-source-manifest@1', pathBase: 'repository', documents: [], generatedIntermediates: [],
    inputs: [{ id: 'optical', path: composite, origin: `${origin}/public/images/panorama/`, ...input }],
  });
  await json(resolve(root, 'src/objects/galaxy/source/presentation.json'), { schema: 'cssearth-volume-presentation-source@1' });
  await rm(resolve(root, 'site/objects.mts'));

  // A download whose origin turns out to be a page: both the mirror miss and the HTML body are named, and nothing is written.
  await manifest({});
  await assert.rejects(run(root, [RESTORE, '--repository-volumes']), (error: Error) => {
    assert.match(error.message, /galaxy: src\/objects\/galaxy\/source\/optical-composite\.jpg \(source\/manifest\.json inputs, id "optical"\) could not be restored/u);
    assert.match(error.message, /HTTP 404/u);
    assert.match(error.message, /Field "origin" = "http:\/\/127\.0\.0\.1:\d+\/public\/images\/panorama\/" returned an HTML document \(\d+ bytes\), not a JPEG image/u);
    return true;
  });
  await assert.rejects(readFile(resolve(root, composite)), { code: 'ENOENT' });

  // A built input never falls back to its origin: the mirror miss names the object, file, field and value.
  await manifest({ generator });
  requests.length = 0;
  await assert.rejects(run(root, [RESTORE, '--repository-volumes']), (error: Error) => {
    assert.match(error.message, /galaxy: src\/objects\/galaxy\/source\/optical-composite\.jpg \(source\/manifest\.json inputs, id "optical"\) is built by field "generator" = "packages\/bake\/authoring\/galaxy\/compose-optical\.mts"/u);
    assert.match(error.message, /Run node packages\/bake\/authoring\/galaxy\/compose-optical\.mts/u);
    return true;
  });
  assert.ok(requests.length > 0 && requests.every(url => url === `/source-cache/galaxy/${composite}`), `only the mirror is asked: ${requests.join(', ')}`);
  await assert.rejects(readFile(resolve(root, composite)), { code: 'ENOENT' });

  // Once the mirror holds the composite, it is restored from there.
  mirror.set(`/source-cache/galaxy/${composite}`, jpeg);
  await run(root, [RESTORE, '--repository-volumes']);
  assert.deepEqual(await readFile(resolve(root, composite)), jpeg);

  // A page already saved under the image name is refused, not passed on to the bake, and not replaced.
  await writeFile(resolve(root, composite), page);
  await assert.rejects(run(root, [RESTORE, '--repository-volumes']),
    /optical-composite\.jpg \(source\/manifest\.json inputs, id "optical"\) holds an HTML document \(\d+ bytes\), not a JPEG image\. Delete it and restore again\./u);
  assert.deepEqual(await readFile(resolve(root, composite)), page);
});

test('source format check matches each image and archive extension and refuses pages and text', () => {
  const html = Buffer.from('\ufeff  <!doctype html><html></html>');
  const cases: readonly (readonly [string, Buffer, string | null])[] = [
    ['a.jpg', Buffer.from([0xff, 0xd8, 0xff, 0xdb]), null],
    ['a.JPEG', html, 'an HTML document (33 bytes), not a JPEG image'],
    ['a.png', Buffer.from('\x89PNG\r\n\x1a\n', 'latin1'), null],
    ['a.png', Buffer.from([0xff, 0xd8, 0xff, 0xdb]), 'a JPEG image (4 bytes), not a PNG image'],
    ['a.webp', Buffer.from('RIFF\x10\0\0\0WEBPVP8 ', 'latin1'), null],
    ['a.webp', Buffer.from('RIFF\x10\0\0\0WAVEfmt ', 'latin1'), 'unrecognised bytes starting 5249464610000000 (16 bytes), not a WebP image'],
    ['a.tif', Buffer.from('II*\0', 'latin1'), null],
    ['a.tiff', Buffer.from('MM\0*', 'latin1'), null],
    ['a.tif', Buffer.from('Not Found'), 'a text body (9 bytes), not a TIFF image'],
    ['a.fits', Buffer.from('SIMPLE  =                    T'), null],
    ['a.fits', Buffer.alloc(0), 'an empty file, not a FITS file'],
    ['a.fits.gz', Buffer.from([0x1f, 0x8b, 0x08]), null],
    ['a.fits.gz', Buffer.from('SIMPLE  =                    T'), 'a FITS file (30 bytes), not a gzip stream'],
    ['table.dat', Buffer.from('  1 00 42 30.1 +41 16 09\n'), null],
    ['record.json', html, 'an HTML document (33 bytes), not a data file'],
    ['page.html', html, null],
  ];
  for (const [path, bytes, problem] of cases) assert.equal(sourceFormatProblem(path, bytes), problem, path);
});

test('Earth restores a missing MUR mosaic before verification and preserves existing files', async t => {
  const root = await fixture(t, 'earth'), source = resolve(root, 'src/objects/earth/source');
  const mosaic = Buffer.from('pinned mosaic'), archive = Buffer.from('pinned archive');
  const restore = resolve(root, 'packages/bake/authoring/earth/mur-imagery.mts');
  for (const dir of ['src/objects/earth/source/science', 'packages/bake/authoring/earth']) {
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
  const args = [RESTORE, '--object=earth'];
  await run(root, args);
  assert.deepEqual(await readFile(resolve(source, 'science/mur-gibs.png')), mosaic);

  await writeFile(restore, "throw new Error('Existing mosaic must not be restored.');");
  await run(root, args);
  const corrupted = Buffer.from('wrong! mosaic');
  await writeFile(resolve(source, 'science/mur-gibs.png'), corrupted);
  await run(root, args);
  assert.deepEqual(await readFile(resolve(source, 'science/mur-gibs.png')), corrupted, 'a present file is never replaced');
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
  await run(root, ['packages/bake/cli/object-operations.mts', 'manifest', 'titan']);
  const manifestInput: unknown = JSON.parse(await readFile(resolve(root, 'src/objects/titan/inventory.json'), 'utf8'));
  const manifest = requireRecord(manifestInput);
  assert.deepEqual(requireArray(manifest.assets).map(asset => requireString(requireRecord(asset).filename)), ['chart.webp', 'surface.webp', 'thumbnail.webp']);
  assert.equal(await readFile(resolve(root, 'public/scenes/titan/source-map.webp'), 'utf8'), 'source-map');
});
