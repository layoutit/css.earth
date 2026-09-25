import { expect, test } from 'vitest';
import { createPreparedAssetResolver, parsePreparedAssetOrigin, preparedAssetGroup, preparedAssetGroupFile, resolvePreparedAssetUrl, rewritePreparedStyleUrls } from './prepared-asset-origin.js';

const sha = 'a'.repeat(64), other = 'b'.repeat(64);

test('an unset origin returns the address unchanged', () => {
  expect(resolvePreparedAssetUrl('/scenes/saturn/saturn-surface@2x.webp', undefined)).toBe('/scenes/saturn/saturn-surface@2x.webp');
  expect(resolvePreparedAssetUrl('/scenes/saturn/saturn-surface@2x.webp', null)).toBe('/scenes/saturn/saturn-surface@2x.webp');
});

test('a non-scene address is never rewritten, even with an origin set', () => {
  const origin = { origin: 'https://earth-assets.lowpoly.cc', assets: { 'body-saturn.webp': sha } };
  expect(resolvePreparedAssetUrl('/navigation/body-saturn.webp', origin)).toBe('/navigation/body-saturn.webp');
  expect(resolvePreparedAssetUrl('/features/index.json', origin)).toBe('/features/index.json');
});

test('resolves a bare-string address through the object asset map', () => {
  const origin = { origin: 'https://earth-assets.lowpoly.cc', assets: { 'saturn-surface@2x.webp': sha } };
  expect(resolvePreparedAssetUrl('/scenes/saturn/saturn-surface@2x.webp', origin))
    .toBe(`https://earth-assets.lowpoly.cc/runtime-assets/${sha}/saturn-surface@2x.webp`);
});

test('a nested filename keeps its remaining path segments', () => {
  const origin = { origin: 'https://earth-assets.lowpoly.cc', assets: { 'city/tile-0-0.webp': sha } };
  expect(resolvePreparedAssetUrl('/scenes/earth/city/tile-0-0.webp', origin))
    .toBe(`https://earth-assets.lowpoly.cc/runtime-assets/${sha}/city/tile-0-0.webp`);
});

test('an inline sha256 pin resolves without an asset map', () => {
  const origin = { origin: 'https://earth-assets.lowpoly.cc' };
  expect(resolvePreparedAssetUrl('/scenes/earth/earth-destinations.json', origin, sha))
    .toBe(`https://earth-assets.lowpoly.cc/runtime-assets/${sha}/earth-destinations.json`);
});

test('an inline pin and the asset map must agree', () => {
  const origin = { origin: 'https://earth-assets.lowpoly.cc', assets: { 'earth-destinations.json': other } };
  expect(() => resolvePreparedAssetUrl('/scenes/earth/earth-destinations.json', origin, sha))
    .toThrow(/disagreement/);
});

test('an address missing from the map throws rather than fabricating a URL', () => {
  const origin = { origin: 'https://earth-assets.lowpoly.cc', assets: {} };
  expect(() => resolvePreparedAssetUrl('/scenes/saturn/saturn-surface@2x.webp', origin)).toThrow(/No published asset hash/);
});

test('rewritePreparedStyleUrls rewrites a baked node style url() against the asset origin', () => {
  const origin = { origin: 'https://earth-assets.lowpoly.cc', assets: { 'antares-surface-shape@2x.webp': sha } };
  const style = '--polycss-atlas-width:64px;--polycss-atlas-height:64px;background-image:url(/scenes/antares/antares-surface-shape@2x.webp);background-position:-16px 0';
  expect(rewritePreparedStyleUrls(style, origin)).toBe(
    `--polycss-atlas-width:64px;--polycss-atlas-height:64px;background-image:url(https://earth-assets.lowpoly.cc/runtime-assets/${sha}/antares-surface-shape@2x.webp);background-position:-16px 0`);
});

test('rewritePreparedStyleUrls leaves the style unchanged when the origin is null or unset', () => {
  const style = 'background-image:url(/scenes/antares/antares-surface-shape@2x.webp)';
  expect(rewritePreparedStyleUrls(style, null)).toBe(style);
  expect(rewritePreparedStyleUrls(style, undefined)).toBe(style);
});

test('rewritePreparedStyleUrls still throws loudly on a filename missing from the asset map', () => {
  const origin = { origin: 'https://earth-assets.lowpoly.cc', assets: {} };
  const style = 'background-image:url(/scenes/antares/antares-surface-shape@2x.webp)';
  expect(() => rewritePreparedStyleUrls(style, origin)).toThrow(/No published asset hash/);
});

test('parsePreparedAssetOrigin validates shape and rejects malformed input', () => {
  expect(parsePreparedAssetOrigin(undefined)).toBeUndefined();
  expect(parsePreparedAssetOrigin({ origin: 'https://earth-assets.lowpoly.cc' })).toEqual({ origin: 'https://earth-assets.lowpoly.cc' });
  expect(parsePreparedAssetOrigin({ origin: 'https://earth-assets.lowpoly.cc', assets: { 'a.webp': sha } }))
    .toEqual({ origin: 'https://earth-assets.lowpoly.cc', assets: { 'a.webp': sha } });
  expect(() => parsePreparedAssetOrigin({ origin: 'not-a-url' })).toThrow();
  expect(() => parsePreparedAssetOrigin({ origin: 'https://earth-assets.lowpoly.cc/path' })).toThrow();
  expect(() => parsePreparedAssetOrigin({ origin: 'https://earth-assets.lowpoly.cc', assets: { 'a.webp': 'not-a-hash' } })).toThrow();
  expect(() => parsePreparedAssetOrigin({ origin: 'https://earth-assets.lowpoly.cc', extra: true })).toThrow();
});

test('keys that differ only in their first index share a hash group; unindexed keys share one', () => {
  expect(preparedAssetGroup('page:normal:12:level:2048')).toBe('page:normal:level:2048');
  expect(preparedAssetGroup('page:normal:0')).toBe('page:normal');
  expect(preparedAssetGroup('lighting:31')).toBe('lighting');
  expect(preparedAssetGroup('surface:radial-field-01')).toBe('');
  expect(preparedAssetGroupFile('page:normal:level:2048')).toBe('page.normal.level.2048.json');
  expect(preparedAssetGroupFile('')).toBe('unindexed.json');
  expect(() => preparedAssetGroupFile('../x')).toThrow('is not a key path');
});

test('an origin names its hash groups only as an object hash directory', () => {
  expect(parsePreparedAssetOrigin({ origin: 'https://earth-assets.lowpoly.cc', assets: {}, groups: '/objects/earth/asset-hashes/' })?.groups)
    .toBe('/objects/earth/asset-hashes/');
  expect(() => parsePreparedAssetOrigin({ origin: 'https://earth-assets.lowpoly.cc', groups: 'https://elsewhere.example/' }))
    .toThrow('/objects/<id>/asset-hashes/');
});

test('a hash the page did not embed arrives with its group, read once for every key in it', async () => {
  const reads: string[] = [];
  const resolver = createPreparedAssetResolver({ origin: 'https://earth-assets.lowpoly.cc', assets: { 'first.webp': sha }, groups: '/objects/earth/asset-hashes/' },
    async url => { reads.push(url); return { 'page-1.webp': other, 'page-2.webp': sha }; });
  expect(resolver.has('/scenes/earth/first.webp')).toBe(true);
  expect(resolver.has('/scenes/earth/page-1.webp')).toBe(false);
  expect(() => resolver.url('/scenes/earth/page-1.webp')).toThrow('No published asset hash');
  await Promise.all([resolver.ensure('page:normal:1:level:2048', '/scenes/earth/page-1.webp'), resolver.ensure('page:normal:2:level:2048', '/scenes/earth/page-2.webp')]);
  expect(reads).toEqual(['/objects/earth/asset-hashes/page.normal.level.2048.json']);
  expect(resolver.url('/scenes/earth/page-1.webp')).toBe(`https://earth-assets.lowpoly.cc/runtime-assets/${other}/page-1.webp`);
  await expect(resolver.ensure('page:normal:3:level:2048', '/scenes/earth/page-3.webp')).rejects.toThrow('does not list page-3.webp (page:normal:3:level:2048)');
});

test('a failed hash group read is retried by the next demand', async () => {
  let attempts = 0;
  const resolver = createPreparedAssetResolver({ origin: 'https://earth-assets.lowpoly.cc', groups: '/objects/earth/asset-hashes/' },
    async () => { attempts++; if (attempts === 1) throw new Error('offline'); return { 'page-1.webp': sha }; });
  await expect(resolver.ensure('page:clouds:1', '/scenes/earth/page-1.webp')).rejects.toThrow('offline');
  await resolver.ensure('page:clouds:1', '/scenes/earth/page-1.webp');
  expect(attempts).toBe(2);
});
