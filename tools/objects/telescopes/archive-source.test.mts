import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { gzipSync } from 'node:zlib';
import { sha256 } from '../../../src/platform/sha256.mts';
import { CADC_TAP } from '../gemini/cadc.mts';
import { TAP as CHANDRA_TAP, obsidDirectory, type ChandraObservation } from '../chandra/archive.mts';
import { SEARCH as SPITZER_SEARCH } from '../spitzer/archive.mts';
import { downloadSource } from './archive-source.mts';
import { fetchGeminiSource } from './gemini-source.mts';
import { fetchChandraSource } from './chandra-source.mts';
import { fetchSpitzerSource } from './spitzer-source.mts';
import { fetchOpusSource, opusNativeFiles } from './opus-source.mts';
import { OPUS_SERVICE } from './opus.mts';
import { openFitsSource } from './fits-source.mts';
import { listArtifactOutputs } from './artifact-outputs.mts';

const fits = Buffer.from(`${'SIMPLE  =                    T'.padEnd(80)}${'END'.padEnd(80)}`.padEnd(2880));
const fileResponse = (bytes: Buffer, type = 'application/fits') => new Response(bytes, { headers: { 'content-type': type } });

async function saved(root: string, service: string, source: Record<string, unknown>, rows: unknown, maximum = 4096) {
  const evidence = Buffer.from(`${JSON.stringify({ source: service, request: 'fixture', rows }, null, 2)}\n`), pin = sha256(evidence);
  const directory = resolve(root, 'archive-source-evidence'); await mkdir(directory);
  await writeFile(resolve(directory, `${pin}.json`), evidence);
  const exploration = resolve(root, 'explore.json');
  await writeFile(exploration, `${JSON.stringify({ schema: 'cssearth-telescope-exploration@1', target: 'hr-8799',
    answer: { target: 'hr-8799', request: { target: 'hr-8799', transferLimits: { scienceBytes: maximum } },
      services: [{ service, sources: [{ ...source, evidence: pin }] }] } }, null, 2)}\n`);
  return exploration;
}

test('source transfer enforces the cap while streaming and rejects an HTML success page', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'archive-transfer-'));
  try {
    await assert.rejects(downloadSource({ url: 'https://example.org/a.fits', name: 'a.fits' }, resolve(root, 'a.fits'), 3,
      async () => fileResponse(fits)), /transfer bound/u);
    await assert.rejects(downloadSource({ url: 'https://example.org/a.fits', name: 'a.fits' }, resolve(root, 'a.fits'), 4096,
      async () => new Response('<html>error</html>', { headers: { 'content-type': 'text/html' } })), /original file bytes/u);
    const result = await downloadSource({ url: 'https://example.org/a.fits', name: 'a.fits', bytes: fits.length },
      resolve(root, 'a.fits'), 4096, async () => fileResponse(fits));
    assert.equal(result.sha256, sha256(fits));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('a Chandra gzip response is pinned as compressed archive bytes', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'archive-gzip-'));
  try {
    const compressed = gzipSync(fits), file = { url: 'https://example.org/a.fits.gz', name: 'a.fits.gz',
      bytes: compressed.length, archiveEncoding: 'gzip' as const };
    const response = async () => new Response(compressed, { headers: { 'content-encoding': 'x-gzip', 'content-type': 'image/x-fits' } });
    const result = await downloadSource(file, resolve(root, file.name), compressed.length, response);
    assert.equal(result.sha256, sha256(compressed));
    assert.deepEqual(await readFile(resolve(root, file.name)), compressed);
    await assert.rejects(downloadSource({ ...file, name: 'b.fits.gz', archiveEncoding: undefined }, resolve(root, 'b.fits.gz'), 4096,
      response), /original file bytes/u);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('Gemini revalidates one CADC artifact, preserves original FITS and refuses changed MD5', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'archive-gemini-'));
  const row = { observationID: 'GN-1-001', type: 'OBJECT', intent: 'science', instrument_name: 'NIRI', target_name: 'HR8799',
    uri: 'gemini:GEMINI/N20200101S0001.fits', contentLength: String(fits.length), contentChecksum: 'md5:1fb6f27081905bb9d7d49ffae3c8d89a',
    energy_bandpassName: 'K', time_exposure: '30', time_bounds_lower: '58849', dataRelease: '2021-01-01T00:00:00.000' };
  const source = { name: 'N20200101S0001.fits', uri: row.uri, bytes: fits.length, md5: row.contentChecksum.slice(4),
    targetName: 'HR8799', telescope: 'Gemini North', instrument: 'NIRI', observation: row.observationID, dataRelease: row.dataRelease };
  try {
    const exploration = await saved(root, CADC_TAP, source, [row]);
    const result = await fetchGeminiSource(exploration, 1, resolve(root, 'out'), async () => [row], async () => fileResponse(fits));
    assert.equal(result.status, 'unresolved'); assert.deepEqual(await readFile(result.files[0]!), fits);
    assert.equal((await openFitsSource(result.receipt))?.file, result.files[0]);
    await assert.rejects(fetchGeminiSource(exploration, 1, resolve(root, 'changed'), async () => [{ ...row, contentChecksum: 'md5:00000000000000000000000000000000' }]), /changed the Gemini source/u);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('OPUS selects a native raw image with its label and support file, rejecting unsafe URL', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'archive-opus-'));
  const opusId = 'co-iss-n1355869401', prefix = 'https://opus.pds-rings.seti.org/holdings/volumes/COISS/data/';
  const listing = { data: { [opusId]: { coiss_thumb: [`${prefix}thumb.jpg`], coiss_raw: [`${prefix}N1.IMG`, `${prefix}N1.LBL`, `${prefix}prefix.fmt`] } } };
  try {
    assert.equal(opusNativeFiles(listing, opusId, 4).productType, 'coiss_raw');
    assert.throws(() => opusNativeFiles({ data: { [opusId]: { coiss_raw: ['https://evil.example/N1.IMG', `${prefix}N1.LBL`] } } }, opusId, 4), /Unsafe OPUS/u);
    const exploration = resolve(root, 'explore.json');
    await writeFile(exploration, `${JSON.stringify({ schema: 'cssearth-telescope-exploration@1', target: 'himalia', answer: {
      target: 'himalia', request: { target: 'himalia', transferLimits: { scienceBytes: 4096, packageMembers: 4 } },
      services: [{ service: OPUS_SERVICE, state: 'sampled', opusTarget: 'Himalia', sharpest: [{ opusId, instrument: 'Cassini ISS' }] }],
    } }, null, 2)}\n`);
    const result = await fetchOpusSource(exploration, 1, resolve(root, 'out'), async () => listing,
      async input => fileResponse(Buffer.from(String(input).endsWith('.LBL') ? 'PDS_VERSION_ID = PDS3\n' : 'native'), 'application/octet-stream'));
    assert.equal(result.files.length, 3); assert.equal(result.status, 'unresolved');
    assert.equal(result.files[0], resolve(root, 'out/holdings/volumes/COISS/data/N1.IMG'));
    assert.match(await readFile(result.source, 'utf8'), /"coiss_raw"/u);
    assert.equal((await listArtifactOutputs(result.receipt)).terminal, true);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('Chandra revalidates its ObsID and pins one level-2 event source', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'archive-chandra-'));
  const obsid = 210, name = 'acisf00210N003_evt2.fits';
  const observation: ChandraObservation = { obsid, instrument: 'ACIS-S', detector: 'ACIS-7', grating: 'NONE', dataMode: 'FAINT',
    targetName: 'Cas A', proposalNumber: '1', sequenceNumber: '1', startDate: '2000-01-01', startMet: 0, stopMet: 1,
    livetimeSeconds: 1, catalogueExposureSeconds: 1, datasetDoi: 'fixture', ascdsVersion: 'fixture', processing: {}, inputs: [],
    products: [{ path: `secondary/${name}`, url: `${obsidDirectory(obsid)}/secondary/${name}`, bytes: fits.length }] };
  try {
    const exploration = await saved(root, CHANDRA_TAP, { obsid, targetName: 'Cas A', instrument: 'ACIS-S', grating: 'NONE', startDate: '2000-01-01' },
      [{ obsid, targetName: 'Cas A', instrument: 'ACIS-S', grating: 'NONE', startDate: '2000-01-01' }]);
    const query = async () => [{ obsid: String(obsid), target_name: 'Cas A', instrument: 'ACIS-S', grating: 'NONE', start_date: '2000-01-01', status: 'archived' }];
    const result = await fetchChandraSource(exploration, 1, resolve(root, 'out'), query, async () => observation, async () => fileResponse(fits));
    assert.equal((await openFitsSource(result.receipt))?.file, result.files[0]);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('Spitzer revalidates its AOR and pins one named FITS product', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'archive-spitzer-'));
  const aorKey = 21415424, product = { externalname: 'r21415424/ch1/pbcd/SPITZER_I1_21415424_0000_8_A15000000_maic.fits', channum: '1',
    heritagefilename: '/sha/archive/proc/IRAC009700/r21415424/ch1/pbcd/SPITZER_I1_21415424_0000_8_A15000000_maic.fits' };
  try {
    const exploration = await saved(root, SPITZER_SEARCH, { aorKey, targetName: 'Bennu', instrument: 'IRAC', mode: 'IRAC Map', startIso: '2005-01-01T00:00:00.000Z' },
      [{ reqkey: String(aorKey), targetname: 'Bennu', modedisplayname: 'IRAC Map' }], 10000);
    const query: typeof import('../spitzer/archive.mts').shaSearch = async request => request.id === 'aorByRequestID'
      ? [{ reqkey: String(aorKey), targetname: 'Bennu', modedisplayname: 'IRAC Map' }] : [product];
    const result = await fetchSpitzerSource(exploration, 1, resolve(root, 'out'), query, async () => fileResponse(fits), async url =>
      [url.replace('_maic.fits', '_munc.fits'), url.replace('_maic.fits', '_mcov.fits')]);
    assert.equal((await openFitsSource(result.receipt))?.file, result.files[0]);
    assert.equal(result.files.length, 3);
    const fallback: typeof query = async request => request.id === 'aorByRequestID'
      ? [{ reqkey: String(aorKey), targetname: 'Bennu', modedisplayname: 'IRAC Map' }]
      : request.id === 'pbcdByRequestID' ? [{ externalname: 'preview.jpg', heritagefilename: '/sha/archive/preview.jpg' }]
      : [{ ...product, externalname: product.externalname.replace('_maic.fits', '_cbcd.fits'),
        heritagefilename: product.heritagefilename.replace('_maic.fits', '_cbcd.fits') }];
    const basic = await fetchSpitzerSource(exploration, 1, resolve(root, 'basic'), fallback, async () => fileResponse(fits));
    assert.equal(basic.files.length, 1);
    assert.match(basic.files[0]!, /_cbcd\.fits$/u);
  } finally { await rm(root, { recursive: true, force: true }); }
});
