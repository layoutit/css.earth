import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { conditionDepthComponents, depthSurfaceAt, readDepthRecipe, verifyDepthEvidence, loadDepthModel, type DepthRecipe, type DepthSurface } from './depth-model.ts';
import { createEmissionField, projectEmissionComponent } from '@cssearth/volume-core/fields/emission';
import { fitEmissionField } from './fit.ts';
import type { EmissionComponent, EmissionFieldModel, EmissionFitInput } from '@cssearth/volume-core/contracts/emission';

function recipe(features = false): DepthRecipe {
  const background: DepthSurface = { id: 'background', methodId: 'coherent-irregular-front', evidenceIds: ['assumption'], support: 'unconstrained',
    centerArcsec: [2, -3], radiusArcsec: [100, 100], angleDegrees: 0, depthArcsec: 10, gradient: [.3, -.2],
    curvaturePerArcsec: [.002, .001, -.001], thicknessArcsec: 200, strength: 1, rationale: 'Authored smooth reference surface.' };
  return readDepthRecipe({ schema: 'cssearth-nebula-depth-model@1', id: 'synthetic-cloud', centerIcrsDegrees: [30, -20],
    evidence: { path: 'labs/nebula/models/synthetic-cloud/evidence.json', sha256: 'a'.repeat(64) }, background,
    features: features ? [{ ...background, id: 'feature', evidenceIds: ['structure'], support: 'paper-guided',
      centerArcsec: [20, 10], radiusArcsec: [8, 5], angleDegrees: 30, depthArcsec: 40, gradient: [-.1, .2], curvaturePerArcsec: [0, 0, 0], thicknessArcsec: 8 }] : [],
    detailThicknessRatio: .4, minimumThicknessArcsec: .01, interpretation: 'Synthetic conditional display geometry, not measured density.' });
}
function ledger() {
  return { schema: 'cssearth-nebula-physical-evidence@1', subjectId: 'synthetic-cloud',
    sources: [{ id: 'paper', url: 'https://example.org/paper' }],
    evidence: [{ id: 'assumption', classification: 'authored', sourceIds: [] }, { id: 'structure', classification: 'published-model', sourceIds: ['paper'] }],
    methods: [{ id: 'coherent-irregular-front', inputRequirements: ['declared prior and published morphology'], evidenceIds: ['assumption', 'structure'] }] };
}
function component(): EmissionComponent {
  return { id: 'detail', basisId: 'detail', center: [12, -5, 999], sigma: [4, 6, 50], angleRadians: .3,
    projectedWeight: .7, depthAssignment: 'halo-diffuse', velocityCovered: false };
}
function model(components: EmissionComponent[]): EmissionFieldModel {
  return { schema: 'cssearth-conditional-emission-field@1', identity: 'synthetic', controls: { detail: .5, faint: .5, depth: 1 }, components,
    bounds: { min: [-100, -100, -100], max: [100, 100, 100] }, skyBounds: { min: [-100, -100], max: [100, 100] }, scaffold: null,
    assumptions: { kernel: 'fixture', projectionUnits: 'fixture', depth: 'fixture', halo: 'fixture', haloRadiusArcsec: 100,
      equalNearFarSplit: true, velocityUncoveredComponents: components.length } };
}
const close = (actual: number, expected: number, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} differs from ${expected}`);

test('known quadratic surface conditions center, local slope and thickness with declared evidence attribution', () => {
  const input = component(), saved = structuredClone(input), output = conditionDepthComponents([input], recipe(), 1.5), next = output.components[0]!;
  close(next.center[2], 13.576 * 1.5);
  close(next.depthGradient![0], .338 * 1.5); close(next.depthGradient![1], -.186 * 1.5);
  close(next.sigma[2], 4 * .4 * 1.5);
  assert.deepEqual(next.center.slice(0, 2), input.center.slice(0, 2));
  assert.deepEqual(next.sigma.slice(0, 2), input.sigma.slice(0, 2));
  assert.equal(next.angleRadians, input.angleRadians); assert.equal(next.projectedWeight, input.projectedWeight);
  assert.deepEqual(input, saved);
  assert.equal(output.authoredComponents, 1); assert.equal(output.paperGuidedComponents, 0);
  assert.deepEqual(output.assignments[0], { componentId: 'detail', featureId: 'background', methodId: 'coherent-irregular-front', evidenceIds: ['assumption'], support: 'unconstrained' });
});

test('scoped features match their centers and join the background continuously without duplicated surfaces', () => {
  const data = recipe(true), at = depthSurfaceAt(data, 20, 10);
  assert.equal(at.depth, 40); assert.equal(at.thickness, 8); assert.equal(at.paperGuided, true);
  const edge: [number, number] = [20 + 8 * Math.cos(Math.PI / 6), 10 + 8 * Math.sin(Math.PI / 6)];
  const background = depthSurfaceAt({ ...data, features: [] }, ...edge);
  close(depthSurfaceAt(data, ...edge).depth, background.depth);
  const inward: [number, number] = [edge[0] - 1e-5 * Math.cos(Math.PI / 6), edge[1] - 1e-5 * Math.sin(Math.PI / 6)];
  close(depthSurfaceAt(data, ...inward).depth, depthSurfaceAt({ ...data, features: [] }, ...inward).depth, 1e-8);
  const output = conditionDepthComponents([{ ...component(), center: [20, 10, 100] }], data, 1);
  assert.equal(output.components.length, 1); assert.equal(output.paperGuidedComponents, 1);
  assert.equal(output.assignments[0]!.featureId, 'feature');
});

test('a requested minimum thickness cannot extrude sub-resolution details into a global rod floor', () => {
  const data = { ...recipe(), minimumThicknessArcsec: 100 };
  const tiny = { ...component(), sigma: [.5, .75, 200] as [number, number, number] };
  const conditioned = conditionDepthComponents([tiny], data, 1).components[0]!;
  assert.ok(conditioned.sigma[2] <= .5 * data.detailThicknessRatio);
  assert.ok(conditioned.sigma[2] > 0);
  const bounds = createEmissionField(model([conditioned])).bounds;
  assert.ok(bounds.min.every((n, axis) => Number.isFinite(n) && n < bounds.max[axis]!));
  assert.ok(bounds.max[2] - bounds.min[2] < 10, 'finite tilted detail must remain local rather than spanning the background thickness');
});

test('conditioning preserves numerical z-integrated projected light at multiple rays', () => {
  const original = component(), conditioned = conditionDepthComponents([original], recipe(), 1.5).components;
  const field = createEmissionField(model(conditioned)), out = new Float64Array(3), steps = 8192;
  const dz = (field.bounds.max[2] - field.bounds.min[2]) / steps;
  for (const point of [[12, -5], [14, -4], [9, -8]]) {
    let integral = 0;
    for (let i = 0; i < steps; i++) { field.sampleEmission(point[0]!, point[1]!, field.bounds.min[2] + (i + .5) * dz, out); integral += out[0]! * dz; }
    close(integral, projectEmissionComponent(original, point[0]!, point[1]!), 1e-6);
  }
});

test('physical ledger rejects wrong subjects, missing evidence/methods and broken source attribution', () => {
  const data = recipe(true);
  assert.deepEqual(verifyDepthEvidence(data, ledger()), ['coherent-irregular-front']);
  assert.throws(() => verifyDepthEvidence(data, { ...ledger(), subjectId: 'different-cloud' }), /object-owned/);
  assert.throws(() => verifyDepthEvidence(data, { ...ledger(), evidence: ledger().evidence.slice(0, 1) }), /method record/);
  assert.throws(() => verifyDepthEvidence(data, { ...ledger(), methods: [] }), /lacks its declared/);
  assert.throws(() => verifyDepthEvidence(data, { ...ledger(), sources: [] }), /attribution/);
  const uncited = ledger(); uncited.evidence[1]!.sourceIds = [];
  assert.throws(() => verifyDepthEvidence(data, uncited), /attribution/);
  const authored = ledger(); authored.evidence[1]!.classification = 'authored'; authored.evidence[1]!.sourceIds = [];
  assert.throws(() => verifyDepthEvidence(data, authored), /lacks its declared/);
});

test('invalid depth frames, surfaces, pin paths and conditioning scales are rejected', () => {
  const data = recipe();
  for (const invalid of [{ ...data, centerIcrsDegrees: [360, 0] }, { ...data, centerIcrsDegrees: [30, 91] },
    { ...data, evidence: { ...data.evidence, path: '../evidence.json' } }, { ...data, detailThicknessRatio: 0 },
    { ...data, minimumThicknessArcsec: -1 }, { ...data, features: [data.background] },
    { ...data, background: { ...data.background, support: 'paper-guided' } },
    { ...data, background: { ...data.background, methodId: 'unimplemented-model' } },
    { ...data, background: { ...data.background, radiusArcsec: [0, 1] } },
    { ...data, background: { ...data.background, gradient: [NaN, 0] } },
    { ...data, background: { ...data.background, curvaturePerArcsec: [1, 0, 0] } }])
    assert.throws(() => readDepthRecipe(invalid));
  for (const scale of [0, -1, NaN, Infinity]) assert.throws(() => conditionDepthComponents([component()], data, scale), /depth scale/);
});

test('source-owned depth inputs load with a content pin and reject changes or escaping symlinks', async () => {
  const root = await mkdtemp(join(tmpdir(), 'nebula-depth-')), outside = await mkdtemp(join(tmpdir(), 'nebula-depth-outside-'));
  try {
    const data = recipe(), bytes = JSON.stringify(ledger()), recipePath = 'labs/nebula/models/synthetic-cloud/depth.json';
    await mkdir(join(root, 'labs/nebula/models/synthetic-cloud'), { recursive: true });
    await writeFile(join(root, data.evidence.path), bytes); await writeFile(join(root, recipePath), JSON.stringify(data));
    const loaded = await loadDepthModel(root, recipePath, 'synthetic-cloud');
    assert.deepEqual(loaded.methods, ['coherent-irregular-front']);
    await assert.rejects(loadDepthModel(root, recipePath, 'wrong-cloud'), /another nebula/);
    await rm(join(root, data.evidence.path)); await writeFile(join(outside, 'evidence.json'), bytes);
    await symlink(join(outside, 'evidence.json'), join(root, data.evidence.path));
    await assert.rejects(loadDepthModel(root, recipePath, 'synthetic-cloud'), /leaves the repository/);
  } finally { await rm(root, { recursive: true, force: true }); await rm(outside, { recursive: true, force: true }); }
});

test('fit keeps its legacy default path and the conditioned field integrates to its published projection', () => {
  const width = 32, values = new Float32Array(width * width);
  for (let y = 0; y < width; y++) for (let x = 0; x < width; x++) values[y * width + x] = Math.exp(-((x - 19) ** 2 / 20 + (y - 14) ** 2 / 35));
  const input: EmissionFitInput = { width, height: width, target: values, bounds: { min: [-32, -32], max: [32, 32] } };
  const baseline = fitEmissionField(input), unchanged = fitEmissionField(input, undefined, { depthRecipe: undefined });
  assert.deepEqual(baseline, unchanged); assert.equal(baseline.field.depthConstraints, undefined);
  assert.ok(baseline.field.components.every(c => c.depthAssignment !== 'evidence-surface' && c.depthGradient === undefined));
  const fitted = fitEmissionField(input, { detail: .5, faint: .5, depth: 1 }, { depthRecipe: recipe() });
  assert.ok(fitted.field.components.length > 0); assert.equal(fitted.field.depthConstraints!.recipeId, 'synthetic-cloud');
  const field = createEmissionField(fitted.field), out = new Float64Array(3), steps = 8192, dz = (field.bounds.max[2] - field.bounds.min[2]) / steps;
  for (const [x, y] of [[19, 14], [17, 12], [22, 16]]) {
    let integral = 0;
    for (let k = 0; k < steps; k++) { field.sampleEmission(-32 + (x! + .5) * 2, 32 - (y! + .5) * 2, field.bounds.min[2] + (k + .5) * dz, out); integral += out[0]! * dz; }
    close(integral, fitted.projection[y! * width + x!]!, 1e-6);
  }
});
