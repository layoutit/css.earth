import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { commitEncounterLandmarkOutputs, evaluateEncounterAnchor, transformImageControlStages } from './project-encounter-landmarks.mts';
import { fitImageControls } from './image-controls.mts';

const unit = (values: readonly number[]) => { const length = Math.hypot(...values); return values.map(value => value / length); };
const camera = { positionMeters: [0, 0, 0], ray(x: number, y: number) { return unit([x / 100, y / 100, 1]); } };
const observedShape = { faceProvenance: [0], intersect(_origin: readonly number[], _ray: readonly number[]) { return { radius: 100, faceId: 0 }; },
  closestPoint(point: readonly number[], _maximumDistanceMeters: number) { return { normal: unit(point).map(value => -value) }; } };

test('anchor evaluator accepts observed first hits and reports sampled placement sensitivity', () => {
  const anchor = evaluateEncounterAnchor(camera, observedShape, [0, 0], 20);
  assert.equal(anchor.sourceFace, 0);
  assert.equal(anchor.emissionDegrees, 0);
  assert.ok(anchor.sensitivity > 14 && anchor.sensitivity < 16);
});

test('anchor evaluator rejects inferred first hits, excessive emission and sensitivity', () => {
  assert.throws(() => evaluateEncounterAnchor(camera, { ...observedShape, faceProvenance: [1] }, [0, 0], 20), /not observed terrain/u);
  const sunward = { ...observedShape, closestPoint(_point: readonly number[], _maximumDistanceMeters: number) { return { normal: [0, 0, 1] }; } };
  assert.throws(() => evaluateEncounterAnchor(camera, sunward, [0, 0], 20), /emission/u);
  assert.throws(() => evaluateEncounterAnchor(camera, observedShape, [0, 0], 1), /sensitivity/u);
});

test('output commit creates nested evidence directories; dry runs reject missing and changed outputs', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'encounter-landmark-output-'));
  try {
    const output = { path: join(directory, 'features', 'evidence', 'image-landmarks.json'), content: '{"ok":true}\n' };
    await assert.rejects(commitEncounterLandmarkOutputs([output], false), /missing/u);
    await commitEncounterLandmarkOutputs([output], true);
    assert.equal(await readFile(output.path, 'utf8'), output.content);
    await commitEncounterLandmarkOutputs([output], false);
    await writeFile(output.path, '{"ok":false}\n');
    await assert.rejects(commitEncounterLandmarkOutputs([output], false), /differ/u);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('Wild 2 consumes both checked-in diagram-to-photo and photo-to-native control stages', async () => {
  const configuration = JSON.parse(await readFile('src/objects/comet-81p/source/features/image-registration.json', 'utf8'));
  assert.equal(configuration.stages.length, 2);
  const stages: ReturnType<typeof fitImageControls>[] = (configuration.stages as unknown[]).map(fitImageControls);
  assert.deepEqual(stages.map(stage => [stage.stats.fit.count, stage.stats.holdout.count]), [[3, 3], [35, 36]]);
  const native = transformImageControlStages(stages, [288, 637]);
  assert.ok(Math.abs(native[0] - 530.4818790655611) < 1e-9);
  assert.ok(Math.abs(native[1] - 629.3926511752084) < 1e-9);
});
