import assert from 'node:assert/strict';
import { it as test } from 'node:test';
import { parseMastObservations, type MastServiceResult } from './mast.js';

const row = () => ({ obs_collection: 'HST', obs_id: 'j96o01010', target_name: 'PLUTO', proposal_id: 10427, instrument_name: 'ACS/WFC', filters: 'F606W',
  t_min: 53505.014585613426, t_max: 53505.08066215278 });
const result = (rows: readonly Record<string, unknown>[]): MastServiceResult => ({ astroquery: '0.4.11', queriedAt: '2026-09-19T12:00:00.000Z', rows });

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
  const { configureWorkspace, WORKSPACE } = await import('./paths.js');
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
