import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { acquireGalaxyFieldSources } from './acquire.mts';
import { sourceCacheUrl } from '../assets/source-mirror.mts';

const MIRROR_ORIGIN = 'https://mirror.example';

function pinnedUrl(query: string): string {
  const url = new URL('https://tapvizier.cds.unistra.fr/TAPVizieR/tap/sync');
  for (const [key, value] of Object.entries({ REQUEST: 'doQuery', LANG: 'ADQL', FORMAT: 'tsv', MAXREC: '1000000', QUERY: query })) url.searchParams.set(key, value);
  return url.href;
}

const QUERY = 'SELECT PGC FROM "fixture"';
const TSV = 'PGC\tVal\n1\t2\n'; // header + 1 data row
const BYTES = Buffer.byteLength(TSV);

async function fixtureRoot() {
  const root = await mkdtemp(resolve(tmpdir(), 'galaxy-field-acquire-'));
  await mkdir(resolve(root, 'src/objects/nearby-universe/source'), { recursive: true });
  await writeFile(resolve(root, 'src/objects/nearby-universe/source/catalogue.json'), JSON.stringify({
    schema: 'cssearth-galaxy-field-sources@1',
    sources: [{
      id: 'fixture-catalogue', catalogue: 'fixture/table', citation: 'Fixture et al.', doi: 'https://doi.org/fixture',
      query: QUERY, path: '.local/galaxy-field/sources/fixture-catalogue.tsv', url: pinnedUrl(QUERY),
      bytes: BYTES, rows: 1,
    }],
  }));
  return root;
}

function unreachableFetcher(label: string): typeof fetch {
  return (async () => { throw new Error(`${label} must not be called`); }) as typeof fetch;
}

test('an already-cached file matching its pin is reused without any network call', async t => {
  const root = await fixtureRoot();
  t.after(() => rm(root, { recursive: true, force: true }));
  const cachePath = resolve(root, '.local/galaxy-field/sources/fixture-catalogue.tsv');
  await mkdir(resolve(root, '.local/galaxy-field/sources'), { recursive: true });
  await writeFile(cachePath, TSV);
  await acquireGalaxyFieldSources({ root, fetcher: unreachableFetcher('fetcher') });
  assert.equal((await readFile(cachePath, 'utf8')), TSV);
});

test('without a mirror origin, it fetches directly from the pinned VizieR query', async t => {
  const root = await fixtureRoot();
  t.after(() => rm(root, { recursive: true, force: true }));
  const requested: string[] = [];
  await acquireGalaxyFieldSources({ root, fetcher: async url => {
    requested.push(String(url));
    return new Response(TSV, { status: 200 });
  } });
  assert.deepEqual(requested, [pinnedUrl(QUERY)]);
  assert.equal(await readFile(resolve(root, '.local/galaxy-field/sources/fixture-catalogue.tsv'), 'utf8'), TSV);
});

test('with a mirror origin, the mirror is tried first and VizieR is never contacted on a hit', async t => {
  const root = await fixtureRoot();
  t.after(() => rm(root, { recursive: true, force: true }));
  const requested: string[] = [];
  await acquireGalaxyFieldSources({ root, mirrorOrigin: MIRROR_ORIGIN, fetcher: async url => {
    requested.push(String(url));
    if (String(url).includes('tapvizier')) throw new Error('must not reach VizieR when the mirror hits');
    return new Response(TSV, { status: 200 });
  } });
  assert.deepEqual(requested, [sourceCacheUrl(MIRROR_ORIGIN, 'galaxy-field', 'fixture-catalogue.tsv')]);
  assert.equal(await readFile(resolve(root, '.local/galaxy-field/sources/fixture-catalogue.tsv'), 'utf8'), TSV);
});

test('a mirror miss (404) falls back to VizieR, which stays the recorded provenance', async t => {
  const root = await fixtureRoot();
  t.after(() => rm(root, { recursive: true, force: true }));
  const requested: string[] = [];
  await acquireGalaxyFieldSources({ root, mirrorOrigin: MIRROR_ORIGIN, fetcher: async url => {
    requested.push(String(url));
    if (String(url).includes('tapvizier')) return new Response(TSV, { status: 200 });
    return new Response(null, { status: 404 });
  } });
  assert.deepEqual(requested, [sourceCacheUrl(MIRROR_ORIGIN, 'galaxy-field', 'fixture-catalogue.tsv'), pinnedUrl(QUERY)]);
  assert.equal(await readFile(resolve(root, '.local/galaxy-field/sources/fixture-catalogue.tsv'), 'utf8'), TSV);
});

test('a mirror byte mismatch is never trusted and falls back to VizieR', async t => {
  const root = await fixtureRoot();
  t.after(() => rm(root, { recursive: true, force: true }));
  const requested: string[] = [];
  await acquireGalaxyFieldSources({ root, mirrorOrigin: MIRROR_ORIGIN, fetcher: async url => {
    requested.push(String(url));
    if (String(url).includes('tapvizier')) return new Response(TSV, { status: 200 });
    return new Response('corrupted-mirror-bytes', { status: 200 });
  } });
  assert.deepEqual(requested, [sourceCacheUrl(MIRROR_ORIGIN, 'galaxy-field', 'fixture-catalogue.tsv'), pinnedUrl(QUERY)]);
  assert.equal(await readFile(resolve(root, '.local/galaxy-field/sources/fixture-catalogue.tsv'), 'utf8'), TSV);
});

test('a stale local cache that no longer matches its pin is refetched, not trusted', async t => {
  const root = await fixtureRoot();
  t.after(() => rm(root, { recursive: true, force: true }));
  const cachePath = resolve(root, '.local/galaxy-field/sources/fixture-catalogue.tsv');
  await mkdir(resolve(root, '.local/galaxy-field/sources'), { recursive: true });
  await writeFile(cachePath, 'stale-drifted-bytes');
  await acquireGalaxyFieldSources({ root, fetcher: async () => new Response(TSV, { status: 200 }) });
  assert.equal(await readFile(cachePath, 'utf8'), TSV);
});

test('a changed VizieR response (wrong hash) is rejected rather than cached', async t => {
  const root = await fixtureRoot();
  t.after(() => rm(root, { recursive: true, force: true }));
  await assert.rejects(acquireGalaxyFieldSources({ root, fetcher: async () => new Response('unexpected-content', { status: 200 }) }),
    /Changed source response: fixture-catalogue/);
});
