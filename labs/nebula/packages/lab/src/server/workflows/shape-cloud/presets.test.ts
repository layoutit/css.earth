import test from 'node:test';
import assert from 'node:assert/strict';
import type { GeometryMap } from '../../../features/observations/models/geometry-model.ts';
import type { StructureImage } from '../../../features/observations/models/structures-model.ts';
import { initializeShapeCloud } from '../../../features/shape-cloud/model.ts';
import { readShapeCloudPreset, validateShapeCloudPreset } from './presets.ts';
const geometry: GeometryMap = { width: 192, height: 160, groups: [], candidates: [{ id: 'ellipse-1', center: [90, 70], radii: [40, 30],
  angleRadians: .3, score: .8, coverage: .8, supportedArcs: [{ startRadians: 0, endRadians: Math.PI }] }] };
const image: StructureImage = { id: 'source', label: 'Source', sourceSha256: 'a'.repeat(64), sourceUrl: 'https://example.org/source.png', mapSha256: 'b'.repeat(64),
  geometry: { file: 'geometry.json', sha256: 'c'.repeat(64) }, nativeWidth: 192, nativeHeight: 160, width: 192, height: 160,
  imageToFrame: [1,0,0,1,0,0], directory: '.local/nebula-lab/test', credit: 'Test', page: 'https://example.com' };
function fixture() { return { schema: 'cssearth-shape-cloud-fit@1', id: 'tuned', label: 'Tuned', note: 'Authored depth',
  cataloguePath: '.local/nebula-lab/test/catalogue.json', imageId: image.id, sourceSha256: image.sourceSha256,
  mapSha256: image.mapSha256, geometrySha256: image.geometry!.sha256, width: image.width, height: image.height,
  settings: initializeShapeCloud(geometry) }; }
test('saved fits keep their authored values but cannot attach to different source evidence', () => {
  const input = fixture(); input.settings.components[0]!.weight = .23;
  const preset = readShapeCloudPreset(input);
  assert.equal(validateShapeCloudPreset(preset, image, geometry).components[0]!.weight, .23);
  for (const patch of [{ imageId: 'different' }, { sourceSha256: 'd'.repeat(64) }, { mapSha256: 'd'.repeat(64) }, { geometrySha256: 'd'.repeat(64) }, { width: 200 }])
    assert.throws(() => validateShapeCloudPreset({ ...preset, ...patch }, image, geometry));
  preset.settings.components[0]!.memberIds = ['invented'];
  assert.throws(() => validateShapeCloudPreset(preset, image, geometry));
});
test('invalid fit settings and unsafe paths fail before a fit enters the viewer', () => {
  for (const patch of [{ id: '../bad' }, { width: Infinity }, { geometrySha256: '' }, { cataloguePath: '.local/nebula-lab/../bad.json' },
    { settings: { exposure: NaN, components: [] } }]) assert.throws(() => readShapeCloudPreset({ ...fixture(), ...patch }));
});
