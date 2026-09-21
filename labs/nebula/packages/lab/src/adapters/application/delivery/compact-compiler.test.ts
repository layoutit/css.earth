import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { readCompactCompiler } from './compact-compiler.ts';
const input = async () => JSON.parse(gunzipSync(await readFile('src/objects/m42/source/bake-inputs.json.gz')).toString());
test('compact compiler validates the accepted field, material correspondence and sampling', async () => {
  const value = await input(), parsed = readCompactCompiler(value);
  assert.equal(parsed.objectId, 'm42');
  assert.equal(parsed.materials.length, 2);
  assert.ok(parsed.field.components.length > 0);
  assert.ok(parsed.expected.every(bank => bank.resources.length > 0));
  const changedColor = structuredClone(value);
  changedColor.materials[0].components[0].rgb[0] = NaN;
  assert.throws(() => readCompactCompiler(changedColor), /component differs/);
  const reordered = structuredClone(value);
  reordered.materials[0].components.reverse();
  assert.throws(() => readCompactCompiler(reordered), /component differs/);
  const missing = structuredClone(value);
  missing.materials.pop();
  assert.throws(() => readCompactCompiler(missing), /materials differ/);
  const identity = structuredClone(value);
  identity.field.identity = '0'.repeat(64);
  assert.throws(() => readCompactCompiler(identity), /identity differs/);
  const shape = structuredClone(value);
  shape.expected[0].resources[0].width = 0;
  assert.throws(() => readCompactCompiler(shape), /resource/);
});

import { createHash } from 'node:crypto';
test('compact replay cannot silently omit a retained density envelope or its colors', async () => {
  const value = await input();
  const recipe = JSON.parse(await readFile('labs/nebula/models/omega-centauri/photometric-mge.json', 'utf8'));
  value.field.photometricEnvelope = { schema: 'cssearth-photometric-envelope@1', priorIdentity: 'c'.repeat(64), recipe,
    width: 2, height: 2, bounds: { min: [-100, -100], max: [100, 100] }, zRange: [-300, 300], gain: [1, 1, 1, 1] };
  for (const material of value.materials) material.envelopeColors = { width: 2, height: 2, rgb: Array(12).fill(255) };
  value.provenance.modelSha256 = createHash('sha256').update(JSON.stringify(value.field)).digest('hex');
  assert.ok(readCompactCompiler(value).field.photometricEnvelope);
  const missingColors = structuredClone(value); delete missingColors.materials[0].envelopeColors;
  assert.throws(() => readCompactCompiler(missingColors), /envelope colors/);
  const missingField = structuredClone(value); delete missingField.field.photometricEnvelope;
  for (const material of missingField.materials) delete material.envelopeColors;
  assert.throws(() => readCompactCompiler(missingField), /retained model hash/);
});

test('compact sampling keeps historical omission and rejects a grouped plan that differs from saved output counts', async () => {
  const historical = await input(), before = JSON.stringify(historical.scene.sampling);
  assert.equal(JSON.stringify(readCompactCompiler(historical).scene.sampling), before);
  assert.equal('layerPlan' in readCompactCompiler(historical).scene.sampling, false);
  const planned = structuredClone(historical), reference = { ...planned.scene.sampling.sliceCounts };
  const groups = (count: number) => Array.from({ length: Math.ceil(count / 4) }, (_, i) => ({ startCell: i * 4, endCell: Math.min(count, i * 4 + 4) }));
  const axes = { x: groups(reference.x), y: groups(reference.y), z: groups(reference.z) };
  planned.scene.sampling.layerPlan = { schema: 'cssearth-volume-layer-plan@1', referenceSliceCounts: reference,
    referenceSamplesPerSlab: 4, axes };
  planned.scene.sampling.sliceCounts = { x: axes.x.length, y: axes.y.length, z: axes.z.length };
  assert.deepEqual(readCompactCompiler(planned).scene.sampling, planned.scene.sampling);
  const reported = structuredClone(planned);
  reported.scene.sampling.layerOptimization = { schema: 'cssearth-layer-optimization@1',
    method: 'gradient-weighted-depth-displacement@1', maximumLayers: 500,
    referenceLayers: reference.x + reference.y + reference.z, plannedLayers: axes.x.length + axes.y.length + axes.z.length,
    probeWidth: 64, probeSubpixels: 2, targetNormalizedL1: .01, estimatedNormalizedL1: { x: .005, y: .008, z: .009 }, status: 'target-met' };
  assert.deepEqual(readCompactCompiler(reported).scene.sampling, reported.scene.sampling);
  const orphanReport = structuredClone(reported); delete orphanReport.scene.sampling.layerPlan;
  assert.throws(() => readCompactCompiler(orphanReport), /report requires its retained plan/);
  const wrongReport = structuredClone(reported); wrongReport.scene.sampling.layerOptimization.plannedLayers++;
  assert.throws(() => readCompactCompiler(wrongReport), /report differs from its plan/);
  const wrongCount = structuredClone(planned); wrongCount.scene.sampling.sliceCounts.x++;
  assert.throws(() => readCompactCompiler(wrongCount), /differs from its retained layer plan/);
  const wrongQuadrature = structuredClone(planned); wrongQuadrature.scene.sampling.layerPlan.referenceSamplesPerSlab = 2;
  assert.throws(() => readCompactCompiler(wrongQuadrature), /differs from its retained layer plan/);
});
