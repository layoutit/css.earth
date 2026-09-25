import { test } from 'vitest';
import assert from 'node:assert/strict';
import { createEmissionMaterial } from './component-material.ts';
import { createEmissionField, prepareEmissionComponent, samplePreparedEmissionComponent } from '../fields/emission.ts';
import type { EmissionComponent, EmissionFieldModel, EmissionVector3 } from '../contracts/emission.ts';

function model(): EmissionFieldModel {
  const component = (id: string, x: number, z: number): EmissionComponent => ({ id, basisId: id, center: [x, 0, z],
    sigma: [1.5, 1, .5], angleRadians: 0, projectedWeight: 1, depthAssignment: 'halo-diffuse', velocityCovered: false });
  return { schema: 'cssearth-conditional-emission-field@1', identity: 'fixed-components', controls: { detail: 1, faint: 1, depth: 1 },
    components: [component('near-red', -2, -3), component('far-blue', 2, 3)], bounds: { min: [-8, -4, -5], max: [8, 4, 5] },
    skyBounds: { min: [-8, -4], max: [8, 4] }, scaffold: null,
    assumptions: { kernel: 'fixture', projectionUnits: 'fixture', depth: 'fixture', halo: 'fixture', haloRadiusArcsec: 8,
      equalNearFarSplit: true, velocityUncoveredComponents: 2 } };
}
const image = { id: 'red-blue', sampleRgb(x: number, _y: number, out: EmissionVector3) {
  out[0] = x < 0 ? 255 : 0; out[1] = 0; out[2] = x < 0 ? 0 : 255; return true;
} };

test('finite component material retains distinct depth colors where sky footprints overlap; XY extrusion fails', () => {
  const source = model(), original = structuredClone(source), field = createEmissionField(source);
  const material = createEmissionMaterial(source, image, field), near: EmissionVector3 = [0, 0, 0], far: EmissionVector3 = [0, 0, 0];
  function assertDepthColors(sample: typeof material.sampleMaterial) {
    assert.equal(sample(0, 0, -3, near), true); assert.equal(sample(0, 0, 3, far), true);
    assert.ok(near[0] > 240 && near[2] < 15, `Near red material was lost: ${near}`);
    assert.ok(far[2] > 240 && far[0] < 15, `Far blue material was lost: ${far}`);
  }
  assertDepthColors(material.sampleMaterial);
  assert.throws(() => assertDepthColors((x, y, _z, out) => image.sampleRgb(x, y, out)), /Near red material was lost/);
  assert.deepEqual(source, original, 'Material attachment must not change geometry or weights.');
  assert.equal(material.sampleMaterial(0, 0, 0, near), false, 'The empty depth interval must stay empty.');
  assert.match(material.receipt.assumptions.join(' '), /not measured 3D spectroscopy/);
});

test('indexed material shares exact neutral weights and reports incomplete/black coverage', () => {
  const source = model(); source.components[1].center[2] = -3;
  const field = createEmissionField(source), emission: EmissionVector3 = [0, 0, 0], rgb: EmissionVector3 = [0, 0, 0];
  const material = createEmissionMaterial(source, image, field);
  for (const p of [[0, 0, -3], [-1, .5, -3.5], [2, -1, -2.5]] as EmissionVector3[]) {
    const weights = source.components.map(component => samplePreparedEmissionComponent(prepareEmissionComponent(component), ...p));
    field.sampleEmission(...p, emission); assert.equal(emission[0], weights.reduce((a, b) => a + b, 0));
    assert.ok(material.sampleMaterial(...p, rgb));
    for (let c = 0; c < 3; c++) assert.ok(Math.abs(rgb[c] - weights.reduce((sum, weight, index) =>
      sum + weight * material.receipt.components[index].rgb[c], 0) / emission[0]) < 1e-10);
  }
  const partial = createEmissionMaterial(source, { id: 'partial', sampleRgb(x, _y, out) {
    out[0] = 255; out[1] = out[2] = 0; return x < 0;
  } });
  assert.ok(partial.receipt.components.every(c => c.observedKernelFraction > 0 && c.observedKernelFraction < 1));
  const blank = createEmissionMaterial(source, { id: 'black', sampleRgb(_x, _y, out) { out[0] = out[1] = out[2] = 0; return true; } });
  assert.equal(blank.sampleMaterial(-2, 0, -3, rgb), false);
  assert.ok(blank.receipt.components.every(c => c.observedKernelFraction === 1 && c.coloredKernelFraction === 0));
  assert.throws(() => createEmissionMaterial(source, { id: 'invalid', sampleRgb(_x, _y, out) { out[0] = NaN; return true; } }), /invalid RGB/);
});

test('colors stay attached to existing emitters when depth changes; coincident projections remain explicitly ambiguous', () => {
  const first = model(), moved = structuredClone(first); moved.components[0].center[2] = 20; moved.components[0].depthGradient = [1, -.5];
  const a = createEmissionMaterial(first, image), b = createEmissionMaterial(moved, image);
  assert.deepEqual(a.receipt.components, b.receipt.components);
  const coincident = model(); coincident.components[1].center[0] = coincident.components[0].center[0];
  const ambiguous = createEmissionMaterial(coincident, image);
  assert.deepEqual(ambiguous.receipt.components[0].rgb, ambiguous.receipt.components[1].rgb,
    'A single image cannot identify different colors at identical projected supports.');
  assert.match(ambiguous.receipt.assumptions.join(' '), /color-degenerate/);
});
