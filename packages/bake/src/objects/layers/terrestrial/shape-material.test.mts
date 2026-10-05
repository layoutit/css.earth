import assert from 'node:assert/strict';
import { sourceTest } from '@cssearth/objects/node/source-test';
import { MEASURED_SHAPE_MATERIAL, SHAPE_MATERIAL, neutralShapeViews, shapeFillIllumination, shapeMaterialColor, shapeMaterialRaster } from '@cssearth/bake/objects/layers/terrestrial';
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

test('the neutral refresh tools leave a view that names its measured color alone', () => {
  const views = [{ id: 'shape' }, { id: 'color', science: { kind: MEASURED_SHAPE_MATERIAL.kind } }];
  assert.deepEqual(neutralShapeViews(views).map(view => view.id), ['shape']);
  assert.deepEqual(neutralShapeViews(undefined), []);
});
