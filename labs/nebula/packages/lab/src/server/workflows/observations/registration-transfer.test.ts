import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { readObservationRecipe, scienceObservationSources } from '../../../features/observations/recipe.js';
import { publisherRegistration } from '@cssearth/nebula-reconstruction/registration/stellar';
import { transferRegistration, validateTransferEvidence, type RegistrationEvidence } from './registration-transfer.js';
test('real common-grid transfer pins both originals and cannot impersonate stellar verification', async () => {
  const recipe = readObservationRecipe(JSON.parse(await readFile('labs/nebula/models/m1/observations.json', 'utf8')));
  assert.equal(scienceObservationSources(recipe).length, 6);
  const source = recipe.images.find(image => image.id === 'chandra-xray')!, bridge = recipe.images.find(image => image.id === source.registrationTransfer!.referenceId)!;
  const proof: unknown = JSON.parse(await readFile(source.registrationTransfer!.evidence.path, 'utf8'));
  validateTransferEvidence(proof, source, bridge);
  assert.throws(() => validateTransferEvidence(proof, source, { ...bridge, width: bridge.width + 1 }), /reference pin differs/);
  const evidence: RegistrationEvidence = { ...publisherRegistration('Fixture'), referenceId: recipe.referenceId };
  await assert.rejects(transferRegistration(source, bridge, [1, 0, 0, 1, 0, 0], evidence), /directly star-verified/);
  const checked: RegistrationEvidence = { ...evidence, status: 'verified', matchedStars: 45,
    matches: Array.from({ length: 45 }, () => ({ source: [1, 2], frame: [1, 2], predictedFrame: [1, 2], heldOut: true, fitInlier: true, residualPixels: 0 })) };
  const matrix: [number, number, number, number, number, number] = [2, .1, -.1, 2, 5, -3];
  const transferred = await transferRegistration(source, bridge, matrix, checked);
  assert.deepEqual(transferred.matrix, matrix); assert.equal(transferred.evidence.status, 'transferred');
  assert.equal(transferred.evidence.matchedStars, 0); assert.equal(transferred.evidence.bridgeMatchedStars, 45); assert.deepEqual(transferred.evidence.matches, []);
});
test('transfer graph rejects cycles, missing references, and singular transforms', async () => {
  const raw = JSON.parse(await readFile('labs/nebula/models/m1/observations.json', 'utf8'));
  raw.images[3].registrationTransfer.referenceId = 'missing'; assert.throws(() => readObservationRecipe(raw), /distinct directly registered/);
  raw.images[3].registrationTransfer.referenceId = raw.images[4].id; assert.throws(() => readObservationRecipe(raw), /distinct directly registered/);
  raw.images[3].registrationTransfer.pixelToReference = [1, 1, 1, 1, 0, 0]; assert.throws(() => readObservationRecipe(raw), /Singular/);
});
