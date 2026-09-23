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
import { deliverSource, downloadSource, readSavedSource } from './archive-source.mts';
import { fetchGeminiSource } from './gemini-source.mts';
import { fetchChandraSource } from './chandra-source.mts';
import { fetchSpitzerSource } from './spitzer-source.mts';
import { fetchOpusSource, opusNativeFiles } from './opus-source.mts';
import { OPUS_SERVICE } from './opus.mts';
import { openFitsSource } from './fits-source.mts';
import { listArtifactOutputs } from './artifact-outputs.mts';
import { openPdsSource, preparePdsSource } from './pds-source.mts';
import { main, parseCli } from './cli.mts';
import { executeFamilyOperation } from './family-operation.mts';
import { readSourceQuestion } from './source-relevance.mts';

const fits = Buffer.from(`${'SIMPLE  =                    T'.padEnd(80)}${'END'.padEnd(80)}`.padEnd(2880));
const fileResponse = (bytes: Buffer, type = 'application/fits') => new Response(new Uint8Array(bytes), { headers: { 'content-type': type } });

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

test('a multi-file fetch resumes only completed, unchanged bytes for the same saved selection', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'archive-resume-'));
  try {
    const service = 'https://example.org/archive', exploration = await saved(root, service, { id: 'one' }, [{ id: 'one' }], 8192);
    const snapshot = await readSavedSource(exploration, service, 1), first = Buffer.from(fits), second = Buffer.from(fits);
    const selection = { archive: service, telescope: 'Fixture', identity: 'one', target: snapshot.target,
      discovery: snapshot.selected, current: { id: 'one', revision: '1' }, limitations: ['Unqualified fixture.'],
      files: [{ url: 'https://example.org/a.fits', name: 'a.fits', bytes: first.length },
        { url: 'https://example.org/b.fits', name: 'b.fits', bytes: second.length }] };
    const destination = resolve(root, 'source'), calls: string[] = [];
    const failSecond: typeof fetch = async input => {
      calls.push(String(input));
      return String(input).endsWith('b.fits') ? new Response('unavailable', { status: 503 }) : fileResponse(first);
    };
    await assert.rejects(deliverSource(exploration, destination, snapshot, selection, failSecond), /repeat the same fetch with --resume/u);
    assert.deepEqual(calls, selection.files.map(file => file.url));
    assert.deepEqual(await readFile(`${destination}.partial/a.fits`), first);
    await assert.rejects(deliverSource(exploration, destination, snapshot, selection,
      async () => { throw new Error('Should not download.'); }), /Partial transfer exists/u);
    const resumed: typeof fetch = async input => {
      calls.push(String(input));
      if (String(input).endsWith('a.fits')) throw new Error('Completed source was fetched twice.');
      return fileResponse(second);
    };
    const result = await deliverSource(exploration, destination, snapshot, selection, resumed, true);
    assert.equal(calls.length, 3);
    assert.equal(result.status, 'unresolved');
    assert.deepEqual(await readFile(result.files[1]!), second);
    assert.equal(await openFitsSource(result.receipt), null); // Two files have no implicit primary science image.
    await assert.rejects(readFile(`${destination}.partial/transfer-progress.json`), { code: 'ENOENT' });
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('resume refuses changed archive metadata or altered completed bytes', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'archive-resume-changed-'));
  try {
    const service = 'https://example.org/archive', exploration = await saved(root, service, { id: 'one' }, [{ id: 'one' }], 8192);
    const snapshot = await readSavedSource(exploration, service, 1), selection = {
      archive: service, telescope: 'Fixture', identity: 'one', target: snapshot.target, discovery: snapshot.selected,
      current: { revision: '1' }, limitations: [], files: [
        { url: 'https://example.org/a.fits', name: 'a.fits', bytes: fits.length },
        { url: 'https://example.org/b.fits', name: 'b.fits', bytes: fits.length }],
    }, destination = resolve(root, 'source');
    await assert.rejects(deliverSource(exploration, destination, snapshot, selection,
      async input => String(input).endsWith('b.fits') ? new Response('unavailable', { status: 503 }) : fileResponse(fits)));
    await assert.rejects(deliverSource(exploration, destination, snapshot, { ...selection, current: { revision: '2' } },
      async () => { throw new Error('Should not download.'); }, true), /changed archive metadata/u);
    await writeFile(`${destination}.partial/a.fits`, Buffer.from(fits).fill(1, 20, 21));
    await assert.rejects(deliverSource(exploration, destination, snapshot, selection,
      async () => { throw new Error('Should not download.'); }, true), /Completed partial file a\.fits changed/u);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('a Chandra gzip response is pinned as compressed archive bytes', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'archive-gzip-'));
  try {
    const compressed = gzipSync(fits), file = { url: 'https://example.org/a.fits.gz', name: 'a.fits.gz',
      bytes: compressed.length, archiveEncoding: 'gzip' as const };
    const response = async () => new Response(new Uint8Array(compressed), { headers: { 'content-encoding': 'x-gzip', 'content-type': 'image/x-fits' } });
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
    assert.equal((await readSourceQuestion(resolve(root,'out'))).archiveTargetName,'HR8799');
    await assert.rejects(fetchGeminiSource(exploration, 1, resolve(root, 'changed'), async () => [{ ...row, contentChecksum: 'md5:00000000000000000000000000000000' }]), /changed the Gemini source/u);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('OPUS selects a native raw image with its label and support file, rejecting unsafe URL', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'archive-opus-'));
  const opusId = 'co-iss-n1355869401', prefix = 'https://opus.pds-rings.seti.org/holdings/volumes/COISS/';
  const listing = { data: { [opusId]: { coiss_thumb: [`${prefix}thumb.jpg`], coiss_raw: [`${prefix}data/N1.IMG`, `${prefix}data/N1.LBL`, `${prefix}label/prefix.fmt`] } } };
  try {
    assert.equal(opusNativeFiles(listing, opusId, 4).productType, 'coiss_raw');
    assert.throws(() => opusNativeFiles({ data: { [opusId]: { coiss_raw: ['https://evil.example/N1.IMG', `${prefix}data/N1.LBL`] } } }, opusId, 4), /Unsafe OPUS/u);
    const exploration = resolve(root, 'explore.json');
    await writeFile(exploration, `${JSON.stringify({ schema: 'cssearth-telescope-exploration@1', target: 'himalia', answer: {
      target: 'himalia', request: { target: 'himalia', transferLimits: { scienceBytes: 4096, packageMembers: 4 } },
      services: [{ service: OPUS_SERVICE, state: 'sampled', opusTarget: 'Himalia', sharpest: [{ opusId, instrument: 'Cassini ISS' }] }],
    } }, null, 2)}\n`);
    const result = await fetchOpusSource(exploration, 1, resolve(root, 'out'), async () => listing,
      async input => fileResponse(Buffer.from(String(input).endsWith('.LBL')
        ? 'PDS_VERSION_ID = PDS3\n^IMAGE = "N1.IMG"\n^STRUCTURE = "PREFIX.FMT"\nEND\n' : 'native'), 'application/octet-stream'));
    assert.equal(result.files.length, 3); assert.equal(result.status, 'unresolved');
    assert.equal(result.files[0], resolve(root, 'out/holdings/volumes/COISS/data/N1.IMG'));
    assert.match(await readFile(result.source, 'utf8'), /"coiss_raw"/u);
    assert.equal((await readSourceQuestion(resolve(root,'out'))).archiveTargetName,'Himalia');
    assert.equal(await openFitsSource(result.receipt), null);
    const pds = await openPdsSource(result.receipt); assert.ok(pds);
    const staged = await preparePdsSource(pds, resolve(root, 'staged'));
    assert.match(staged.file, /N1\.IMG$/u);
    assert.equal((await readFile(resolve(root, 'staged/holdings/volumes/COISS/data/PREFIX.FMT'))).toString(), 'native');
    assert.notEqual(await readFile(resolve(root, 'staged/holdings/volumes/COISS/data/N1.LBL'), 'utf8'), '');
    await writeFile(result.files[0]!, 'changed');
    await assert.rejects(openPdsSource(result.receipt), /pins changed/u);
    const unsafe = await fetchOpusSource(exploration, 1, resolve(root, 'unsafe'), async () => listing,
      async input => fileResponse(Buffer.from(String(input).endsWith('.LBL')
        ? 'PDS_VERSION_ID = PDS3\n^STRUCTURE = "../../not-pinned.fmt"\nEND\n' : 'native'), 'application/octet-stream'));
    await assert.rejects(preparePdsSource((await openPdsSource(unsafe.receipt))!, resolve(root, 'unsafe-staged')),
      /Unpinned PDS dependency/u);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('Chandra revalidates its ObsID and pins one level-2 event source', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'archive-chandra-'));
  const obsid = 210, name = 'acisf00210N003_evt2.fits';
  const observation: ChandraObservation = { obsid, instrument: 'HRC-S', detector: 'HRC-S', grating: 'NONE', dataMode: 'FAINT',
    targetName: 'Cas A', proposalNumber: '1', sequenceNumber: '1', startDate: '2000-01-01', startMet: 0, stopMet: 1,
    livetimeSeconds: 1, catalogueExposureSeconds: 1, datasetDoi: 'fixture', ascdsVersion: 'fixture', processing: {}, inputs: [],
    products: [{ path: `secondary/${name}`, url: `${obsidDirectory(obsid)}/secondary/${name}`, bytes: fits.length }] };
  try {
    const exploration = await saved(root, CHANDRA_TAP, { obsid, targetName: 'Cas A', instrument: 'HRC-S', grating: 'NONE', startDate: '2000-01-01' },
      [{ obsid, targetName: 'Cas A', instrument: 'HRC-S', grating: 'NONE', startDate: '2000-01-01' }]);
    const query = async () => [{ obsid: String(obsid), target_name: 'Cas A', instrument: 'HRC-S', grating: 'NONE', start_date: '2000-01-01', status: 'archived' }];
    const result = await fetchChandraSource(exploration, 1, resolve(root, 'out'), query, async () => observation, async () => fileResponse(fits));
    assert.equal((await openFitsSource(result.receipt))?.file, result.files[0]);
    const second = { path: `primary/hrcf00210N003_evt2.fits`, url: `${obsidDirectory(obsid)}/primary/hrcf00210N003_evt2.fits`, bytes: fits.length };
    await assert.rejects(fetchChandraSource(exploration, 1, resolve(root, 'ambiguous'), query,
      async () => ({ ...observation, products: [...observation.products, second] })), /--file NAME/u);
    const chosen = await fetchChandraSource(exploration, 1, resolve(root, 'chosen'), query,
      async () => ({ ...observation, products: [...observation.products, second] }), async () => fileResponse(fits), second.path.split('/').at(-1));
    assert.match(chosen.files[0]!, /hrcf00210N003_evt2\.fits$/u);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('an authentic Chandra ACIS event source enters the existing event operations with pinned bytes', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'archive-chandra-events-'));
  const obsid = 6431, name = 'acisf06431N003_evt2.fits.gz';
  const bytes = await readFile(resolve(import.meta.dirname, '../../../tests/fixtures/telescope-families/chandra-events', name));
  const source = { obsid, targetName: 'Polaris', instrument: 'ACIS-S', grating: 'NONE', startDate: '2005-01-01' };
  const observation: ChandraObservation = { ...source, detector: 'ACIS-7', dataMode: 'FAINT', proposalNumber: '1', sequenceNumber: '1',
    startMet: 0, stopMet: 1, livetimeSeconds: 1, catalogueExposureSeconds: 1, datasetDoi: 'fixture', ascdsVersion: 'fixture',
    processing: {}, inputs: [], products: [{ path: `primary/${name}`, url: `${obsidDirectory(obsid)}/primary/${name}`, bytes: bytes.length }] };
  try {
    const exploration = await saved(root, CHANDRA_TAP, source, [source], bytes.length + 1024);
    const query = async () => [{ obsid: String(obsid), target_name: 'Polaris', instrument: 'ACIS-S', grating: 'NONE',
      start_date: '2005-01-01', status: 'archived' }];
    const fetched = await fetchChandraSource(exploration, 1, resolve(root, 'out'), query, async () => observation,
      async () => fileResponse(bytes));
    assert.ok(fetched.descriptor);
    const inspection = await listArtifactOutputs(fetched.receipt);
    assert.ok(inspection.familyOperations?.some(operation => operation.id === 'event-inspect' && operation.available));
    assert.equal(inspection.relevance?.archiveTarget.name,'Polaris');
    assert.equal(inspection.relevance?.field.status,'unknown');
    assert.equal(inspection.relevance?.detection.status,'unassessed');
    assert.ok(inspection.relevance?.contents.some(item=>item.structure.includes('events')));
    const familyDescriptor = JSON.parse(await readFile(fetched.descriptor!, 'utf8'));
    const request = resolve(root, 'request.json'), assessment = resolve(root, 'assessment');
    await writeFile(request, JSON.stringify({ legacy: { target: familyDescriptor.dataset.target, wavelengthMicrometres: [0.1, 1] }, family: 'F10' }));
    const output: string[] = [], errors: string[] = [];
    const io = { stdinIsTTY: false, stdoutIsTTY: false, write: (value: string) => output.push(value), error: (value: string) => errors.push(value),
      question: async () => undefined, close: () => {} };
    assert.ok([0, 3, 4].includes(await main(['family-assess', request, fetched.receipt, '--out', assessment, '--json'],
      root, value => output.push(value), io)));
    const assessed = JSON.parse(await readFile(resolve(assessment, 'family-request.json'), 'utf8'));
    assert.equal(assessed.descriptor.sha256, sha256(await readFile(fetched.descriptor!)));
    const run = await executeFamilyOperation(fetched.descriptor!, { operationId: 'event-inspect' }, resolve(root, 'inspect'));
    assert.equal(JSON.parse(await readFile(run.product, 'utf8')).rows, 62471);
    await writeFile(fetched.files[0]!, 'changed');
    const changedCode = await main(['family-assess', request, fetched.receipt, '--out', resolve(root, 'changed-assessment'), '--json'],
      root, value => output.push(value), io);
    assert.equal(changedCode, 1, output.at(-1) ?? 'No CLI error output');
    assert.match(JSON.parse(output.at(-1)!).error, /pins changed/u);
    await assert.rejects(executeFamilyOperation(fetched.descriptor!, { operationId: 'event-inspect' }, resolve(root, 'changed')), /pins changed/u);
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
    const source = await openFitsSource(result.receipt);
    assert.equal(source?.file, result.files[0]);
    assert.equal((await readSourceQuestion(resolve(root,'out'))).archiveTargetName,'Bennu');
    assert.deepEqual(source?.companions, { uncertainty: result.files[1], coverage: result.files[2] });
    assert.equal(result.files.length, 3);
    const channelTwo = { ...product, channum: '2', externalname: product.externalname.replaceAll('ch1', 'ch2').replaceAll('I1', 'I2'),
      heritagefilename: product.heritagefilename.replaceAll('ch1', 'ch2').replaceAll('I1', 'I2') };
    const several: typeof query = async request => request.id === 'aorByRequestID'
      ? [{ reqkey: String(aorKey), targetname: 'Bennu', modedisplayname: 'IRAC Map' }] : [product, channelTwo];
    await assert.rejects(fetchSpitzerSource(exploration, 1, resolve(root, 'ambiguous'), several), /--file NAME/u);
    const chosen = await fetchSpitzerSource(exploration, 1, resolve(root, 'chosen'), several, async () => fileResponse(fits),
      async url => [url.replace('_maic.fits', '_munc.fits'), url.replace('_maic.fits', '_mcov.fits')],
      channelTwo.externalname.split('/').at(-1));
    assert.match(chosen.files[0]!, /SPITZER_I2_/u);
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

test('the CLI limits exact file selection to archives that can list multiple science files', () => {
  const parsed = parseCli(['fetch', 'explore.json', '--archive', 'spitzer', '--pick', '1', '--file', 'image.fits', '--out', 'source']);
  assert.equal(parsed.command, 'fetch');
  if (parsed.command === 'fetch') assert.equal(parsed.fileName, 'image.fits');
  assert.throws(() => parseCli(['fetch', 'explore.json', '--archive', 'gemini', '--pick', '1', '--file', 'image.fits', '--out', 'source']), /--file applies/u);
  const resume = parseCli(['fetch', 'explore.json', '--archive', 'spitzer', '--pick', '1', '--file', 'image.fits', '--out', 'source', '--resume']);
  assert.equal(resume.command, 'fetch');
  if (resume.command === 'fetch') assert.equal(resume.resume, true);
  assert.throws(() => parseCli(['fetch', 'explore.json', '--archive', 'keck', '--pick', '1', '--out', 'source', '--resume']), /Keck fetch/u);
});
