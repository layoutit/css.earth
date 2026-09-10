import {requireRecord,requireFiniteNumber,requireString} from '../../source-values.mts';
// Reconcile reviewed marker tiles without decoding full-resolution body sources.
// Run from the repository root. No source imagery or body geometry is rebuilt.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { loadMarkerDescriptors } from '../../prepare-navigation.mts';

const refs = { main: 'a1471af189b25c1bed46683f06bc345025a7cf67', companions: 'ea88f6feab538342257bda3b8bd7383126474017' };
const additions = new Set(['asteroid-2001-sn263', 'sn263-beta', 'sn263-gamma']);
const original = (ref: string, path: string) => execFileSync('git', ['show', `${ref}:${path}`], { maxBuffer: 16 * 1024 * 1024 });
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
type Marker = Record<string, unknown> & {index: number; context?: {url: string}};
const banks: Record<string, Record<string, Marker>> = {};
function markerBank(value: unknown): Record<string, Marker> {
 return Object.fromEntries(Object.entries(requireRecord(value)).map(([id,value])=>{
  const marker=requireRecord(value);
  return [id,{...marker,index:requireFiniteNumber(marker.index),...(marker.context ? {context:{...requireRecord(marker.context),url:requireString(requireRecord(marker.context).url)}} : {})}];
 }));
}
for (const [name, ref] of Object.entries(refs)) {
  const source = original(ref, 'site/prepared-navigation-markers.mjs');
  banks[name] = markerBank((await import('data:text/javascript;base64,' + source.toString('base64'))).PREPARED_NAVIGATION_MARKERS);
}
const descriptors = await loadMarkerDescriptors();
assert.equal(descriptors.length, Object.keys(banks.main).length + additions.size);
const markers: Record<string, Marker> = {};
const report = { refs, objects: descriptors.length, method: 'Copy decoded committed tiles by body identity and encode losslessly. Visible RGB and alpha must match each committed input tile exactly. Fully transparent RGB is not a visible value.', densities: [] as {density: number; width: number; height: number; inputs: Record<string, {bytes: number; sha256: string}>; output: {bytes: number; sha256: string}; changedVisiblePixels: number}[], contexts: [] as {path: string; bytes: number; sha256: string; ref: string}[] };
for (const [index, descriptor] of descriptors.entries()) {
  const name: keyof typeof refs = additions.has(descriptor.planetId) ? 'companions' : 'main';
  const previous = banks[name][descriptor.planetId];
  assert.ok(previous, descriptor.planetId);
  assert.deepEqual(descriptor, JSON.parse(original(refs[name], `src/planets/${descriptor.planetId}/source/preparation/navigation.json`).toString('utf8')));
  markers[descriptor.planetId] = { ...previous, index, count: descriptors.length };
  if (previous.context) {
    const path = 'public' + previous.context.url, bytes = original(refs[name], path);
    await writeFile(path, bytes);
    report.contexts.push({ path, bytes: bytes.length, sha256: hash(bytes), ref: refs[name] });
  }
}
sharp.concurrency(1);
for (const density of [1, 2]) {
  const tile = 16 * density, filename = `planet-markers${density === 2 ? '@2x' : ''}.webp`;
  const decoded: Record<string, {data: Buffer; info: {width: number; height: number}}> = {}, inputs: Record<string, {bytes: number; sha256: string}> = {};
  for (const [name, ref] of Object.entries(refs)) {
    const bytes = original(ref, `public/navigation/${filename}`);
    decoded[name] = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.equal(decoded[name].info.width, tile * Object.keys(banks[name]).length);
    assert.equal(decoded[name].info.height, tile);
    inputs[name] = { bytes: bytes.length, sha256: hash(bytes) };
  }
  const width = tile * descriptors.length, pixels = Buffer.alloc(width * tile * 4);
  for (const [index, { planetId }] of descriptors.entries()) {
    const name = additions.has(planetId) ? 'companions' : 'main';
    const source = decoded[name], sourceIndex = banks[name][planetId].index;
    for (let y = 0; y < tile; y++) {
      const start = (y * source.info.width + sourceIndex * tile) * 4;
      source.data.copy(pixels, (y * width + index * tile) * 4, start, start + tile * 4);
    }
  }
  const output = await sharp(pixels, { raw: { width, height: tile, channels: 4 } }).webp({ lossless: true, effort: 4 }).toBuffer();
  const check = await sharp(output).ensureAlpha().raw().toBuffer();
  for (let i = 0; i < pixels.length; i += 4) {
    assert.equal(check[i + 3], pixels[i + 3], 'alpha changed');
    if (pixels[i + 3]) assert.deepEqual(check.subarray(i, i + 3), pixels.subarray(i, i + 3), 'visible RGB changed');
  }
  await writeFile(`public/navigation/${filename}`, output);
  report.densities.push({ density, width, height: tile, inputs, output: { bytes: output.length, sha256: hash(output) }, changedVisiblePixels: 0 });
}
await writeFile('site/prepared-navigation-markers.mjs', '// Generated from object-owned marker recipes. Do not edit.\nexport const PREPARED_NAVIGATION_MARKERS = Object.freeze(' + JSON.stringify(markers) + ');\n');
await mkdir('output/companion-catalog', { recursive: true });
await writeFile('output/companion-catalog/merge-navigation.json', JSON.stringify(report, null, 2) + '\n');
console.log({ objects: report.objects, contexts: report.contexts.length, densities: report.densities });
