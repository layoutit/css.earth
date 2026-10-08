import assert from 'node:assert/strict';
import { sourceTest } from '@cssearth/objects/node/source-test';
import { MEASURED_SHAPE_MATERIAL, SHAPE_MATERIAL, neutralShapeViews, shapeFaceColors, shapeFillIllumination, shapeLitIllumination, shapeMaterialColor, shapeMaterialRaster } from '@cssearth/bake/objects/layers/terrestrial';
const test = sourceTest();

test('a shape material is the neutral gray or one measured color, and nothing else', () => {
  assert.deepEqual(shapeMaterialColor({ kind: 'unobserved-neutral', color: SHAPE_MATERIAL.color }), [128, 128, 128]);
  assert.deepEqual(shapeMaterialColor({ kind: MEASURED_SHAPE_MATERIAL.kind, color: '#4d453a' }), [0x4d, 0x45, 0x3a]);
  assert.equal(shapeMaterialColor({ kind: 'photograph', color: '#4d453a' }), null);
  assert.equal(shapeMaterialColor(undefined), null);
  assert.throws(() => shapeMaterialColor({ kind: MEASURED_SHAPE_MATERIAL.kind, color: 'brown' }), /#rrggbb/u);
});

test('the material raster is uniform in the color it is given, neutral by default', () => {
  assert.deepEqual([...shapeMaterialRaster(2, 1)], [128, 128, 128, 128, 128, 128]);
  assert.deepEqual([...shapeMaterialRaster(2, 1, [77, 69, 58])], [77, 69, 58, 77, 69, 58]);
  assert.throws(() => shapeMaterialRaster(0, 1), /positive integer/u);
});

test('the gentle fill keeps a measured hue: every channel takes the same factor', () => {
  const color = [77, 69, 58] as const, fill = shapeFillIllumination(-1);
  assert.equal(fill, 0.55);
  const shaded = color.map(channel => channel * fill);
  assert.ok(Math.abs(shaded[0]! / shaded[2]! - color[0] / color[2]) < 1e-12);
});

test('a face takes one color for Shadows off and one for Shadows on, from the laws the atlases painted', () => {
  const toward = [0, 0, 1], away = [0, 0, -1], side = [1, 0, 0];
  const faces = [{ vertexNormals: [toward, toward, toward] }, { vertexNormals: [away, away, away] }, { vertexNormals: [side, side, side] }];
  const gray = shapeFaceColors(faces, [0, 0, 1]);
  // Facing the Sun: the full material both ways. Facing away: the 55% fill, and the 12% floor with Shadows on.
  assert.deepEqual(gray.flood, ['#808080', '#464646', '#636363']);
  assert.deepEqual(gray.shadow, ['#808080', '#0f0f0f', '#0f0f0f']);
  assert.equal(shapeLitIllumination(-1), 0.12);
  // A measured color keeps its hue: every channel takes the face's one factor.
  assert.deepEqual(shapeFaceColors(faces.slice(1, 2), [0, 0, 1], [77, 69, 58]), { flood: ['#2a2620'], shadow: ['#090807'] });
  // A face that curves from the Sun to the terminator is the mean of its own shading, not its centre's.
  const curved = shapeFaceColors([{ vertexNormals: [toward, side, side] }], [0, 0, 1]);
  assert.ok(curved.shadow[0]! > '#0f0f0f' && curved.shadow[0]! < '#808080' && curved.flood[0]! > '#636363');
  assert.throws(() => shapeFaceColors(faces, [0, 0]), /Sun direction/u);
  assert.throws(() => shapeFaceColors([{ vertexNormals: [toward, toward] }], [0, 0, 1]), /three vertex normals/u);
});

test('the neutral refresh tools leave a view that names its measured color alone', () => {
  const views = [{ id: 'shape' }, { id: 'color', science: { kind: MEASURED_SHAPE_MATERIAL.kind } }];
  assert.deepEqual(neutralShapeViews(views).map(view => view.id), ['shape']);
  assert.deepEqual(neutralShapeViews(undefined), []);
});
