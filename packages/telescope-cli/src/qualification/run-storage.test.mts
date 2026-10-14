import { userRootEntries } from '../test-support/index.mts';
import assert from 'node:assert/strict';
import test, { mock } from 'node:test';
import * as child from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { card, imageFixture } from '@cssearth/fits/test-support';
import { USER_ROOT, withAcquisitionDirectory, telescopePythonEnvironment } from '@cssearth/telescope-core/node';
import * as query from '../observation-query/query.mts';
import type { QueryInputs } from '../observation-query/query-contract.mts';
import { loadSourceProducts } from '../products/source-products.mts';
import { SOURCE_PRODUCTS_SCHEMA } from '../products/source-product-contract.mts';
import { loadQualifiedObservations } from './qualified-observations.mts';

const aor = 4416768, id = `fixture-${aor}`, prefix = `SPITZER_I1_${aor}`;
const mosaic = `${prefix}_0000_7_E1_maic.fits`, uncertainty = `${prefix}_0000_7_A2_munc.fits`, coverage = `${prefix}_0000_7_A3_mcov.fits`;
const bcd = `${prefix}_0001_0000_7_bcd.fits`;
const inputs: QueryInputs = { targetCatalogue: [{ id: 'fixture', name: 'Fixture', aliases: [] }], targetAssociations: [], bodyMaps: [],
  capabilities: [{ telescope: 'Spitzer', mode: 'IRAC Map', wavelengthIntervals: [[3.176, 3.926]], apertureMetres: 0.85, pixelScaleArcsec: 1.213, kinds: ['image'], citation: 'https://example.org/irac' }],
  ledgers: [{ telescope: 'spitzer', path: 'src/sources/spitzer/ledger.json', value: { schema: 'cssearth-spitzer-ledger@4', archiveDate: '2026-10-14', searched: ['fixture'],
    modes: [{ mode: 'IRAC Map', tool: 'packages/telescope-cli/src/archives/spitzer/mosaic.mts', programs: [], checked: [], receipts: [] }],
    holdings: [{ object: 'fixture', modes: { 'IRAC Map': 1 }, records: [{ id: String(aor), programme: '68', mode: 'IRAC Map', title: 'Fixture', startIso: '2003-12-20T00:00:00Z', endIso: '2003-12-21T00:00:00Z' }] }] } }] };
mock.module('../observation-query/query.mts', { namedExports: { ...query, loadQueryInputs: async (root: string) => ({ ...inputs, sourceProducts: await loadSourceProducts(root, 'fixture') }) } });
mock.module('../archives/spitzer/toolchain.mts', { namedExports: {
  spitzerToolchain: async () => ({ python: process.execPath, env: telescopePythonEnvironment() }),
  spitzerSoftware: async () => [{ name: 'fixture reducer', version: '1' }],
} });
let reductions = 0;
mock.module('node:child_process', { namedExports: { ...child,
  spawn: (command: string, args: readonly string[], options: child.SpawnOptions) => {
    if (!args[0]?.endsWith('/spitzer/mosaic.py')) return child.spawn(command, args, options);
    reductions++;
    return child.spawn(process.execPath, [resolve(import.meta.dirname, 'spitzer-mosaic.test-support.mts'), args[1]!], options);
  },
} });
const { qualifyObservation } = await import('./qualify.mts');
const { defaultDataRoot } = await import('../archives/spitzer/archive.mts');
const { defaultWorkRoot } = await import('../archives/spitzer/mosaic.mts');
const sha = (row: Record<string, string>) => JSON.stringify({ tableData: { columns: Object.keys(row).map(name => ({ name })), data: [Object.values(row)] } });
const header = [['AORKEY', String(aor)], ['CHNLNUM', '1'], ['INSTRUME', "'IRAC'"], ['CRVAL1', '10'], ['CRVAL2', '20'], ['PXSCAL2', '0.6'],
  ['FRAMTIME', '30'], ['EXPTIME', '26.8'], ['DATE_OBS', "'2003-12-20T21:25:17'"], ['BUNIT', "'MJy/sr'"], ['CREATOR', "'fixture'"],
  ['CTYPE1', "'RA---TAN'"], ['CTYPE2', "'DEC--TAN'"], ['CRPIX1', '1'], ['CRPIX2', '1'], ['CDELT1', '-0.0001666667'], ['CDELT2', '0.0001666667']].map(([key, value]) => card(key!, value!));
const bytes = imageFixture(-32, [1, 2, 3, 4], header);

test('real Spitzer qualifier routes fixture transport, reducer, comparison and qualification entirely into the run', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'spitzer-run-wiring-')), run = resolve(root, 'run');
  const before = await userRootEntries();
  let downloads = 0;
  const fetcher = mock.method(globalThis, 'fetch', async (url: string | URL | Request) => {
    const address = new URL(typeof url === 'string' ? url : url instanceof URL ? url.href : url.url);
    if (address.searchParams.has('request')) {
      const request = JSON.parse(address.searchParams.get('request')!);
      if (request.id === 'aorByRequestID') return new Response(sha({ modedisplayname: 'IRAC Map', progid: '68', pi: 'Fixture', targetname: 'Fixture', raj2000: '10', decj2000: '20', reqbegintime: '2003-12-20', reqendtime: '2003-12-21' }));
      if (request.id === 'pbcdByRequestID') return new Response(sha({ externalname: mosaic, wavelength: 'IRAC 3.6um', channum: '1', heritagefilename: `/sha/archive/proc/IRAC003600/r${aor}/ch1/pbcd/${mosaic}`, naxis1: '2', naxis2: '2', crval1: '10', crval2: '20' }));
      if (request.id === 'bcdByRequestID') return new Response(sha({ externalname: bcd, channum: '1', heritagefilename: `/sha/archive/proc/IRAC003600/r${aor}/ch1/bcd/${bcd}` }));
      throw new Error(`Unexpected archive request ${request.id}`);
    }
    assert.equal(address.hostname, 'irsa.ipac.caltech.edu');
    if (address.pathname.endsWith('/')) return new Response([uncertainty, coverage].map(name => `<a href="${name}">${name}</a>`).join('\n'));
    assert.ok(address.pathname.endsWith('.fits')); downloads++;
    return new Response(bytes, { headers: { 'Content-Length': String(bytes.length) } });
  });
  try {
    assert.equal(defaultDataRoot, resolve(USER_ROOT, 'output/spitzer')); assert.equal(defaultWorkRoot, defaultDataRoot, 'Unscoped library defaults stay central');
    const result = await withAcquisitionDirectory(run, () => qualifyObservation(root, { target: 'fixture', telescope: 'Spitzer', mode: 'IRAC Map', observation: String(aor), configuration: { kind: 'spitzer-irac-channel', channel: 1 } }));
    assert.equal(downloads, 6); assert.equal(reductions, 1);
    assert.equal(result.product, resolve(run, 'spitzer', id, `${id}.ch1.remosaic.fits`));
    assert.deepEqual(await readFile(result.product), bytes);
    assert.ok(result.receipt.startsWith(run + '/'));
    const [qualified] = await withAcquisitionDirectory(run, () => loadQualifiedObservations(root, 'fixture'));
    assert.ok(qualified); assert.equal(qualified.facts.verified, true);
    const files = await readdir(run, { recursive: true });
    assert.ok(files.includes(`programs/spitzer/${id}.json`));
    assert.ok(files.some(path => path.endsWith('remosaic.reproduction.json')));
    assert.deepEqual(await userRootEntries(), before, 'No science files or generated records in the user root');
    assert.deepEqual(await readdir(root), ['run'], 'No workspace output or ledger writes');
    assert.ok((await realpath(result.product)).startsWith(await realpath(run)));
  } finally { fetcher.mock.restore(); await rm(root, { recursive: true, force: true }); }
});

test('CLI source qualification copies local inputs and generated records to its run without changing library defaults', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'source-run-wiring-')), run = resolve(root, 'run'), source = resolve(root, 'src/objects/fixture/source');
  await mkdir(source, { recursive: true });
  const initialUser = await userRootEntries();
  try {
    await writeFile(resolve(source, 'image.fits'), bytes);
    await writeFile(resolve(source, 'manifest.json'), JSON.stringify({ inputs: [{ id: 'science', path: 'image.fits', origin: 'https://example.org/image.fits' }] }));
    await writeFile(resolve(source, 'observations.json'), JSON.stringify({ schema: SOURCE_PRODUCTS_SCHEMA, target: 'fixture', observations: [{ id: 'source-image', telescope: 'Spitzer', mode: 'IRAC Map', kind: 'image', archiveProductId: 'fixture-image', decoder: 'fits-image', inputs: [{ input: 'science', role: 'science' }], identity: { AORKEY: aor }, units: 'MJy/sr', meaning: 'Fixture intensity', citation: 'https://example.org/image.fits', limitations: [] }] }));
    const result = await withAcquisitionDirectory(run, () => qualifyObservation(root, { target: 'fixture', telescope: 'Spitzer', mode: 'IRAC Map', observation: 'source-image', configuration: { kind: 'source-product', id: 'source-image' } }));
    assert.equal(result.product, resolve(run, 'src/objects/fixture/source/image.fits'));
    assert.ok(result.receipt.startsWith(run + '/')); assert.deepEqual(await readFile(result.product), bytes);
    const [qualified] = await withAcquisitionDirectory(run, () => loadQualifiedObservations(root, 'fixture'));
    assert.ok(qualified); assert.equal(qualified.facts.verified, true);
    assert.deepEqual(await readdir(root), ['run', 'src']);
    assert.deepEqual((await readdir(source)).sort(), ['image.fits', 'manifest.json', 'observations.json']);
    assert.deepEqual(await userRootEntries(), initialUser);
  } finally { await rm(root, { recursive: true, force: true }); }
});
