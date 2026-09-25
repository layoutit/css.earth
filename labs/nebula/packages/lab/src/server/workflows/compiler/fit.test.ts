import assert from 'node:assert/strict';
import test from 'node:test';
import { fitEmissionField } from './fit.ts';
import { createEmissionField, emissionKernel, EMISSION_KERNEL_INTEGRAL, projectEmissionComponent, readCompilerControls, type EmissionFieldModel, type EmissionFitInput, createEmissionWindowSampler, type EmissionWindow } from '@cssearth/bake/volume';

function target(size = 128): EmissionFitInput {
  const values = new Float32Array(size * size);
  // Independent elongated/asymmetric ordinary Gaussians, not the fitter's compact basis.
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const px = -200 + (x + .5) * 400 / size, py = 200 - (y + .5) * 400 / size;
    values[y * size + x] = .7 * Math.exp(-.5 * (((px + 45) / 28) ** 2 + ((py - 25) / 12) ** 2))
      + .45 * Math.exp(-.5 * (((px - 35) / 15) ** 2 + ((py + 35) / 31) ** 2))
      + .12 * Math.exp(-.5 * (((px - 110) / 21) ** 2 + ((py - 60) / 17) ** 2));
  }
  return { target: values, width: size, height: size, bounds: { min: [-200, -200], max: [200, 200] },
    scaffold: { family: 'ellipsoid', radiusArcsec: 100, depthRatio: 1.4, inclinationDegrees: 30, positionAngleDegrees: 25, expansionKmS: 20, systemicLsrKmS: -10 },
    velocityCoverage: [{ x: -45, y: 25, radiusArcsec: 40 }] };
}
function value(field: ReturnType<typeof createEmissionField>, x: number, y: number, z: number): number {
  const out = new Float64Array(3); field.sampleEmission(x, y, z, out); assert.equal(out[0], out[1]); assert.equal(out[1], out[2]); return out[0];
}
function singleModel(): EmissionFieldModel {
  return { schema: 'cssearth-conditional-emission-field@1', identity: 'analytic', controls: { detail: 1, faint: 1, depth: 1 }, bounds: { min: [-100, -100, -100], max: [100, 100, 100] },
    skyBounds: { min: [-50, -50], max: [50, 50] }, scaffold: null,
    components: [{ id: 'g', basisId: 'g', center: [2, -3, 11], sigma: [4, 6, 9], angleRadians: 0, projectedWeight: .8, depthAssignment: 'halo-far', velocityCovered: false }],
    assumptions: { kernel: 'test', projectionUnits: 'test', depth: 'test', halo: 'test', haloRadiusArcsec: 20, equalNearFarSplit: true, velocityUncoveredComponents: 1 } };
}

test('a fitted optical window has the same clipped projection and numerical XYZ integral after serialization', () => {
  const emissionWindow: EmissionWindow = { sourceId: 'optical', polygonArcsec: [[-90, 80], [95, 35], [65, -95], [-120, -50]], featherArcsec: 15, interpretation: 'Display crop.' };
  const input = { ...target(64), emissionWindow }, window = createEmissionWindowSampler(emissionWindow), dx = 400 / input.width;
  input.target = Float32Array.from(input.target, (n, p) => n * window(-200 + (p % input.width + .5) * dx, 200 - (Math.floor(p / input.width) + .5) * dx));
  const fitted = fitEmissionField(input, { detail: .2, faint: .5, depth: 1 });
  assert.deepEqual(fitted.field.emissionWindow, emissionWindow);
  const field = createEmissionField(fitted.field), steps = 2048, dz = (field.bounds.max[2] - field.bounds.min[2]) / steps;
  let outside = 0;
  for (let p = 0; p < fitted.projection.length; p++) {
    const x = -200 + (p % input.width + .5) * dx, y = 200 - (Math.floor(p / input.width) + .5) * dx;
    if (window(x, y) === 0) { outside++; assert.equal(fitted.projection[p], 0); assert.equal(value(field, x, y, 0), 0); }
    if (p % 149 !== 0) continue;
    let integrated = 0;
    for (let z = 0; z < steps; z++) integrated += value(field, x, y, field.bounds.min[2] + (z + .5) * dz) * dz;
    assert.ok(Math.abs(integrated - fitted.projection[p]!) < 1e-6);
  }
  assert.ok(outside > 2000); assert.ok(fitted.metrics.afterRmse < fitted.metrics.beforeRmse / 3);
});
test('finite smooth neutral field retains XYZ support and its actual z integral matches the analytic projection', () => {
  const model = singleModel(), field = createEmissionField(model), center = model.components[0].center;
  assert.equal(field.empty, false);
  assert.ok(value(field, center[0] + 2, center[1], center[2]) > 0);
  assert.ok(value(field, center[0], center[1] + 2, center[2]) > 0);
  assert.ok(value(field, center[0], center[1], center[2] + 2) > 0);
  assert.equal(value(field, 100, 100, 100), 0); assert.equal(value(field, 0, 0, field.bounds.max[2]), 0);
  const integrate = (axis: number) => {
    const steps = 4096, step = (field.bounds.max[axis] - field.bounds.min[axis]) / steps; let integral = 0;
    for (let i = 0; i < steps; i++) { const p = [...center]; p[axis] = field.bounds.min[axis] + (i + .5) * step; integral += value(field, p[0], p[1], p[2]) * step; }
    return integral;
  };
  assert.ok(Math.abs(integrate(2) - .8) < 1e-6);
  assert.ok(Math.abs(integrate(0) - .8 * 4 / 9) < 1e-6);
  assert.ok(Math.abs(integrate(1) - .8 * 6 / 9) < 1e-6);
  assert.ok(Math.abs(projectEmissionComponent(model.components[0], center[0], center[1]) - .8) < 1e-12);
  assert.equal(emissionKernel(4), 0); assert.ok(emissionKernel(3.999) < 1e-10); assert.ok(EMISSION_KERNEL_INTEGRAL > 1);
});
test('positive multiscale fit improves an independent irregular target and retains all unassigned and excess signal', () => {
  const input = target(), original = Float32Array.from(input.target), fit = fitEmissionField(input, { detail: .65, faint: .6, depth: 1 });
  assert.ok(fit.field.components.length > 20); assert.ok(fit.field.components.length <= 363);
  assert.ok(fit.metrics.relativeSquaredError < .08, `relative error ${fit.metrics.relativeSquaredError}`);
  assert.ok(fit.metrics.afterRmse < fit.metrics.beforeRmse / 3);
  for (let i = 1; i < fit.metrics.objectiveHistory.length; i++) assert.ok(fit.metrics.objectiveHistory[i] <= fit.metrics.objectiveHistory[i - 1] + 1e-8);
  for (let p = 0; p < input.target.length; p++) {
    assert.ok(Math.abs(fit.projection[p] + fit.residual[p] - input.target[p]) < 1e-6);
    assert.equal(fit.unassigned[p], Math.max(0, fit.residual[p]));
  }
  assert.deepEqual(input.target, original);
  assert.ok(fit.field.components.some(c => c.depthAssignment.startsWith('halo')));
  assert.ok(fit.field.components.some(c => c.velocityCovered)); assert.ok(fit.field.components.some(c => !c.velocityCovered));
  const field = createEmissionField(fit.field); assert.equal(value(field, 1000, 1000, 1000), 0);
});
test('depth control changes only conditional depth and thickness while preserving integrated projection and deterministic shared geometry', () => {
  const input = target(96), a = fitEmissionField(input, { detail: .4, faint: .5, depth: 1 });
  const repeat = fitEmissionField(input, { detail: .4, faint: .5, depth: 1 });
  assert.deepEqual(repeat.field, a.field); assert.deepEqual(repeat.projection, a.projection);
  const deeper = fitEmissionField(input, { detail: .4, faint: .5, depth: 2 });
  assert.deepEqual(deeper.projection, a.projection); assert.equal(deeper.field.components.length, a.field.components.length);
  for (let i = 0; i < a.field.components.length; i++) {
    assert.deepEqual(deeper.field.components[i].center.slice(0, 2), a.field.components[i].center.slice(0, 2));
    assert.equal(deeper.field.components[i].center[2], a.field.components[i].center[2] * 2);
    assert.equal(deeper.field.components[i].sigma[2], a.field.components[i].sigma[2] * 2);
  }
  const grouped = new Map<string, number[]>();
  for (const component of a.field.components) { const depths = grouped.get(component.basisId) ?? []; depths.push(component.center[2]); grouped.set(component.basisId, depths); }
  assert.ok([...grouped.values()].some(depths => depths.length >= 2 && depths[0] < -20 && depths.at(-1)! > 20));
});
test('unconstrained emission stays diffuse around zero depth without a footprint-sized shell and retains its integrated light', () => {
  const input = target(96), fit = fitEmissionField(input), halo = fit.field.components.filter(c => c.depthAssignment.startsWith('halo'));
  assert.ok(halo.length > 0);
  const extent = 140; // This fixture's longest scaffold radius is 100 × 1.4 arcsec.
  assert.equal(fit.field.assumptions.diffuseDepthExtentArcsec, extent);
  for (const c of halo) {
    assert.equal(c.depthAssignment, 'halo-diffuse'); assert.equal(c.center[2], 0); assert.equal(c.velocityCovered, false);
    assert.ok(c.sigma[2] >= extent / 8 && c.sigma[2] <= extent / 4);
  }
  const diffuse = createEmissionField({ ...fit.field, components: halo });
  assert.ok(diffuse.bounds.min[2] >= -extent && diffuse.bounds.max[2] <= extent);
  const strongest = halo.reduce((a, b) => a.projectedWeight > b.projectedWeight ? a : b);
  const [x, y] = strongest.center, central = value(diffuse, x, y, 0);
  assert.ok(central > 0);
  let previous = central;
  for (let z = 1; z <= extent; z++) {
    const next = value(diffuse, x, y, z);
    assert.ok(next <= previous); assert.equal(next, value(diffuse, x, y, -z)); previous = next;
  }
  // Numerical integration of the actual 3D sampler must reproduce the fitted raster,
  // including where differently assigned depths overlap; no per-ray adjustment is used.
  const field = createEmissionField(fit.field), dx = 400 / input.width, col = Math.floor((x + 200) / dx), row = Math.floor((200 - y) / dx);
  const px = -200 + (col + .5) * dx, py = 200 - (row + .5) * dx;
  const steps = 4096, dz = (field.bounds.max[2] - field.bounds.min[2]) / steps;
  let integrated = 0;
  for (let i = 0; i < steps; i++) integrated += value(field, px, py, field.bounds.min[2] + (i + .5) * dz) * dz;
  assert.ok(Math.abs(integrated - fit.projection[row * input.width + col]) < 1e-6);

  const unscaffolded = { ...target(64), scaffold: undefined }, smaller = fitEmissionField(unscaffolded);
  const paddedTarget = new Float32Array(128 * 128);
  for (let y = 0; y < 64; y++) paddedTarget.set(unscaffolded.target.subarray(y * 64, (y + 1) * 64), (y + 32) * 128 + 32);
  const padded = fitEmissionField({ ...unscaffolded, width: 128, height: 128, target: paddedTarget, bounds: { min: [-400, -400], max: [400, 400] } });
  assert.ok(Math.abs(smaller.field.assumptions.diffuseDepthExtentArcsec! - padded.field.assumptions.diffuseDepthExtentArcsec!) < 1e-9);
  assert.ok(padded.field.components.every(c => c.center[2] === 0 && c.depthAssignment === 'halo-diffuse'));
});
test('unobserved values cannot fit components and blank targets never become a slab or stellar plane', () => {
  const input = target(64); input.coverage = new Uint8Array(input.target.length).fill(1);
  for (let p = 0; p < input.target.length; p++) if (p % 64 < 20) input.coverage[p] = 0;
  const a = fitEmissionField(input, { detail: .2, faint: .5, depth: 1 });
  const hidden = { ...input, target: Float32Array.from(input.target, (v, p) => input.coverage![p] ? v : 100) };
  const b = fitEmissionField(hidden, { detail: .2, faint: .5, depth: 1 });
  assert.deepEqual(b.field, a.field); assert.deepEqual(b.projection, a.projection);
  const blank = { ...input, target: new Float32Array(input.target.length) }, empty = fitEmissionField(blank);
  assert.equal(empty.field.components.length, 0); assert.equal(createEmissionField(empty.field).empty, true); assert.ok(empty.projection.every(v => v === 0));
  assert.throws(() => readCompilerControls({ detail: 2, faint: 0, depth: 1 }));
});
