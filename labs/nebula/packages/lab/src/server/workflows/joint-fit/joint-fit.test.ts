import assert from 'node:assert/strict';
import test from 'node:test';
import { jointAxis, jointOutline, jointRayDepths, jointSurfaceFunction } from '@cssearth/nebula-reconstruction/methods/joint/geometry';
import { evaluateJointModel, fitJointModels, velocityPoint } from '@cssearth/nebula-reconstruction/methods/joint/fitter';
import { readJointControls, readJointRequest, type JointControls, type JointEvidence, type JointParameters, type JointRecipe } from '../../../features/joint-fit/model.ts';

const sphere: JointParameters = { family: 'ellipsoid', radiusArcsec: 100, depthRatio: 1, inclinationDegrees: 0,
  positionAngleDegrees: 0, expansionKmS: 20, systemicLsrKmS: -10 };
const controls: JointControls = { ridgeThreshold: .25, minLengthArcseconds: 40, imageWeight: 1, velocityWeight: 1 };
const recipe: JointRecipe = { schema: 'cssearth-joint-fit-recipe@1', id: 'analytic-test', molecularSource: 'fixture.json', centerIcrsDegrees: [0, 0],
  morphologyRadiusArcsec: [50, 200], radiusSearchArcsec: [100], systemicLsrKmS: -10, systemicUncertaintyKmS: 2,
  imageToleranceArcsec: 10, velocityToleranceKmS: 4, missingVelocityPenaltyKmS: 60, interpretation: 'Analytic unit fixture, not observational data.' };
function near(actual: number, expected: number, tolerance = 1e-7) { assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected} by more than ${tolerance}`); }
function evidence(): JointEvidence {
  return { beamFwhmArcsec: 0,
    ridges: Array.from({ length: 16 }, (_, i) => ({ x: 100 * Math.cos(i * Math.PI / 8), y: 100 * Math.sin(i * Math.PI / 8), weight: 1, polylineId: 'circle' })),
    velocities: [
      { id: 'blue', pointingId: 'east', x: 60, y: 0, velocityLsrKmS: -26, heldOut: false },
      { id: 'red', pointingId: 'east', x: 60, y: 0, velocityLsrKmS: 6, heldOut: false },
      { id: 'north-blue', pointingId: 'north', x: 0, y: 80, velocityLsrKmS: -22, heldOut: false },
      { id: 'north-red', pointingId: 'north', x: 0, y: 80, velocityLsrKmS: 2, heldOut: false },
      { id: 'held-blue', pointingId: 'held', x: -60, y: 0, velocityLsrKmS: -26, heldOut: true },
      { id: 'held-red', pointingId: 'held', x: -60, y: 0, velocityLsrKmS: 6, heldOut: true },
    ] };
}

test('sphere sightlines satisfy the analytic chord, tangent and outside cases regardless of orientation', () => {
  for (const orientation of [{ inclinationDegrees: 0, positionAngleDegrees: 0 }, { inclinationDegrees: 60, positionAngleDegrees: 45 }, { inclinationDegrees: -75, positionAngleDegrees: 135 }]) {
    const p = { ...sphere, ...orientation };
    assert.deepEqual(jointRayDepths(0, 0, p), [-100, 100]);
    const chord = jointRayDepths(60, 0, p); assert.equal(chord.length, 2); near(chord[0], -80); near(chord[1], 80);
    const tangent = jointRayDepths(60, 80, p); assert.ok(tangent.length >= 1); assert.ok(tangent.every(z => Math.abs(z) < 1e-8));
    assert.deepEqual(jointRayDepths(101, 0, p), []);
  }
  const elongated = jointRayDepths(60, 0, { ...sphere, depthRatio: 2 });
  near(elongated[0], -160); near(elongated[1], 160);
});

test('sky position angle uses west/north axes and positive depth produces redshift in known homologous expansion', () => {
  const north = jointAxis({ ...sphere, inclinationDegrees: 30 }); near(north[0], 0); near(north[1], .5); near(north[2], Math.sqrt(3) / 2);
  const east = jointAxis({ ...sphere, inclinationDegrees: 30, positionAngleDegrees: 90 }); near(east[0], -.5); near(east[1], 0);
  const fit = evaluateJointModel(sphere, evidence(), controls, recipe);
  // A 100″ sphere at ρ=60″ has z=±80″; 20 km/s homologous expansion gives −10±16 km/s.
  near(fit.residuals.find(r => r.id === 'blue')!.predictedLsrKmS!, -26);
  near(fit.residuals.find(r => r.id === 'red')!.predictedLsrKmS!, 6);
  near(fit.metrics.trainingRmsKmS!, 0); near(fit.metrics.heldOutRmsKmS!, 0);
  const slower = evaluateJointModel({ ...sphere, expansionKmS: 10 }, evidence(), controls, recipe);
  assert.ok(slower.metrics.trainingRmsKmS! > 5);
  // An inclined prolate ellipsoid breaks the sphere's front/back velocity-set symmetry.
  // At y=60″, inclination=60°, a=100″ and c=200″, its chord solves
  // (13/16)z²−(45sqrt(3)/2)z−8425=0, so z=(180sqrt(3)±1360)/13.
  const tilted = { ...sphere, depthRatio: 2, inclinationDegrees: 60 };
  const knownVelocities = [-1, 1].map(sign => -10 + .2 * (180 * Math.sqrt(3) + sign * 1360) / 13);
  const asymmetric = evidence();
  asymmetric.velocities = knownVelocities.map((velocityLsrKmS, i) => ({ id: `tilted-${i}`, pointingId: 'tilted', x: 0, y: 60, velocityLsrKmS, heldOut: false }));
  asymmetric.velocities.push({ id: 'held', pointingId: 'held', x: 0, y: 0, velocityLsrKmS: 0, heldOut: true });
  const projected = evaluateJointModel(tilted, asymmetric, controls, recipe);
  near(projected.residuals[0].predictedLsrKmS!, knownVelocities[0]);
  near(projected.residuals[1].predictedLsrKmS!, knownVelocities[1]);
  near(projected.metrics.trainingRmsKmS!, 0);
});

test('bipolar polar ray includes both exact outer endpoints and reflection preserves all four resolved crossings', () => {
  const polar: JointParameters = { ...sphere, family: 'bipolar', depthRatio: 2.4 };
  const poles = jointRayDepths(0, 0, polar); assert.equal(poles.length, 2); near(poles[0], -240, .001); near(poles[1], 240, .001);
  const tilted = { ...polar, inclinationDegrees: 30 }, roots = jointRayDepths(40, -32, tilted);
  // Independently bracketed roots of the squared meridional surface equation:
  // [r²+(1/2.4²−1)u²]r⁸=100²[.55r⁴+.9u²r²−.45u⁴]²,
  // r²=40²+32²+z² and u=−16+sqrt(3)z/2. There are four separated crossings.
  const expected = [-172.580851676, 20.270224711, 50.063097200, 59.044444527];
  assert.equal(roots.length, 4); roots.forEach((root, i) => near(root, expected[i], .002));
  const reflected = jointRayDepths(-40, 32, tilted);
  assert.equal(reflected.length, 4); reflected.forEach((root, i) => near(root, -roots[3 - i], .002));
  const reverseTilt = jointRayDepths(40, -32, { ...tilted, inclinationDegrees: -30 });
  assert.equal(reverseTilt.length, 4); reverseTilt.forEach((root, i) => near(root, -roots[3 - i], .002));
});

test('fit objective ignores held-out dependent values while their diagnostic residuals change', () => {
  const input = evidence(), original = structuredClone(input);
  const baseline = evaluateJointModel(sphere, input, controls, recipe);
  const perturbed = structuredClone(input); for (const point of perturbed.velocities) if (point.heldOut) point.velocityLsrKmS += 200;
  const changed = evaluateJointModel(sphere, perturbed, controls, recipe);
  assert.equal(changed.metrics.objective, baseline.metrics.objective);
  assert.equal(changed.metrics.trainingRmsKmS, baseline.metrics.trainingRmsKmS);
  assert.ok(changed.metrics.heldOutRmsKmS! > baseline.metrics.heldOutRmsKmS! + 100);
  assert.deepEqual(input, original); assert.deepEqual(changed.parameters, baseline.parameters);
});

test('held-out velocities cannot change bounded-fit parameters, objective or family ranking', () => {
  const input = evidence(), baseline = fitJointModels(input, controls, recipe);
  const perturbed = structuredClone(input); for (const point of perturbed.velocities) if (point.heldOut) point.velocityLsrKmS = point.id === 'held-blue' ? -500 : 500;
  const changed = fitJointModels(perturbed, controls, recipe);
  assert.ok(baseline.evaluatedModels > 0); assert.equal(changed.evaluatedModels, baseline.evaluatedModels);
  assert.equal(baseline.fits.length, 2); assert.deepEqual(changed.fits.map(fit => fit.parameters), baseline.fits.map(fit => fit.parameters));
  assert.deepEqual(changed.fits.map(fit => fit.metrics.objective), baseline.fits.map(fit => fit.metrics.objective));
  assert.ok(changed.fits[0].metrics.heldOutRmsKmS! > baseline.fits[0].metrics.heldOutRmsKmS! + 100);
});

test('missing modeled training rays incur the configured penalty instead of disappearing from the objective', () => {
  const input = evidence(); input.velocities = [
    { id: 'fit', pointingId: 'fit', x: 60, y: 0, velocityLsrKmS: 6, heldOut: false },
    { id: 'missing', pointingId: 'missing', x: 250, y: 0, velocityLsrKmS: 0, heldOut: false },
    { id: 'held', pointingId: 'held', x: 0, y: 0, velocityLsrKmS: 10, heldOut: true },
  ];
  const fit = evaluateJointModel(sphere, input, { ...controls, imageWeight: 0 }, recipe);
  assert.equal(fit.metrics.trainingCount, 2); assert.equal(fit.metrics.missingTraining, 1);
  near(fit.metrics.trainingRmsKmS!, 0);
  // One zero-loss pointing plus one missing ray: Huber(60/4)=14.5, mean=7.25.
  near(fit.metrics.objective, 7.25);
  const missing = fit.residuals.find(r => r.id === 'missing')!; assert.equal(missing.predictedLsrKmS, null); assert.equal(missing.residualKmS, 60);
  input.velocities[2].x = 250;
  const heldMissing = evaluateJointModel(sphere, input, { ...controls, imageWeight: 0 }, recipe);
  assert.equal(heldMissing.metrics.objective, fit.metrics.objective); assert.equal(heldMissing.metrics.missingHeldOut, 1);
  assert.equal(heldMissing.metrics.heldOutCount, 1); assert.equal(heldMissing.metrics.heldOutRmsKmS, null);
  input.velocities[0].x = 250;
  const allMissing = evaluateJointModel(sphere, input, { ...controls, imageWeight: 0 }, recipe);
  assert.equal(allMissing.metrics.trainingCount, 2); assert.equal(allMissing.metrics.missingTraining, 2); assert.equal(allMissing.metrics.trainingRmsKmS, null);
  near(allMissing.metrics.objective, 14.5);
});

test('ellipsoid outline matches the independent projected ellipse and tangent rays at every image angle', () => {
  const p = { ...sphere, depthRatio: 2, inclinationDegrees: 60, positionAngleDegrees: 0 }, outline = jointOutline(p);
  assert.equal(outline.length, 72);
  // Rotating axes100,100,200 by60° gives projected semi-axes100 andsqrt(32500).
  for (const [x, y] of outline) {
    near(x * x / 10000 + y * y / 32500, 1, 1e-12);
    // Tangency minimizes the independent 3D quadratic: z=(3sqrt(3)/13)y.
    const z = 3 * Math.sqrt(3) * y / 13;
    near(x * x + y * y + z * z - .75 * (Math.sqrt(3) * y / 2 + z / 2) ** 2, 10000, 1e-8);
    const tangent = jointRayDepths(x, y, p); assert.equal(tangent.length, 2);
    near(tangent[0], z, 2e-5); near(tangent[1], z, 2e-5);
    assert.deepEqual(jointRayDepths(x * 1.00001, y * 1.00001, p), []);
    assert.equal(jointRayDepths(x * .99999, y * .99999, p).length, 2);
  }
  for (const [x, y] of jointOutline({ ...p, depthRatio: 1 })) near(Math.hypot(x, y), 100, 1e-10);
});

test('bipolar outline is a surface envelope with line-of-sight tangency, including competing lobe maxima', () => {
  for (const inclinationDegrees of [0, 30, 75]) {
    const p: JointParameters = { ...sphere, family: 'bipolar', depthRatio: 2.4, inclinationDegrees, positionAngleDegrees: 37 };
    const outline = jointOutline(p); assert.equal(outline.length, 72);
    // Independently minimize the implicit surface along z; use a much denser uniform z grid than the angular projection search.
    for (const [x, y] of outline.filter((_, i) => i % 6 === 0)) {
      const bound = 240, step = 2 * bound / 2400;
      let bestZ = -bound, best = Infinity;
      for (let k = 0; k <= 2400; k++) {
        const z = -bound + k * step, value = jointSurfaceFunction(x, y, z, p);
        if (value < best) { best = value; bestZ = z; }
      }
      let lo = bestZ - step, hi = bestZ + step;
      for (let k = 0; k < 45; k++) {
        const left = lo + (hi - lo) / 3, right = hi - (hi - lo) / 3;
        if (jointSurfaceFunction(x, y, left, p) < jointSurfaceFunction(x, y, right, p)) hi = right; else lo = left;
      }
      const z = (lo + hi) / 2;
      near(jointSurfaceFunction(x, y, z, p), 0, 1e-9);
      const derivative = (jointSurfaceFunction(x, y, z + .001, p) - jointSurfaceFunction(x, y, z - .001, p)) / .002;
      near(derivative, 0, 1e-7);
      assert.ok(jointSurfaceFunction(x * .999, y * .999, z, p) < 0);
      assert.ok(jointSurfaceFunction(x * 1.001, y * 1.001, z, p) > 0);
    }
    for (let i = 0; i < 36; i++) { near(outline[i][0], -outline[i + 36][0], 1e-8); near(outline[i][1], -outline[i + 36][1], 1e-8); }
  }
});

test('runtime controls reject both objectives disabled and nonfinite values while either objective may be disabled alone', () => {
  assert.throws(() => readJointControls({ ...controls, imageWeight: 0, velocityWeight: 0 }));
  assert.throws(() => readJointControls({ ...controls, imageWeight: NaN }));
  assert.throws(() => readJointControls({ ...controls, velocityWeight: Infinity }));
  assert.equal(readJointControls({ ...controls, imageWeight: 0 }).imageWeight, 0);
  assert.equal(readJointControls({ ...controls, velocityWeight: 0 }).velocityWeight, 0);
  const request = { action: 'apply', imageId: 'joint-fit', cataloguePath: '.local/nebula-lab/test/catalogue.json', recipePath: 'labs/nebula/models/test/joint.json',
    imageToFrame: {}, evidence: { sensitivity: 1, weights: [1, 1] }, controls: { ...controls, imageWeight: 0, velocityWeight: 0 } };
  assert.throws(() => readJointRequest(request));
  assert.throws(() => velocityPoint('bad', 'bad', NaN, 0, 10));
});
