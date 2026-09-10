// Reuse accepted pixels by identity; render only the three new object recipes.
import assert from 'node:assert/strict';
import { writeFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { OBJECTS } from '../../../../site/objects.mts';
import { loadMarkerDescriptors, prepareContextMarkers } from '../../../prepare-navigation.mts';
import { renderMarker } from '../../../../src/navigation/marker-recipe.mts';
import { bodies } from './catalog.mts';
const baseline = '7ceddde4dab731abc2521c5833b1cedffd11fb3b';
const original = (path: string) => execFileSync('git', ['show', `${baseline}:${path}`], { maxBuffer: 8 * 1024 * 1024 });
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const old = (await import('data:text/javascript;base64,' + original('site/prepared-navigation-markers.mjs').toString('base64'))).PREPARED_NAVIGATION_MARKERS;
const additions = new Set(bodies.map(body => body.id)), planets = OBJECTS.toSorted((a, b) => a.distanceAu - b.distanceAu);
assert.equal(planets.length, Object.keys(old).length + additions.size);
// Existing recipes are unchanged; their committed decoded pixels remain authoritative.
const changed = execFileSync('git', ['diff', '--name-only', baseline, '--', 'src/planets/*/source/preparation/navigation.json'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
assert(changed.every(path => additions.has(path.split('/')[2])), 'Existing navigation recipe changed; qualify its new pixels first');
const descriptors = await loadMarkerDescriptors({ planets: planets.filter(body => additions.has(body.id)) });
const descriptorById = new Map(descriptors.map(d => [d.planetId, d]));
sharp.concurrency(1);
const context = await prepareContextMarkers({ projectRoot: process.cwd(), outputRoot: resolve('public/navigation'), descriptors, planets });
const markers = Object.fromEntries(planets.map((body, index) => [body.id, {
  ...(old[body.id] ?? { presentation: descriptorById.get(body.id)!.presentation, context: context[body.id] }),
  index, count: planets.length,
}]));
const report = { baseline, objects: planets.length, method: 'Preserve every existing decoded visible pixel; render additions from their source-pinned navigation recipes; encode losslessly.', densities: [] as { density: number; baselineSha256: string; outputSha256: string; changedExistingVisiblePixels: number }[] };
for (const density of [1, 2]) {
  const tile = 16 * density, filename = `planet-markers${density === 2 ? '@2x' : ''}.webp`, bytes = original(`public/navigation/${filename}`);
  const previous = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(previous.info.width, Object.keys(old).length * tile);
  const width = planets.length * tile, pixels = Buffer.alloc(width * tile * 4);
  for (const [index, body] of planets.entries()) {
    const descriptor = descriptorById.get(body.id);
    const fresh = descriptor ? await sharp(await renderMarker(descriptor, { sourcePath: resolve('src/planets', body.id, 'source', descriptor.source.path), tileSize: tile })).ensureAlpha().raw().toBuffer() : null;
    for (let y = 0; y < tile; y++) {
      const source = fresh ?? previous.data, start = fresh ? y * tile * 4 : (y * previous.info.width + old[body.id].index * tile) * 4;
      source.copy(pixels, (y * width + index * tile) * 4, start, start + tile * 4);
    }
  }
  const output = await sharp(pixels, { raw: { width, height: tile, channels: 4 } }).webp({ lossless: true, effort: 4 }).toBuffer();
  const decoded = await sharp(output).ensureAlpha().raw().toBuffer();
  for (let i = 0; i < pixels.length; i += 4) {
    assert.equal(decoded[i + 3], pixels[i + 3]);
    if (pixels[i + 3]) assert.deepEqual(decoded.subarray(i, i + 3), pixels.subarray(i, i + 3));
  }
  await writeFile(`public/navigation/${filename}`, output);
  report.densities.push({ density, baselineSha256: hash(bytes), outputSha256: hash(output), changedExistingVisiblePixels: 0 });
}
await writeFile('site/prepared-navigation-markers.mjs', '// Generated from object-owned marker recipes. Do not edit.\nexport const PREPARED_NAVIGATION_MARKERS = Object.freeze(' + JSON.stringify(markers) + ');\n');
await mkdir('output/galileo-lucy', { recursive: true });
await writeFile('output/galileo-lucy/navigation.json', JSON.stringify(report, null, 2) + '\n');
console.log(report);
