import { projectRoot } from '@cssearth/core/node';
import assert from 'node:assert/strict';
import { sourceTest } from '@cssearth/objects/node/source-test';
const test = sourceTest();
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { checkPublishedWorldPair, runtimeAssetUrls, unknownRuntimeAssetUrls } from '@cssearth/bake/asset-publication';

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
  const root = projectRoot(import.meta.url), prepared = resolve(root, 'src/objects/sun/prepared');
  const summary = await readFile(resolve(prepared, 'world-context-summary.json'), 'utf8');
  // A system's bodies and its views share a file name; the address says which folder it is.
  const view = async (url: string) => readFile(url.endsWith('/world-index.json') ? resolve(prepared, 'world-index.json')
    : resolve(prepared, url.includes('/world-systems/') ? 'world-systems' : 'system-views', url.split('/').at(-1)!), 'utf8');
  const read = (alter?: (id: string, text: string) => string) => async (url: string) => url.endsWith('/world-context-summary.json') ? summary
    : (alter ?? ((_id, text) => text))(url.split('/').at(-1)!.replace(/\.json$/u, ''), await view(url));
  assert.ok(await checkPublishedWorldPair(root, read()) > 0);
  // A view for another system than its file names is caught.
  await assert.rejects(checkPublishedWorldPair(root, read((id, text) => id === 'trappist-1' ? text.replace('"id":"trappist-1"', '"id":"sun"') : text)), /published world summary and system views disagree/);
  // A read that fails is reported as that read, not as a disagreement.
  const unreachable = async (url: string) => { if (url.endsWith('/trappist-1.json')) throw new Error(`Could not read ${url}.`); return read()(url); };
  await assert.rejects(checkPublishedWorldPair(root, unreachable), (error: Error) => /Could not read .*trappist-1\.json/.test(error.message) && !/disagree/.test(error.message));
});
