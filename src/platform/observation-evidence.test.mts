import assert from 'node:assert/strict';
import { test } from 'node:test';
import { observationEvidenceOutputMatches, parseObservationEvidence, parsePreparedObservationEvidence } from './observation-evidence.mts';

const observation = {
  id: 'draco-0401930040', title: 'DRACO 0401930040', sourceImageIds: ['draco-image'], cameraSourceIds: ['draco-pointing'], shapeSourceIds: ['dimorphos-v004'],
  observedAt: '2022-09-26T23:14:12.737Z', instrument: 'DRACO', quantity: 'I/F',
  registration: { kind: 'archived-controls', method: 'source-camera-to-source-mesh', sourceId: 'draco-pointing', validatedControlCount: 12, maximumResidualMeters: 0.4, maximumResidualPixels: 0.25 },
  coverage: { surfacePercent: 12.5, qualifiedPixels: 400, withheldPixels: 24 },
};

test('accepts a generated source-bound observation record', () => {
  assert.deepEqual(parseObservationEvidence(observation), observation);
});

test('requires qualified archived controls rather than untested published pointing', () => {
  assert.throws(() => parseObservationEvidence({ ...observation, observedAt: '2022-09-26', coverage: {} }));
  assert.throws(() => parseObservationEvidence({ ...observation, registration: { ...observation.registration, kind: 'published-pointing' } }), /archived control/u);
  assert.throws(() => parseObservationEvidence({ ...observation, registration: { ...observation.registration, validatedControlCount: 0 } }), /positive/u);
  const { maximumResidualMeters, maximumResidualPixels, ...withoutResidual } = observation.registration;
  assert.throws(() => parseObservationEvidence({ ...observation, registration: withoutResidual }), /measured residual/u);
});

test('requires generator and exact input identities in prepared reports', () => {
  const report = { schema: 'cssearth-prepared-observation-evidence@1', objectId: 'dimorphos', sourceManifestSha256: 'a'.repeat(64),
    generator: { path: 'tools/objects/terrestrial-layers/encounter-surface.mts', sha256: 'b'.repeat(64), dependencies: [{ path: 'tools/objects/terrestrial-layers/encounter-fits.mts', sha256: 'f'.repeat(64) }] },
    inputs: [{ id: 'draco-image', sha256: 'c'.repeat(64) }, { id: 'draco-pointing', sha256: 'd'.repeat(64) }, { id: 'dimorphos-v004', sha256: 'e'.repeat(64) }],
    datasets: [{ lensId: 'draco', recipe: { id: 'terrestrial', sha256: '1'.repeat(64) }, observations: [observation] }] };
  assert.equal(parsePreparedObservationEvidence(report).datasets[0].observations[0].id, observation.id);
  assert.throws(() => parsePreparedObservationEvidence({ ...report, generator: { ...report.generator, sha256: 'not-a-hash' } }));
  assert.throws(() => parsePreparedObservationEvidence({ ...report, generator: { ...report.generator, dependencies: [{ path: report.generator.path, sha256: report.generator.sha256 }] } }), /Duplicate observation generator dependency/u);
  assert.throws(() => parsePreparedObservationEvidence({ ...report, datasets: [] }), /needs datasets/u);
  assert.throws(() => parsePreparedObservationEvidence({ ...report, datasets: [{ ...report.datasets[0], recipe: { id: 'terrestrial' } }] }), /recipe hash/u);
});

test('optional prepared observation reports must match provenance output pins', () => {
  const pin = { bytes: 12, sha256: 'a'.repeat(64) };
  assert.equal(observationEvidenceOutputMatches([], null), true, 'existing datasets may omit evidence');
  assert.equal(observationEvidenceOutputMatches([pin], pin), true);
  assert.equal(observationEvidenceOutputMatches([], pin), false, 'adding a report requires refreshed provenance');
  assert.equal(observationEvidenceOutputMatches([pin], null), false, 'deleting a report requires refreshed provenance');
  assert.equal(observationEvidenceOutputMatches([pin], { ...pin, sha256: 'b'.repeat(64) }), false, 'changed report bytes require refreshed provenance');
});
