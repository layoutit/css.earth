import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { sha256 } from '../../../src/platform/sha256.mts';
import { TAP_SYNC } from '../keck/koa.mts';
import { fetchKeckSource } from './keck-source.mts';
import { openFitsSource } from './fits-source.mts';

const koaid = 'N2.20090805.31896.fits';
const row = { koaid, targname: 'HR 8799', koaimtyp: 'object', filehand: `/koadata9/NIRC2/20090805/lev0/${koaid}`, date_obs: '2009-08-05 00:00:00' };
const fits = Buffer.from(`${'SIMPLE  =                    T'.padEnd(80)}${'END'.padEnd(80)}`.padEnd(2880));

async function setup(root: string, sourceRow = row, table = 'koa_nirc2') {
  const archive = resolve(root, 'keck-source-evidence'); await mkdir(archive, { recursive: true });
  const discovery = Buffer.from(`${JSON.stringify({ source: TAP_SYNC, request: 'SELECT TOP 3 ...', rows: [sourceRow] }, null, 2)}\n`);
  const evidence = sha256(discovery); await writeFile(resolve(archive, `${evidence}.json`), discovery);
  const exploration = resolve(root, 'explore.json');
  await writeFile(exploration, `${JSON.stringify({ schema: 'cssearth-telescope-exploration@1', target: 'hr-8799', answer: {
    target: 'hr-8799', request: { target: 'hr-8799', transferLimits: { scienceBytes: 4096 } }, services: [{ service: TAP_SYNC,
      sources: [{ table, instrument: table.slice(4).toUpperCase(), koaid: sourceRow.koaid, targetName: sourceRow.targname,
        filehand: sourceRow.filehand, dateObs: sourceRow.date_obs, evidence }] }] } }, null, 2)}\n`);
  return exploration;
}

test('selected Keck lead revalidates one exact public row, pins source bytes and reaches shared FITS outputs', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'keck-source-'));
  try {
    const exploration = await setup(root), output = resolve(root, 'source');
    const result = await fetchKeckSource(exploration, 1, output, async query => {
      assert.match(query, /WHERE koaid='N2\.20090805\.31896\.fits'/u); return [row];
    }, async (_url, path, _bytes, maxBytes) => { assert.equal(maxBytes, 4096); await writeFile(path, fits); return { bytes: fits.length, sha256: sha256(fits) }; });
    assert.equal(result.status, 'unresolved');
    assert.deepEqual(await readFile(result.file), fits);
    const source = await openFitsSource(result.receipt);
    assert.equal(source?.file, result.file);
    assert.match(source?.limitations.join(' ') ?? '', /raw Keck source file/u);
    assert.match(await readFile(result.source, 'utf8'), /"status": "unresolved"/u);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('Keck source selection uses the sampled instrument table rather than one fixed instrument', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'keck-osiris-'));
  try {
    const other = { ...row, koaid: 'OI.20200101.00001.fits', filehand: '/OSIRIS/2020/20200101/lev0/OI.20200101.00001.fits' };
    const exploration = await setup(root, other, 'koa_osiris');
    const result = await fetchKeckSource(exploration, 1, resolve(root, 'source'), async query => {
      assert.match(query, /FROM koa_osiris WHERE koaid='OI\.20200101\.00001\.fits'/u); return [other];
    }, async (_url, path) => { await writeFile(path, fits); return { bytes: fits.length, sha256: sha256(fits) }; });
    assert.equal(result.file, resolve(root, 'source', other.koaid));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('Keck source refuses changed archive identity, tampered discovery evidence and oversized transfer', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'keck-source-refuse-'));
  try {
    const exploration = await setup(root);
    await assert.rejects(fetchKeckSource(exploration, 1, resolve(root, 'changed'), async () => [{ ...row, filehand: '/other.fits' }]), /changed this source identity/u);
    await assert.rejects(fetchKeckSource(exploration, 1, resolve(root, 'large'), async () => [row], async (_url, path) => {
      await writeFile(path, fits); return { bytes: 4097, sha256: sha256(fits) };
    }), /transfer bound/u);
    const evidence = JSON.parse(await readFile(exploration, 'utf8')).answer.services[0].sources[0].evidence as string;
    await writeFile(resolve(root, 'keck-source-evidence', `${evidence}.json`), '{}');
    await assert.rejects(fetchKeckSource(exploration, 1, resolve(root, 'tampered'), async () => [row]), /pinned discovery response/u);
  } finally { await rm(root, { recursive: true, force: true }); }
});
