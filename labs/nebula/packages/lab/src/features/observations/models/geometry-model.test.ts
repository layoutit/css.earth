import assert from 'node:assert/strict';
import test from 'node:test';
import { ellipseArcPath, readGeometryMap } from './geometry-model.js';
import { readStructureCatalogue } from './structures-model.js';

function fixture() {
  const raw = { schema: 'cssearth-observation-structures@1',
    frame: { width: 1024, height: 1024, fieldArcminutes: [60, 60], centerIcrsDegrees: [12, -20], northUp: true },
    images: [{ id: 'image-a', label: 'Image A', sourceUrl: 'https://example.org/image-a.png',
      nativeWidth: 6000, nativeHeight: 4000, width: 600, height: 400, imageToFrame: [.12, .04, -.04, .12, 170, 50],
      directory: '.local/structures/a', page: 'https://example.org/source', credit: 'Source credit', geometry: { file: 'geometry.json' } }] };
  const image = readStructureCatalogue(raw).images[0]!;
  const geometry = { schema: 'cssearth-observation-geometry@1', imageId: image.id, mapDirectory: image.directory,
    width: 600, height: 400, candidates: [{ id: 'ellipse-1', center: [310, 190], radii: [120, 80], angleRadians: .2, score: .8, coverage: .5,
      supportedArcs: [{ startRadians: 0, endRadians: Math.PI }], groupId: 'group-1' },
    { id: 'ellipse-2', center: [309, 189], radii: [160, 110], angleRadians: .22, score: .7, coverage: .5,
      supportedArcs: [{ startRadians: Math.PI, endRadians: 2 * Math.PI }], groupId: 'group-1' }],
    groups: [{ id: 'group-1', members: ['ellipse-1', 'ellipse-2'], center: [309.5, 189.5] }] };
  return { raw, image, geometry };
}

test('prepared geometry is bound to its image, structure run and working image grid', () => {
  const { image, geometry } = fixture();
  assert.equal(readGeometryMap(geometry, image).candidates.length, 2);
  for (const changed of [{ imageId: 'other' }, { mapDirectory: '.local/structures/b' }, { width: 599 }, { height: 399 }])
    assert.throws(() => readGeometryMap({ ...geometry, ...changed }, image), /structure map/);
});

test('geometry boundary rejects invalid radii, support, scores and symmetry membership', () => {
  const { image, geometry } = fixture(), candidate = geometry.candidates[0]!;
  for (const changed of [{ radii: [10, 20] }, { radii: [10, 0] }, { center: [NaN, 2] }, { coverage: 1.1 }, { score: -1 },
    { angleRadians: Infinity }, { groupId: 'absent' }, { supportedArcs: [{ startRadians: 2, endRadians: 1 }] },
    { supportedArcs: [{ startRadians: 0, endRadians: 4 }, { startRadians: 3, endRadians: 5 }] }])
    assert.throws(() => readGeometryMap({ ...geometry, candidates: [{ ...candidate, ...changed }, geometry.candidates[1]] }, image));
  assert.throws(() => readGeometryMap({ ...geometry, groups: [{ ...geometry.groups[0], members: ['ellipse-1', 'absent'] }] }, image));
  assert.throws(() => readGeometryMap({ ...geometry, candidates: [candidate, candidate] }, image));
});

test('optional geometry references name one relative file', () => {
  const { raw, image } = fixture();
  assert.deepEqual(image.geometry, { file: 'geometry.json' });
  for (const geometry of [{ file: '../geometry.json' }, { file: 'geometry.json', bytes: 1 }])
    assert.throws(() => readStructureCatalogue({ ...raw, images: [{ ...raw.images[0], geometry }] }), /geometry reference/);
});

test('complete ellipse support decodes into two non-degenerate SVG arcs', () => {
  const path = ellipseArcPath([20, 10], 0, 2 * Math.PI);
  assert.match(path, /^M 20 0 A 20 10 0 0 1 -20 /);
  assert.equal(path.split(' A ').length, 3);
});
