import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { checkPublishedWorldPair, runtimeAssetUrls, unknownRuntimeAssetUrls } from './check-deploy-assets.mts';

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

test('the published world summary and system views must describe the same systems', async () => {
  const root = resolve(import.meta.dirname, '../..'), prepared = resolve(root, 'src/objects/sun/prepared');
  const summary = await readFile(resolve(prepared, 'world-context-summary.json'), 'utf8'), views = JSON.parse(await readFile(resolve(prepared, 'world-system-views.json'), 'utf8'));
  const read = (viewsText: string) => async (url: string) => url.endsWith('/world-context-summary.json') ? summary : viewsText;
  assert.ok(await checkPublishedWorldPair(root, read(JSON.stringify(views))) > 0);
  const [dropped] = Object.keys(views.views); delete views.views[dropped];
  await assert.rejects(checkPublishedWorldPair(root, read(JSON.stringify(views))), /published world summary and system views disagree/);
});
