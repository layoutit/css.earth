import assert from 'node:assert/strict';
import test from 'node:test';
import { runtimeAssetUrls, unknownRuntimeAssetUrls } from './check-deploy-assets.mts';

const hash = 'a'.repeat(64);
const known = `https://earth-assets.lowpoly.cc/runtime-assets/${hash}/datasets/preview.webp`;

test('deploy asset closure extracts unique R2 runtime URLs and rejects an uninventoried hash', () => {
  assert.deepEqual(runtimeAssetUrls(`<img src="${known}"><script>const again='${known}'</script>`), [known]);
  const missing = `https://earth-assets.lowpoly.cc/runtime-assets/${'b'.repeat(64)}/datasets/preview.webp`;
  assert.deepEqual(unknownRuntimeAssetUrls([known, missing], new Set([known])), [missing]);
});

test('deploy asset closure ignores unrelated URLs and truncated identities', () => {
  assert.deepEqual(runtimeAssetUrls(`https://example.test/runtime-assets/${hash}/x.webp ${RUNTIME_ASSET_ORIGIN_FIXTURE()}`), []);
});

test('deploy asset closure preserves the complete @2x filenames emitted by surface textures', () => {
  const retina = `https://earth-assets.lowpoly.cc/runtime-assets/${hash}/mercury-poles@2x.webp`;
  const urls = runtimeAssetUrls(`<img src="${retina}"><style>.surface{background:url(${retina})}</style>`);
  assert.deepEqual(urls, [retina]);
  assert.deepEqual(unknownRuntimeAssetUrls(urls, new Set([retina])), []);
});

function RUNTIME_ASSET_ORIGIN_FIXTURE(): string {
  return `https://earth-assets.lowpoly.cc/runtime-assets/${'c'.repeat(63)}/x.webp`;
}
