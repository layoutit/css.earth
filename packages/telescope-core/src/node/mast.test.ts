import assert from 'node:assert/strict';
import { it as test, mock } from 'node:test';
import { MAST_CACHE, parseMastObservations, mastDownloadUrl, mastFile, type MastServiceResult } from './mast.js';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { withAcquisitionDirectory } from './acquisition-directory.js';

const row = () => ({ obs_collection: 'HST', obs_id: 'j96o01010', target_name: 'PLUTO', proposal_id: 10427, instrument_name: 'ACS/WFC', filters: 'F606W',
  t_min: 53505.014585613426, t_max: 53505.08066215278 });
const result = (rows: readonly Record<string, unknown>[]): MastServiceResult => ({ astroquery: '0.4.11', queriedAt: '2026-09-19T12:00:00.000Z', rows });

test('public MAST URL keeps the literal URI identity used by saved source records', () => {
  assert.equal(mastDownloadUrl('mast:HST/product/science.fits'), 'https://mast.stsci.edu/api/v0.1/Download/file?uri=mast:HST/product/science.fits');
});

test('exact MAST observations preserve archive identity and observing metadata', () => {
  assert.deepEqual(parseMastObservations('HST', ['j96o01010'], result([row()])), { astroquery: '0.4.11', queriedAt: '2026-09-19T12:00:00.000Z', observations: [{
    id: 'j96o01010', collection: 'HST', archiveTarget: 'PLUTO', programme: '10427', mode: 'ACS/WFC', filter: 'F606W',
    startIso: '2005-05-15T00:21:00.197Z', endIso: '2005-05-15T01:56:09.210Z' }] });
});

test('exact MAST observation lookup refuses incomplete or ambiguous answers', () => {
  assert.throws(() => parseMastObservations('HST', ['j96o01010'], result([])), /did not return requested observation/u);
  assert.throws(() => parseMastObservations('HST', ['j96o01010'], result([row(), row()])), /twice/u);
  assert.throws(() => parseMastObservations('HST', ['j96o01010'], result([{ ...row(), obs_id: 'other' }])), /unrequested observation/u);
  assert.throws(() => parseMastObservations('HST', ['j96o01010'], result([{ ...row(), obs_collection: 'JWST' }])), /requested HST/u);
});

test('MAST copies a size-validated legacy checkout cache into user-owned state without downloading', async () => {
  const { mkdtemp, mkdir, writeFile, readFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { resolve } = await import('node:path');
  const { configureWorkspace, WORKSPACE } = await import('./paths/index.js');
  const { MAST_CACHE, mastFile } = await import('./mast.js');
  const root = await mkdtemp(resolve(tmpdir(), 'legacy-mast-')), previous = WORKSPACE, name = `legacy-mast-${process.pid}`;
  const directory = resolve(MAST_CACHE, name);
  try {
    await mkdir(resolve(root, 'packages/telescope-cli/src'), { recursive: true });
    await mkdir(resolve(root, 'src/objects'), { recursive: true });
    await writeFile(resolve(root, 'package.json'), JSON.stringify({ scripts: { telescope: 'node source' } }));
    await writeFile(resolve(root, 'packages/telescope-cli/src/cli.mts'), '');
    const old = resolve(root, 'output/archive-cache/mast', name); await mkdir(old, { recursive: true });
    await writeFile(resolve(old, 'cached.fits'), 'legacy bytes');
    configureWorkspace(['--workspace', root]);
    const path = await mastFile({ name: 'cached.fits', uri: 'mast:test', bytes: 12 }, directory);
    assert.equal(await readFile(path, 'utf8'), 'legacy bytes');
    await rm(root, { recursive: true, force: true });
    assert.equal(await readFile(path, 'utf8'), 'legacy bytes', 'the writable cache owns its copied bytes');
  } finally {
    configureWorkspace(previous ? ['--workspace', previous] : []);
    await rm(root, { recursive: true, force: true }); await rm(directory, { recursive: true, force: true });
  }
});

test('MAST public transfer keeps the URI and validates recorded bytes before publication', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'mast-transfer-')), urls: string[] = [];
  let body = 'science';
  const fetcher = mock.method(globalThis, 'fetch', async (url: string) => { urls.push(url); return new Response(body); });
  try {
    const file = { name: 'science.fits', uri: 'mast:HST/product/science.fits', bytes: 7 };
    const path = await mastFile(file, directory);
    assert.equal(await readFile(path, 'utf8'), 'science'); assert.equal(new URL(urls[0]!).searchParams.get('uri'), file.uri);
    assert.equal(await mastFile(file, directory), path); assert.equal(urls.length, 1, 'acquired file stays untouched');
    body = 'bad';
    await assert.rejects(mastFile({ ...file, name: 'incomplete.fits' }, directory), /expected 7/u);
    assert.deepEqual(await readdir(directory), ['science.fits']);
  } finally { fetcher.mock.restore(); await rm(directory, { recursive: true, force: true }); }
});

test('MAST refuses a mismatched acquired file instead of replacing it from a transfer or cache', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'mast-acquired-')), source = join(directory, 'cache');
  const file = { name: 'science.fits', uri: 'mast:HST/product/science.fits', bytes: 7 };
  const destination = join(directory, file.name);
  let requests = 0;
  const fetcher = mock.method(globalThis, 'fetch', async () => { requests++; return new Response('science'); });
  try {
    await writeFile(destination, 'acquired bytes');
    await mkdir(source); await writeFile(join(source, file.name), 'science');
    for (const sources of [[], [source]]) {
      await assert.rejects(mastFile(file, directory, sources), /already exists.*14 bytes.*record says 7.*left unchanged/u);
      assert.equal(await readFile(destination, 'utf8'), 'acquired bytes');
    }
    assert.equal(requests, 0, 'refusal happens before a transfer');
  } finally { fetcher.mock.restore(); await rm(directory, { recursive: true, force: true }); }
});

test('MAST self-heals a truncated cache entry and never transfers or replaces a complete one', async () => {
  await mkdir(MAST_CACHE, { recursive: true });
  const directory = await mkdtemp(join(MAST_CACHE, 'truncated-'));
  const file = { name: 'science.fits', uri: 'mast:HST/product/science.fits', bytes: 7 };
  const target = join(directory, file.name);
  const fetcher = mock.method(globalThis, 'fetch', async () => new Response('science'));
  try {
    await writeFile(target, 'sci');
    assert.equal(await mastFile(file, directory), target);
    assert.equal(await readFile(target, 'utf8'), 'science');
    assert.equal(fetcher.mock.callCount(), 1);
    const { stat } = await import('node:fs/promises'), modified = (await stat(target)).mtimeMs;
    assert.equal(await mastFile(file, directory), target);
    assert.equal(fetcher.mock.callCount(), 1);
    assert.equal((await stat(target)).mtimeMs, modified, 'complete cached file stays untouched');
    assert.deepEqual(await readdir(directory), ['science.fits']);
  } finally { fetcher.mock.restore(); await rm(directory, { recursive: true, force: true }); }
});

test('a caller-owned run replaces truncated MAST bytes locally and never creates a shared science copy', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'mast-run-')), target = join(directory, 'science.fits');
  const file = { name: 'science.fits', uri: 'mast:fixture-run', bytes: 7 };
  const before = await readdir(MAST_CACHE, { recursive: true }).catch(() => []);
  const fetcher = mock.method(globalThis, 'fetch', async () => new Response('science', { headers: { 'Content-Length': '7' } }));
  try {
    await writeFile(target, 'sci');
    assert.equal(await withAcquisitionDirectory(directory, () => mastFile(file, MAST_CACHE)), target);
    assert.equal(await readFile(target, 'utf8'), 'science');
    assert.equal(await withAcquisitionDirectory(directory, () => mastFile(file, MAST_CACHE)), target);
    assert.equal(fetcher.mock.callCount(), 1);
    assert.deepEqual(await readdir(directory), ['science.fits']);
    assert.deepEqual(await readdir(MAST_CACHE, { recursive: true }).catch(() => []), before);
  } finally { fetcher.mock.restore(); await rm(directory, { recursive: true, force: true }); }
});
