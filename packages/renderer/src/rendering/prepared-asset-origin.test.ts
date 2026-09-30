import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { createPreparedAssetResolver, parsePreparedAssetOrigin, preparedAssetGroup, preparedAssetGroupFile, resolvePreparedAssetUrl, rewritePreparedStyleUrls } from './prepared-asset-origin.js';

const sha = 'a'.repeat(64), other = 'b'.repeat(64);

test('an unset origin returns the address unchanged', () => {
  assert.equal(resolvePreparedAssetUrl('/scenes/saturn/saturn-surface@2x.webp', undefined), '/scenes/saturn/saturn-surface@2x.webp');
  assert.equal(resolvePreparedAssetUrl('/scenes/saturn/saturn-surface@2x.webp', null), '/scenes/saturn/saturn-surface@2x.webp');
});

test('a non-scene address is never rewritten, even with an origin set', () => {
  const origin = { origin: 'https://earth-assets.lowpoly.cc', assets: { 'body-saturn.webp': sha } };
  assert.equal(resolvePreparedAssetUrl('/navigation/body-saturn.webp', origin), '/navigation/body-saturn.webp');
  assert.equal(resolvePreparedAssetUrl('/features/index.json', origin), '/features/index.json');
});

test('resolves a bare-string address through the object asset map', () => {
  const origin = { origin: 'https://earth-assets.lowpoly.cc', assets: { 'saturn-surface@2x.webp': sha } };
  assert.equal(resolvePreparedAssetUrl('/scenes/saturn/saturn-surface@2x.webp', origin), `https://earth-assets.lowpoly.cc/runtime-assets/${sha}/saturn-surface@2x.webp`);
});

test('a nested filename keeps its remaining path segments', () => {
  const origin = { origin: 'https://earth-assets.lowpoly.cc', assets: { 'city/tile-0-0.webp': sha } };
  assert.equal(resolvePreparedAssetUrl('/scenes/earth/city/tile-0-0.webp', origin), `https://earth-assets.lowpoly.cc/runtime-assets/${sha}/city/tile-0-0.webp`);
});

test('an address missing from the map throws rather than fabricating a URL', () => {
  const origin = { origin: 'https://earth-assets.lowpoly.cc', assets: {} };
  assert.throws(() => resolvePreparedAssetUrl('/scenes/saturn/saturn-surface@2x.webp', origin), /No published asset hash/);
});

test('rewritePreparedStyleUrls rewrites a baked node style url() against the asset origin', () => {
  const origin = { origin: 'https://earth-assets.lowpoly.cc', assets: { 'antares-surface-shape@2x.webp': sha } };
  const style = '--polycss-atlas-width:64px;--polycss-atlas-height:64px;background-image:url(/scenes/antares/antares-surface-shape@2x.webp);background-position:-16px 0';
  assert.equal(rewritePreparedStyleUrls(style, origin), `--polycss-atlas-width:64px;--polycss-atlas-height:64px;background-image:url(https://earth-assets.lowpoly.cc/runtime-assets/${sha}/antares-surface-shape@2x.webp);background-position:-16px 0`);
});

test('rewritePreparedStyleUrls leaves the style unchanged when the origin is null or unset', () => {
  const style = 'background-image:url(/scenes/antares/antares-surface-shape@2x.webp)';
  assert.equal(rewritePreparedStyleUrls(style, null), style);
  assert.equal(rewritePreparedStyleUrls(style, undefined), style);
});

test('rewritePreparedStyleUrls still throws loudly on a filename missing from the asset map', () => {
  const origin = { origin: 'https://earth-assets.lowpoly.cc', assets: {} };
  const style = 'background-image:url(/scenes/antares/antares-surface-shape@2x.webp)';
  assert.throws(() => rewritePreparedStyleUrls(style, origin), /No published asset hash/);
});

test('parsePreparedAssetOrigin validates shape and rejects malformed input', () => {
  assert.equal(parsePreparedAssetOrigin(undefined), undefined);
  assert.deepEqual(parsePreparedAssetOrigin({ origin: 'https://earth-assets.lowpoly.cc' }), { origin: 'https://earth-assets.lowpoly.cc' });
  assert.deepEqual(parsePreparedAssetOrigin({ origin: 'https://earth-assets.lowpoly.cc', assets: { 'a.webp': sha } }), { origin: 'https://earth-assets.lowpoly.cc', assets: { 'a.webp': sha } });
  assert.throws(() => parsePreparedAssetOrigin({ origin: 'not-a-url' }));
  assert.throws(() => parsePreparedAssetOrigin({ origin: 'https://earth-assets.lowpoly.cc/path' }));
  assert.throws(() => parsePreparedAssetOrigin({ origin: 'https://earth-assets.lowpoly.cc', assets: { 'a.webp': 'not-a-hash' } }));
  assert.throws(() => parsePreparedAssetOrigin({ origin: 'https://earth-assets.lowpoly.cc', extra: true }));
});

test('keys that differ only in their first index share a hash group; unindexed keys share one', () => {
  assert.equal(preparedAssetGroup('page:normal:12:level:2048'), 'page:normal:level:2048');
  assert.equal(preparedAssetGroup('page:normal:0'), 'page:normal');
  assert.equal(preparedAssetGroup('lighting:31'), 'lighting');
  assert.equal(preparedAssetGroup('surface:radial-field-01'), '');
  assert.equal(preparedAssetGroupFile('page:normal:level:2048'), 'page.normal.level.2048.json');
  assert.equal(preparedAssetGroupFile(''), 'unindexed.json');
  assert.throws(() => preparedAssetGroupFile('../x'), /is not a key path/);
});

test('an origin names its hash groups only as an object hash directory', () => {
  assert.equal(parsePreparedAssetOrigin({ origin: 'https://earth-assets.lowpoly.cc', assets: {}, groups: '/objects/earth/asset-hashes/' })?.groups, '/objects/earth/asset-hashes/');
  assert.throws(() => parsePreparedAssetOrigin({ origin: 'https://earth-assets.lowpoly.cc', groups: 'https://elsewhere.example/' }), /\/objects\/<id>\/asset-hashes\//);
});

test('a hash the page did not embed arrives with its group, read once for every key in it', async () => {
  const reads: string[] = [];
  const resolver = createPreparedAssetResolver({ origin: 'https://earth-assets.lowpoly.cc', assets: { 'first.webp': sha }, groups: '/objects/earth/asset-hashes/' },
    async url => { reads.push(url); return { 'page-1.webp': other, 'page-2.webp': sha }; });
  assert.equal(resolver.has('/scenes/earth/first.webp'), true);
  assert.equal(resolver.has('/scenes/earth/page-1.webp'), false);
  assert.throws(() => resolver.url('/scenes/earth/page-1.webp'), /No published asset hash/);
  await Promise.all([resolver.ensure('page:normal:1:level:2048', '/scenes/earth/page-1.webp'), resolver.ensure('page:normal:2:level:2048', '/scenes/earth/page-2.webp')]);
  assert.deepEqual(reads, ['/objects/earth/asset-hashes/page.normal.level.2048.json']);
  assert.equal(resolver.url('/scenes/earth/page-1.webp'), `https://earth-assets.lowpoly.cc/runtime-assets/${other}/page-1.webp`);
  await assert.rejects(resolver.ensure('page:normal:3:level:2048', '/scenes/earth/page-3.webp'), /does not list page-3\.webp \(page:normal:3:level:2048\)/);
});

test('a failed hash group read is retried by the next demand', async () => {
  let attempts = 0;
  const resolver = createPreparedAssetResolver({ origin: 'https://earth-assets.lowpoly.cc', groups: '/objects/earth/asset-hashes/' },
    async () => { attempts++; if (attempts === 1) throw new Error('offline'); return { 'page-1.webp': sha }; });
  await assert.rejects(resolver.ensure('page:clouds:1', '/scenes/earth/page-1.webp'), /offline/);
  await resolver.ensure('page:clouds:1', '/scenes/earth/page-1.webp');
  assert.equal(attempts, 2);
});
