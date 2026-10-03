import { projectRoot } from '@cssearth/core/node';
import assert from 'node:assert/strict';
import { sourceTest } from '@cssearth/objects/node/source-test';
const test = sourceTest();
import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { inventoryAssets } from '@cssearth/bake/delivery';
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

test('the published world files and system views must describe the same systems', async () => {
  const root = projectRoot(import.meta.url), prepared = resolve(root, 'src/objects/observable-universe/prepared');
  const summary = await readFile(resolve(prepared, 'world.json'), 'utf8');
  // Every holder's members are named members.json in its own package: an address is read back through the inventories.
  // Members and system views are each in their own package's prepared files.
  const holders = (await readdir(resolve(root, 'src/objects'))).filter(id => existsSync(resolve(root, 'src/objects', id, 'prepared/members.json')) || existsSync(resolve(root, 'src/objects', id, 'prepared/views')));
  const byUrl = new Map((await inventoryAssets(root, holders, { location: 'prepared' })).map(asset => [asset.url, asset] as const));
  const view = async (url: string) => readFile(byUrl.get(url)!.file, 'utf8');
  const nameOf = (url: string) => { const asset = byUrl.get(url); return asset?.filename === 'members.json' ? asset.id : asset ? asset.filename.replace(/^views\//u, '').replace(/\.json$/u, '') : url; };
  const read = (alter?: (id: string, text: string) => string) => async (url: string) => url.endsWith('/world.json') ? summary
    : (alter ?? ((_id, text) => text))(nameOf(url), await view(url));
  assert.ok(await checkPublishedWorldPair(root, read()) > 0);
  // A view for another system than its file names is caught.
  await assert.rejects(checkPublishedWorldPair(root, read((id, text) => id === 'trappist-1' ? text.replace('"id":"trappist-1"', '"id":"sun"') : text)), /published world files disagree: Prepared system view for trappist-1 names sun/);
  // A read that fails is reported as that read, not as a disagreement.
  const unreachable = async (url: string) => { if (nameOf(url) === 'trappist-1-system') throw new Error(`Could not read ${url}.`); return read()(url); };
  await assert.rejects(checkPublishedWorldPair(root, unreachable), (error: Error) => /Could not read .*members\.json/.test(error.message) && !/disagree/.test(error.message));
});
