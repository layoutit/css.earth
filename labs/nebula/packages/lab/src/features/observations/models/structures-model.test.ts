import assert from 'node:assert/strict';
import test from 'node:test';
import { observationFitStorageKey } from './model.js';
import { readDecisions, readReviewMap, readStructureCatalogue, reviewStorageKey, structureLayers } from './structures-model.js';

function fixture() {
  const catalogue = readStructureCatalogue({ schema: 'cssearth-observation-structures@1',
    frame: { width: 1024, height: 1024, fieldArcminutes: [60, 60], centerIcrsDegrees: [12, -20], northUp: true },
    images: [{ id: 'source-a', label: 'Source A', sourceSha256: 'a'.repeat(64), sourceUrl: 'https://example.org/source-a.png', mapSha256: 'b'.repeat(64),
      nativeWidth: 6000, nativeHeight: 4000, width: 600, height: 400, imageToFrame: [.12, .04, -.04, .12, 170, 50],
      directory: '.local/structures/a', page: 'https://example.org/source', credit: 'Source credit' }] });
  const image = catalogue.images[0]!;
  const map = { schema: 'cssearth-observation-structure-map@1', id: image.id, dimensions: { width: 600, height: 400 },
    nativeWidth: 6000, nativeHeight: 4000, imageToFrame: [...image.imageToFrame], source: { sha256: image.sourceSha256, width: 6000, height: 4000 },
    panels: structureLayers.map(id => ({ id, label: id, file: `${id}.png`, description: 'Prepared full frame' })),
    metrics: { reconstructionMaxError: 1e-8, unassignedFraction: .2 },
    atlases: [{ file: 'regions.png', width: 128, height: 128, sha256: 'c'.repeat(64) }],
    regions: [{ id: 's2-0', scale: 2, morphology: 'elongated', bounds: { x: 20, y: 30, width: 10, height: 20 },
      centroid: [24.5, 39.5], areaPixels: 80, contrast: .2, elongation: 3,
      atlas: { index: 0, x: 15, y: 25, width: 10, height: 20 } }] };
  return { catalogue, image, map };
}

test('review maps reject changed native registration or source even at the same working size', () => {
  const { image, map } = fixture();
  assert.equal(readReviewMap(map, image).regions.length, 1);
  for (const changed of [{ ...map, id: 'source-b' }, { ...map, source: { ...map.source, sha256: 'd'.repeat(64) } },
    { ...map, nativeWidth: 6001 }, { ...map, imageToFrame: [.12, .04, -.04, .12, 171, 50] }])
    assert.throws(() => readReviewMap(changed, image), /registration or source/);
});

test('review sprites must fit both their image bounds and prepared atlas support extent', () => {
  const { image, map } = fixture(), region = map.regions[0]!;
  assert.throws(() => readReviewMap({ ...map, regions: [{ ...region, atlas: { ...region.atlas, x: 127 } }] }, image), /outside/);
  assert.throws(() => readReviewMap({ ...map, regions: [{ ...region, bounds: { ...region.bounds, x: 599 } }] }, image), /outside/);
  assert.throws(() => readReviewMap({ ...map, regions: [{ ...region, atlas: { ...region.atlas, width: 9 } }] }, image), /outside/);
});

test('review identity is isolated by source and exact output; missing decisions remain unreviewed', () => {
  const { image } = fixture(), path = '.local/structures/catalogue.json';
  assert.notEqual(reviewStorageKey(path, image), reviewStorageKey(path, { ...image, mapSha256: 'd'.repeat(64) }));
  assert.notEqual(reviewStorageKey(path, image), reviewStorageKey(path, { ...image, sourceSha256: 'd'.repeat(64) }));
  assert.deepEqual(readDecisions(null), {});
  assert.deepEqual(readDecisions({ a: 'keep', b: 'unsure', c: 'reject', d: 'depth', e: null }), { a: 'keep', b: 'unsure', c: 'reject' });
  assert.equal(observationFitStorageKey('observations.json', { id: image.id, source: { url: 'https://example.org/source' } }),
    `nebula-observation-fit@1:observations.json:${image.id}:https://example.org/source`);
});
