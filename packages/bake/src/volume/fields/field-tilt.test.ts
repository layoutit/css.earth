import { test } from 'vitest';
import assert from 'node:assert/strict';
import { createEmissionField, emissionComponentBounds, prepareEmissionComponent, projectEmissionComponent, samplePreparedEmissionComponent } from './emission.ts';
import type { EmissionComponent, EmissionFieldModel } from '../contracts/emission.ts';

function component(gradient?: [number, number]): EmissionComponent {
  return { id: 'patch', basisId: 'patch', center: [2, -3, 11], sigma: [4, 6, 2], angleRadians: .7,
    projectedWeight: .8, depthAssignment: 'halo-diffuse', velocityCovered: false,
    ...(gradient ? { depthGradient: gradient } : {}) };
}
function model(components: EmissionComponent[]): EmissionFieldModel {
  return { schema: 'cssearth-conditional-emission-field@1', identity: 'tilted-field-test', controls: { detail: 1, faint: 1, depth: 1 }, components,
    bounds: { min: [-100, -100, -100], max: [100, 100, 100] }, skyBounds: { min: [-100, -100], max: [100, 100] }, scaffold: null,
    assumptions: { kernel: 'fixture', projectionUnits: 'fixture', depth: 'fixture', halo: 'fixture', haloRadiusArcsec: 100,
      equalNearFarSplit: true, velocityUncoveredComponents: components.length } };
}
function sampler(field: ReturnType<typeof createEmissionField>) {
  const out = new Float64Array(3);
  return (x: number, y: number, z: number) => { field.sampleEmission(x, y, z, out); return out[0]!; };
}

test('tilted finite patches retain their analytic z-integrated light at independent rays', () => {
  const tilted = component([1.6, -.8]), flat = component(), field = createEmissionField(model([tilted])), sample = sampler(field);
  const steps = 16384, dz = (field.bounds.max[2] - field.bounds.min[2]) / steps;
  for (const [x, y] of [[2, -3], [6, 0], [-2, -6], [1, 7], [10, -1]]) {
    let integrated = 0;
    for (let i = 0; i < steps; i++) integrated += sample(x, y, field.bounds.min[2] + (i + .5) * dz) * dz;
    const projected = projectEmissionComponent(tilted, x, y);
    assert.equal(projected, projectEmissionComponent(flat, x, y));
    assert.ok(Math.abs(integrated - projected) < 1e-6, `${x}, ${y}: numerical ${integrated}, analytic ${projected}`);
  }
  assert.ok(field.bounds.max[2] > tilted.center[2] + 4 * tilted.sigma[2], 'bounds must contain light shifted beyond the original z interval');
});

test('sheared support bounds and spatial buckets contain every transformed interior sample', () => {
  const components = [component([2, -.7]), { ...component([-1.2, 1.1]), id: 'second', center: [-30, 20, -50] as [number, number, number], angleRadians: -1.2 }];
  const prepared = components.map(prepareEmissionComponent), field = createEmissionField(model(components)), sample = sampler(field);
  const values = [-3.9, -2, -.4, 0, .7, 2, 3.9];
  for (const original of components) {
    const bounds = emissionComponentBounds(original), cos = Math.cos(original.angleRadians), sin = Math.sin(original.angleRadians);
    for (const u of values) for (const v of values) for (const t of values) {
      const dx = cos * original.sigma[0] * u - sin * original.sigma[1] * v;
      const dy = sin * original.sigma[0] * u + cos * original.sigma[1] * v;
      const point: [number, number, number] = [original.center[0] + dx, original.center[1] + dy,
        original.center[2] + original.depthGradient![0] * dx + original.depthGradient![1] * dy + original.sigma[2] * t];
      assert.ok(point.every((n, axis) => n > bounds.min[axis]! && n < bounds.max[axis]!));
      const direct = prepared.reduce((sum, c) => sum + samplePreparedEmissionComponent(c, ...point), 0), indexed = sample(...point);
      assert.ok(direct > 0);
      assert.ok(Math.abs(indexed - direct) < 1e-15, 'the spatial index must not cull a tilted interior point');
    }
  }
  assert.equal(sample(0, 0, field.bounds.max[2] + 1), 0);
});

test('a side projection follows a continuous tilted patch instead of unchanged vertical columns', () => {
  const patch: EmissionComponent = { ...component(), center: [0, 0, 0], sigma: [4, 3, 1], angleRadians: 0 };
  const tilted = sampler(createEmissionField(model([{ ...patch, depthGradient: [2, .5] }])));
  const flat = sampler(createEmissionField(model([patch])));
  const sideSlope = (sample: typeof tilted) => {
    let xx = 0, xz = 0;
    // Independent x/z image: integrate all y for each side-view pixel.
    for (let iz = 0; iz < 64; iz++) for (let ix = 0; ix < 48; ix++) {
      const x = -16 + (ix + .5) * 32 / 48, z = -46 + (iz + .5) * 92 / 64;
      let light = 0;
      for (let iy = 0; iy < 48; iy++) light += sample(x, -12 + (iy + .5) * .5, z) * .5;
      xx += light * x * x; xz += light * x * z;
    }
    return xz / xx;
  };
  assert.ok(Math.abs(sideSlope(flat)) < 1e-12);
  assert.ok(Math.abs(sideSlope(tilted) - 2) < .01);
  assert.ok(tilted(3, 0, 6) > 0);
  assert.equal(flat(3, 0, 6), 0);
});

test('historical zero gradients preserve values while malformed and unbounded gradients are rejected', () => {
  const historical = createEmissionField(model([component()])), explicit = createEmissionField(model([component([0, 0])]));
  assert.deepEqual(historical.bounds, explicit.bounds);
  const a = sampler(historical), b = sampler(explicit);
  for (let i = 0; i < 300; i++) {
    const p: [number, number, number] = [20 * Math.sin(i), 20 * Math.cos(i * .71), 11 + 8 * Math.sin(i * .17)];
    assert.equal(a(...p), b(...p));
  }
  for (const gradient of [null, [], [1], [0, 0, 0], [NaN, 0], [Infinity, 0], [101, 0], ['1', 0]]) {
    const invalid = JSON.parse(JSON.stringify(model([component()])));
    invalid.components[0].depthGradient = gradient;
    assert.throws(() => createEmissionField(invalid), /depth gradient/);
  }
  assert.doesNotThrow(() => createEmissionField(model([component([100, -100])])));
});
