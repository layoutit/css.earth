import assert from 'node:assert/strict';
import test from 'node:test';
import { runtimeAssetUrls, unknownRuntimeAssetUrls } from './check-deploy-assets.mts';

const hash = 'a'.repeat(64);
const known = `https://earth-assets.lowpoly.cc/runtime-assets/${hash}/datasets/preview@2x.webp`;

test('deploy asset closure extracts unique R2 runtime URLs and rejects an uninventoried hash', () => {
  assert.deepEqual(runtimeAssetUrls(`<img src="${known}"><script>const again='${known}'</script>`), [known]);
  const missing = `https://earth-assets.lowpoly.cc/runtime-assets/${'b'.repeat(64)}/datasets/preview.webp`;
  assert.deepEqual(unknownRuntimeAssetUrls([known, missing], new Set([known])), [missing]);
});

test('deploy asset closure ignores unrelated URLs and truncated identities', () => {
  assert.deepEqual(runtimeAssetUrls(`https://example.test/runtime-assets/${hash}/x.webp ${RUNTIME_ASSET_ORIGIN_FIXTURE()}`), []);
});

function RUNTIME_ASSET_ORIGIN_FIXTURE(): string {
  return `https://earth-assets.lowpoly.cc/runtime-assets/${'c'.repeat(63)}/x.webp`;
}
