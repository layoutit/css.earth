import { test } from 'vitest';
import assert from 'node:assert/strict';
import { createEmissionWindowSampler, readEmissionWindow, type EmissionWindow } from './emission-window.ts';
import { createEmissionField, prepareEmissionComponent, projectEmissionComponent, samplePreparedEmissionComponent } from './emission.ts';
import { readRetainedEmissionField } from './retained-emission.ts';
import type { EmissionFieldModel, EmissionVector3 } from '../contracts/emission.ts';

const window: EmissionWindow = { sourceId: 'optical', polygonArcsec: [[-5, -4], [-2, -1], [-5, 2], [-8, -1]],
  featherArcsec: .5, interpretation: 'Authored display footprint, not a physical edge.' };
function model(emissionWindow?: EmissionWindow): EmissionFieldModel {
  return { schema: 'cssearth-conditional-emission-field@1', identity: 'window-test', controls: { detail: 1, faint: 1, depth: 1 },
    components: [{ id: 'a', basisId: 'a', center: [-5, -1, -.7], sigma: [2, 1.5, .6], angleRadians: .3, depthGradient: [.2, -.1],
      projectedWeight: 1, depthAssignment: 'halo-diffuse', velocityCovered: false }],
    bounds: { min: [-20, -20, -10], max: [10, 10, 10] }, skyBounds: { min: [-20, -20], max: [10, 10] }, scaffold: null,
    ...(emissionWindow === undefined ? {} : { emissionWindow }),
    assumptions: { kernel: 'test', projectionUnits: 'test', depth: 'test', halo: 'test', haloRadiusArcsec: 10,
      equalNearFarSplit: true, velocityUncoveredComponents: 1 } };
}

test('rotated negative-coordinate footprint accepts either winding and tapers inward only', () => {
  const sample = createEmissionWindowSampler(window), reverse = createEmissionWindowSampler({ ...window, polygonArcsec: [...window.polygonArcsec].reverse() });
  const x = -3.5 - .25 / Math.sqrt(2), y = .5 - .25 / Math.sqrt(2);
  for (const [px, py, expected] of [[-5, -1, 1], [-2, -1, 0], [-5, -4, 0], [-3.5, .5, 0], [-2, 1, 0], [-9, -1, 0], [x, y, .5]]) {
    assert.ok(Math.abs(sample(px, py) - expected) < 1e-12, `${px},${py}: ${sample(px, py)}`);
    assert.equal(reverse(px, py), sample(px, py));
  }
  assert.equal(createEmissionWindowSampler({ ...window, featherArcsec: 0 })(x, y), 1);
  assert.equal(sample(NaN, 0), 0);
  assert.equal(sample(0, Infinity), 0);
  const saved = structuredClone(window), fixed = createEmissionWindowSampler(saved);
  saved.polygonArcsec[0][0] = 200;
  assert.equal(fixed(-5, -1), 1, 'Sampling retains the validated snapshot.');
});

test('external window decoder rejects nonfinite, concave, crossing, degenerate and unknown data', () => {
  for (const invalid of [null, {}, { ...window, sourceId: '' }, { ...window, interpretation: '' }, { ...window, featherArcsec: -1 },
    { ...window, featherArcsec: Infinity }, { ...window, featherArcsec: '1' }, { ...window, extra: true },
    { ...window, polygonArcsec: [[0, 0], [1, 0], [1, 1]] },
    { ...window, polygonArcsec: [[0, 0], [1, 1], [0, 1], [1, 0]] },
    { ...window, polygonArcsec: [[0, 0], [2, 0], [.5, .5], [0, 2]] },
    { ...window, polygonArcsec: [[0, 0], [1, 0], [2, 0], [0, 1]] },
    { ...window, polygonArcsec: [[0, 0], [1, 0], [1, Infinity], [0, 1]] },
    { ...window, polygonArcsec: [[-1e308, 0], [1e308, 0], [1e308, 1], [-1e308, 1]] },
    { ...window, polygonArcsec: [[-1e308, 0], [0, -1e308], [1e308, 0], [0, 1e308]] }])
    assert.throws(() => readEmissionWindow(invalid), /[Ee]mission window/);
});

test('window acts on the actual XYZ field, preserves interior material, and limits integrated projection', () => {
  const plainModel = model(), croppedModel = model(window), plain = createEmissionField(plainModel), cropped = createEmissionField(croppedModel);
  const color: EmissionVector3 = [20, 130, 240], plainMaterial = plain.createMaterialSampler([{ rgb: color, covered: true }]),
    croppedMaterial = cropped.createMaterialSampler([{ rgb: color, covered: true }]), weight = createEmissionWindowSampler(window);
  assert.deepEqual(cropped.bounds, plain.bounds, 'Display selection must not rewrite full component bounds.');
  for (const [x, y] of [[-5, -1], [-3.5 - .25 / Math.sqrt(2), .5 - .25 / Math.sqrt(2)], [-2, 1], [-3.5, .5]]) {
    const original: EmissionVector3 = [0, 0, 0], output: EmissionVector3 = [0, 0, 0], material: EmissionVector3 = [0, 0, 0];
    let integral = 0;
    const steps = 3000, dz = (cropped.bounds.max[2] - cropped.bounds.min[2]) / steps;
    for (let index = 0; index < steps; index++) {
      const z = cropped.bounds.min[2] + (index + .5) * dz;
      plain.sampleEmission(x, y, z, original); cropped.sampleEmission(x, y, z, output);
      assert.equal(output[0], original[0] * weight(x, y));
      integral += output[0] * dz;
      const visible = croppedMaterial(x, y, z, material);
      if (weight(x, y) === 0) assert.equal(visible, false);
      else if (visible) { plainMaterial(x, y, z, original); assert.deepEqual(material, original); }
    }
    const expected = projectEmissionComponent(croppedModel.components[0], x, y) * weight(x, y);
    assert.ok(Math.abs(integral - expected) < 2e-6, `${integral} != ${expected}`);
    if (weight(x, y) === 0) assert.equal(integral, 0, 'Outside emission must be exactly empty at every depth.');
  }
});

test('absent window preserves exact historical emission and retained model validation keeps the selection', () => {
  const source = model(), field = createEmissionField(source), component = prepareEmissionComponent(source.components[0]);
  for (const xyz of [[-5, -1, -.7], [-3, .2, 1], [-8, -2, -1], [0, 0, 0]] as EmissionVector3[]) {
    const output: EmissionVector3 = [0, 0, 0]; field.sampleEmission(...xyz, output);
    assert.equal(output[0], samplePreparedEmissionComponent(component, ...xyz));
    assert.equal(createEmissionWindowSampler()(...[xyz[0], xyz[1]]), 1);
  }
  const retained = readRetainedEmissionField(model(window));
  assert.deepEqual(retained.emissionWindow, window);
  const out: EmissionVector3 = [0, 0, 0]; createEmissionField(retained).sampleEmission(-2, 1, -.7, out);
  assert.deepEqual(out, [0, 0, 0], 'Retained material/star preparation must not resurrect cropped emission.');
  const missing = structuredClone(retained); delete missing.emissionWindow;
  createEmissionField(missing).sampleEmission(-2, 1, -.7, out);
  assert.throws(() => assert.deepEqual(out, [0, 0, 0]), 'Deleting the crop must fail the outside-emission guarantee.');
  assert.equal(readRetainedEmissionField(source).emissionWindow, undefined);
  assert.throws(() => readRetainedEmissionField({ ...source, emissionWindow: { ...window, polygonArcsec: [] } }), /[Ee]mission window/);
});
