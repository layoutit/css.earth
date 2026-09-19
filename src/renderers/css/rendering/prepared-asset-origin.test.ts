import { expect, test } from 'vitest';
import { parsePreparedAssetOrigin, resolvePreparedAssetUrl, rewritePreparedStyleUrls } from './prepared-asset-origin.js';

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
