import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPhotometricMgePrior, readPhotometricMgeRecipe, type PhotometricMgeRecipe } from './photometric-mge.ts';
import { conditionSimulationComponents, type SimulationDepthSettings } from './simulation-guided.ts';
import { projectEmissionComponent, type EmissionComponent } from '@cssearth/bake/volume';

const recipe: PhotometricMgeRecipe = {
  schema: 'cssearth-photometric-mge@1', id: 'fixture', centerIcrsDegrees: [201, -47], distancePc: 5426,
  positionAngleEastOfNorthDegrees: 0, inclinationDegrees: 60, lineOfSightTiltSign: 1, cutoffSigma: 6,
  gaussians: [{ centralAmplitude: 4, sigmaArcsec: 20, projectedAxisRatio: .8 }],
  evidence: { path: 'labs/nebula/models/fixture/evidence.json' },
  source: { url: 'https://example.org/observations', locator: 'test fixture' },
  interpretation: 'Oblate deprojection test, not an observed object.',
};
function column(model: PhotometricMgeRecipe, x: number, y: number) {
  const prior = createPhotometricMgePrior(model), n = 4096, dz = (prior.bounds.max[2] - prior.bounds.min[2]) / n;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += prior.sampleDensity(x, y, prior.bounds.min[2] + (i + .5) * dz) * dz;
  return sum;
}

test('deprojection integrates back to the published projected ellipse at different inclinations', () => {
  for (const inclinationDegrees of [45, 60, 85]) {
    const model = { ...recipe, inclinationDegrees };
    assert.ok(Math.abs(column(model, 0, 0) - 1) < 1e-6);
    // PA=0 is north-south; west is the shorter projected axis.
    assert.ok(Math.abs(column(model, 0, 20) - Math.exp(-.5)) < 1e-6);
    assert.ok(Math.abs(column(model, 20, 0) - Math.exp(-.5 / .8 ** 2)) < 1e-6);
  }
  assert.ok(Math.abs(column({ ...recipe, positionAngleEastOfNorthDegrees: 90 }, 20, 0) - Math.exp(-.5)) < 1e-6);
});

test('line-of-sight mirror is an explicit degeneracy and source pins participate in identity', () => {
  const first = createPhotometricMgePrior(recipe), mirror = createPhotometricMgePrior({ ...recipe, lineOfSightTiltSign: -1 });
  assert.equal(first.sampleDensity(10, 7, 13), mirror.sampleDensity(10, 7, -13));
  assert.notEqual(first.identity, mirror.identity);
  assert.throws(() => readPhotometricMgeRecipe({ ...recipe, inclinationDegrees: 20 }), /cannot be deprojected/);
  assert.throws(() => readPhotometricMgeRecipe({ ...recipe, lineOfSightTiltSign: '1' }), /Invalid/);
});

test('conditional finite features fill the prior depth distribution instead of collapsing into its modal plane', () => {
  const prior = createPhotometricMgePrior({ ...recipe, gaussians: [{ centralAmplitude: 1, sigmaArcsec: 20, projectedAxisRatio: 1 }] });
  const components: EmissionComponent[] = Array.from({ length: 500 }, (_, i) => ({
    id: `feature-${i}`, basisId: 'fixture', center: [0, 0, 0], sigma: [1, 1, 1], angleRadians: 0,
    projectedWeight: 1, depthAssignment: 'halo-diffuse', velocityCovered: false,
  }));
  const settings: SimulationDepthSettings = { depthSamples: 2048, modeRelativeThreshold: .1, maximumModes: 1,
    minimumSigmaZ: .5, maximumSigmaZ: 2, featureThicknessRatio: 1, supportSigma: 4, placement: 'conditional-quantile' };
  const result = conditionSimulationComponents(components, prior, settings);
  assert.equal(result.components.length, components.length, 'Each feature remains one finite emitter.');
  const depths = result.components.map(component => component.center[2]);
  const mean = depths.reduce((sum, z) => sum + z, 0) / depths.length;
  const rms = Math.sqrt(depths.reduce((sum, z) => sum + (z - mean) ** 2, 0) / depths.length);
  assert.ok(Math.abs(mean) < 2, `Conditional mean ${mean}`);
  assert.ok(rms > 18 && rms < 22, `Conditional standard deviation ${rms}`);
  assert.ok(depths.some(z => z < -40) && depths.some(z => z > 40));
  const brighter = conditionSimulationComponents(components.map(component => ({ ...component, projectedWeight: 9 })), prior, settings);
  assert.deepEqual(brighter.components.map(component => component.center), result.components.map(component => component.center));
  for (let i = 0; i < components.length; i++)
    assert.equal(projectEmissionComponent(result.components[i]!, .4, .2), projectEmissionComponent(components[i]!, .4, .2));
});

test('conditional draws reject unsupported light and thick boundary kernels instead of making midplane clumps', () => {
  const component: EmissionComponent = { id: 'thick-feature', basisId: 'fixture', center: [0, 0, 0],
    sigma: [10, 10, 10], angleRadians: 0, projectedWeight: 1, depthAssignment: 'halo-diffuse', velocityCovered: false };
  const settings: SimulationDepthSettings = { depthSamples: 64, modeRelativeThreshold: .1, maximumModes: 1,
    minimumSigmaZ: .5, maximumSigmaZ: 10, featureThicknessRatio: 1, supportSigma: 4, placement: 'conditional-quantile' };
  const bounds = { min: [-100, -100, -100] as [number, number, number], max: [100, 100, 100] as [number, number, number] };
  assert.throws(() => conditionSimulationComponents([component], { identity: 'a'.repeat(64), bounds, sampleDensity: () => 0 }, settings), /positive prior support/);
  assert.throws(() => conditionSimulationComponents([component], { identity: 'a'.repeat(64), bounds,
    sampleDensity: (_x, _y, z) => z > 90 ? 1 : 0 }, settings), /do not clamp/);
});
