import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { requireRecord, requireString } from '@cssearth/core';
import { fetchPreview } from './fetch.mts';
import { ALMA_BYTES, ESO_BYTES, HST_BYTES, type PreviewSource } from './types.mts';
import { continuum, cube, esoSpectrum, hstSpectrum, image } from './test-support.mts';

const eso: PreviewSource = { pick: 33, observation: 'eso-id', kind: 'eso', url: 'https://dataportal.eso.org/dataPortal/file/ADP.test', product: 'spectrum', instrument: 'UVES' };
const hst: PreviewSource = { pick: 47, observation: 'hst-id', kind: 'hst', obsId: 'o4de03010' };
const alma: Extract<PreviewSource, { kind: 'alma' }> = { pick: 9, observation: 'alma-id', kind: 'alma', member: 'uid://A001/X1465/X1a15', target: 'Betelgeuse', spw: 23, ra: 88.7931, dec: 7.4071 };
const bytesResponse = (bytes: Uint8Array, headers?: HeadersInit) => new Response(new Uint8Array(bytes), { headers });
async function withRun(run: (runDir: string) => Promise<void>) {
  const runDir = await mkdtemp(resolve(tmpdir(), 'preview-fetch-'));
  try { await run(runDir); } finally { await rm(runDir, { recursive: true, force: true }); }
}

test('ESO stores extracted data only and revisits the same pick entirely offline', async () => withRun(async runDir => {
  let calls = 0;
  const first = await fetchPreview(eso, { runDir, fetch: async (input, init) => {
    calls++; assert.equal(String(input), eso.kind === 'eso' ? eso.url : ''); assert.equal(init?.redirect, 'manual'); return bytesResponse(esoSpectrum());
  } });
  const offline: typeof fetch = async () => { throw new Error('Network must not run.'); };
  assert.deepEqual(await fetchPreview(eso, { runDir, fetch: offline }), first); assert.equal(calls, 1);
  assert.deepEqual(await readdir(runDir), ['previews']); assert.deepEqual(await readdir(resolve(runDir, 'previews')), ['33.json']);
  const saved = requireRecord(JSON.parse(await readFile(resolve(runDir, 'previews/33.json'), 'utf8')));
  assert.equal(requireRecord(saved.data).kind, 'spectrum'); assert.ok(!('lines' in requireRecord(saved.data)));
  await assert.rejects(fetchPreview({ ...eso, observation: 'different-id' }, { runDir, fetch: offline }), /Network must not run/u);
  await writeFile(resolve(runDir, 'previews/33.json'), '{broken');
  assert.equal((await fetchPreview(eso, { runDir, fetch: async () => bytesResponse(esoSpectrum()) })).kind, 'spectrum');
}));

function mastFetch(products: readonly Record<string, unknown>[], seen: string[]): typeof fetch {
  return async (input, init) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith('/invoke')) {
      const request = requireRecord(JSON.parse(requireString(new URLSearchParams(String(init?.body)).get('request'))));
      seen.push(requireString(request.service));
      if (request.service === 'Mast.Caom.Filtered') return Response.json({ status: 'COMPLETE', data: [{ obsid: 123, obs_id: 'o4de03010' }] });
      assert.deepEqual(request.params, { obsid: '123' }); return Response.json({ status: 'COMPLETE', data: products });
    }
    seen.push(url.searchParams.get('uri') ?? ''); return bytesResponse(hstSpectrum());
  };
}
const hstProduct = { productFilename: 'o4de03010_sx1.fits', size: 80640, dataURI: 'mast:HST/product/o4de03010_sx1.fits' };

test('HST resolves the observation through CAOM and fetches only its small 1-D spectrum', async () => withRun(async runDir => {
  const seen: string[] = [];
  const data = await fetchPreview(hst, { runDir, fetch: mastFetch([
    { ...hstProduct, productFilename: 'other_sx1.fits' }, { ...hstProduct, size: HST_BYTES + 1 },
    { ...hstProduct, productFilename: 'o4de03010_asn.fits' }, hstProduct,
  ], seen) });
  assert.equal(data.kind, 'spectrum');
  assert.deepEqual(seen, ['Mast.Caom.Filtered', 'Mast.Caom.Products', 'mast:HST/product/o4de03010_sx1.fits']);
  assert.deepEqual(await fetchPreview(hst, { runDir, fetch: async () => { throw new Error('Network must not run.'); } }), data);
}));

test('HST without a small x1d/sx1 yields no preview and caches the negative answer', async () => withRun(async runDir => {
  const seen: string[] = [], data = await fetchPreview(hst, { runDir, fetch: mastFetch([
    { ...hstProduct, size: HST_BYTES + 1 }, { ...hstProduct, dataURI: 'mast:HST/product/other_sx1.fits' },
  ], seen) });
  assert.equal(data.kind, 'none'); assert.equal(seen.length, 2);
  assert.deepEqual(await fetchPreview(hst, { runDir, fetch: async () => { throw new Error('offline'); } }), data);
  await rm(resolve(runDir, 'previews/47.json'));
  assert.deepEqual(await fetchPreview(hst, { runDir, fetch: async () => { throw new Error('Negative source must be cached.'); } }), data);
  await assert.rejects(fetchPreview({ ...hst, observation: 'changed-exploration' }, { runDir, fetch: async () => { throw new Error('Changed pick must resolve again.'); } }), /must resolve again/u);
}));

test('HST keeps its resolved product across a failed FITS fetch and invalidates it with pick identity', async () => withRun(async runDir => {
  const seen: string[] = [], fetcher = mastFetch([hstProduct], seen);
  await assert.rejects(fetchPreview(hst, { runDir, fetch: async (input, init) => {
    if (String(input).includes('/invoke')) return fetcher(input, init);
    return new Response(null, { status: 503 });
  } }), /HTTP 503/u);
  assert.deepEqual(await readdir(resolve(runDir, 'previews')), ['47.source.json']);
  assert.equal((await fetchPreview(hst, { runDir, fetch: async input => {
    assert.ok(!String(input).includes('/invoke'), 'Revisit must skip both MAST metadata calls.');
    return bytesResponse(hstSpectrum());
  } })).kind, 'spectrum');
  assert.deepEqual(seen, ['Mast.Caom.Filtered', 'Mast.Caom.Products']);
  await assert.rejects(fetchPreview({ ...hst, observation: 'changed-id' }, { runDir, fetch: async () => { throw new Error('Fresh source required.'); } }), /Fresh source/u);
  await withRun(async otherRun => {
    await assert.rejects(fetchPreview(hst, { runDir: otherRun, fetch: async () => { throw new Error('New run must resolve.'); } }), /New run/u);
  });
}));

test('the provisional image cache is replaced by the approved 30 by 60 grid and then reused offline', async () => withRun(async runDir => {
  const source: PreviewSource = { ...eso, kind: 'eso', product: 'image', url: 'https://dataportal.eso.org/image', instrument: 'SPHERE' };
  const bytes = image([2, 2], [0, 1, 2, 3], [['PRODCATG', 'SCIENCE.IMAGE']]);
  await fetchPreview(source, { runDir, fetch: async () => bytesResponse(bytes) });
  const path = resolve(runDir, 'previews/33.json'), saved = requireRecord(JSON.parse(await readFile(path, 'utf8')));
  saved.data = { kind: 'image', grid: Array.from({ length: 11 }, () => Array(30).fill(0)), caption: 'old recipe' };
  await writeFile(path, JSON.stringify(saved));
  let calls = 0;
  const data = await fetchPreview(source, { runDir, fetch: async () => { calls++; return bytesResponse(bytes); } });
  assert.equal(calls, 1); assert.equal(data.kind, 'image');
  if (data.kind !== 'image') throw new Error('Expected image.');
  assert.equal(data.grid.length, 30); assert.equal(data.grid[0]!.length, 60);
  assert.deepEqual(await fetchPreview(source, { runDir, fetch: async () => { throw new Error('offline'); } }), data);
}));

async function almaFetch(seen: URL[], nestedTransform = (text: string) => text): Promise<typeof fetch> {
  const member = await readFile(new URL('./fixtures/alma-member.xml', import.meta.url), 'utf8');
  const products = nestedTransform(await readFile(new URL('./fixtures/alma-products.xml', import.meta.url), 'utf8'));
  return async input => {
    const url = new URL(String(input)); seen.push(url);
    if (url.pathname.endsWith('/datalink/sync')) return new Response(url.searchParams.get('ID') === alma.member ? member : products);
    assert.equal(url.origin, 'https://almascience.eso.org'); assert.equal(url.pathname, '/soda/sync');
    return bytesResponse(url.searchParams.get('ID')?.includes('.cube.') ? cube() : continuum());
  };
}

test('recorded ALMA tar DataLink resolves target continuum without fetching a tar or calibrator', async () => withRun(async runDir => {
  const seen: URL[] = [], data = await fetchPreview(alma, { runDir, fetch: await almaFetch(seen) });
  assert.equal(data.kind, 'image'); assert.equal(seen.length, 3);
  assert.equal(seen[1]!.searchParams.get('ID'), '2019.1.01098.S_uid___A001_X1465_X1a15_001_of_001.tar');
  assert.match(seen[2]!.searchParams.get('ID')!, /\.Betelgeuse_sci\..*mfs.*pbcor/u);
  assert.equal(seen[2]!.searchParams.get('CIRCLE'), '88.7931 7.4071 0.0004');
  assert.ok(seen.every(url => !url.pathname.endsWith('.tar')));
}));

test('ALMA prefers only the selected spectral-window cube, falling back to continuum for other windows', async () => withRun(async runDir => {
  const transform = (text: string) => text.replaceAll('spw23_25_27_29.mfs.I.manual.image', 'spw23.cube.I');
  const seen: URL[] = [], data = await fetchPreview(alma, { runDir, fetch: await almaFetch(seen, transform) });
  assert.equal(data.kind, 'spectrum'); assert.match(seen.at(-1)!.searchParams.get('ID')!, /spw23\.cube/u);
  const wrong: URL[] = [], none = await fetchPreview({ ...alma, pick: 10, spw: 25 }, { runDir, fetch: await almaFetch(wrong, transform) });
  assert.equal(none.kind, 'none'); assert.equal(wrong.length, 2);
}));

test('HTTPS is enforced for initial requests and every redirect; HTTP errors never create cache data', async () => withRun(async runDir => {
  let calls = 0;
  await assert.rejects(fetchPreview({ ...eso, url: 'http://dataportal.eso.org/file' }, { runDir, fetch: async () => { calls++; return new Response(); } }), /HTTPS/u);
  assert.equal(calls, 0);
  await assert.rejects(fetchPreview(eso, { runDir, fetch: async () => new Response(null, { status: 302, headers: { location: 'http://dataportal.eso.org/file' } }) }), /HTTPS/u);
  await assert.rejects(fetchPreview(eso, { runDir, fetch: async () => new Response(null, { status: 503 }) }), /HTTP 503/u);
  assert.deepEqual(await readdir(runDir), []);
}));

test('streamed, advertised and archive-specific byte caps stop oversized bodies', async () => withRun(async runDir => {
  await assert.rejects(fetchPreview(eso, { runDir, fetch: async () => bytesResponse(esoSpectrum(), { 'content-length': String(ESO_BYTES + 1) }) }), /byte limit/u);
  await assert.rejects(fetchPreview(eso, { runDir, fetch: async () => new Response(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(ESO_BYTES + 1)); controller.close(); } })) }), /byte limit/u);
  const seen: string[] = [], small = mastFetch([hstProduct], seen);
  await assert.rejects(fetchPreview(hst, { runDir, fetch: async (input, init) => String(input).includes('/invoke') ? small(input, init) : new Response(null, { headers: { 'content-length': String(HST_BYTES + 1) } }) }), /byte limit/u);
  const urls: URL[] = [], almaMock = await almaFetch(urls);
  await assert.rejects(fetchPreview(alma, { runDir, fetch: async (input, init) => String(input).includes('/soda/') ? new Response(null, { headers: { 'content-length': String(ALMA_BYTES + 1) } }) : almaMock(input, init) }), /byte limit/u);
}));

test('abort and whole-operation timeout interrupt stalled fetches and streams, without a cache entry', async () => withRun(async runDir => {
  const abort = new AbortController(); abort.abort(new Error('cursor moved'));
  let calls = 0;
  await assert.rejects(fetchPreview(eso, { runDir, signal: abort.signal, fetch: async () => { calls++; return bytesResponse(esoSpectrum()); } }), /cursor moved/u);
  assert.equal(calls, 0);
  const moving = new AbortController();
  await assert.rejects(fetchPreview(eso, { runDir, signal: moving.signal, fetch: async () => { moving.abort(new Error('cursor moved')); return bytesResponse(esoSpectrum()); } }), /cursor moved/u);
  await assert.rejects(fetchPreview(eso, { runDir, timeoutMs: 10, fetch: async () => new Promise(() => {}) }), /timed out/u);
  let cancelled = false;
  await assert.rejects(fetchPreview(eso, { runDir, timeoutMs: 10, fetch: async () => new Response(new ReadableStream({ cancel() { cancelled = true; } })) }), /timed out/u);
  assert.ok(cancelled); assert.deepEqual(await readdir(runDir), []);
}));
