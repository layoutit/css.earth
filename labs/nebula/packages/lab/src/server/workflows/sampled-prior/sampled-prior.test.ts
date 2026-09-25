import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decodeFits } from '@cssearth/fits';
import { encodeFits } from '@cssearth/fits/node';
import { type EmissionVector3, analyticEmission, mapSample, prepareSampledField } from '@cssearth/bake/volume';
import { readSampledRecipe, verifySampledEvidence, type SampledRecipe, type SampleTerm } from '../../../features/sampled-prior/model.ts';

const fixture = {
  schema: 'cssearth-sampled-nebula@1', id: 'qualified-example', centerIcrsDegrees: [80, 22],
  evidence: { path: 'labs/nebula/models/example/physical-evidence.json', sha256: 'a'.repeat(64) },
  source: { path: '.local/nebula-lab/physical/example/points.fits', sha256: 'b'.repeat(64), url: 'https://example.org/points.fits', width: 4, height: 2, columns: [0, 1, 2, 3] },
  rawToArcsec: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0],
  grid: { longestAxis: 32, blurSigmaCells: .5, weightExponent: .5, peakOpticalDepth: 1.5 },
  terms: [], lensComponents: { optical: { ejecta: 1, pwn: 0 }, xray: { ejecta: 0, pwn: 1 } },
};
const term: SampleTerm = { kind: 'ellipsoid', id: 'wind', centerArcsec: [0, 0, 0], sigmaArcsec: [2, 3, 4], weight: 1, evidenceIds: ['authored-wind'] };
function recipe(overrides: Partial<SampledRecipe> = {}) { return readSampledRecipe({ ...fixture, ...overrides }); }
function close(actual: number, expected: number, tolerance = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected} by more than ${tolerance}`);
}

test('qualified affine transform retains parity, anisotropic scales, offsets and away direction', () => {
  const configured = recipe({ rawToArcsec: [-2, 0, 0, 10, 0, 3, 0, -5, 0, 0, 4, 8] });
  assert.deepEqual(mapSample(configured.rawToArcsec, 1, 2, -3), [8, 1, -4]);
  assert.deepEqual(mapSample(configured.rawToArcsec, 0, 0, 0), [10, -5, 8]);
  assert.deepEqual(mapSample(configured.rawToArcsec, 0, 0, 1), [10, -5, 12]);
  // Reflected axes are valid; a singular mapping must not silently flatten spatial samples.
  assert.throws(() => recipe({ rawToArcsec: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0] }), /degenerate/);
});

test('source and evidence byte pins, dimensions and physical term identities are mandatory', () => {
  for (const evidence of [undefined, null, { ...fixture.evidence, path: 'labs/nebula/models/../secret.json' }])
    assert.throws(() => readSampledRecipe({ ...fixture, evidence }));
  for (const source of [{ ...fixture.source, width: -1 },
    { ...fixture.source, height: -1 }, { ...fixture.source, columns: [0, 1, 1, 3] }, { ...fixture.source, url: 'http://example.org/points.fits' }])
    assert.throws(() => readSampledRecipe({ ...fixture, source }));
  for (const invalid of [{ ...term, evidenceIds: [] }, { ...term, weight: -1 }, { ...term, sigmaArcsec: [2, -3, 4] }])
    assert.throws(() => readSampledRecipe({ ...fixture, terms: [invalid] }));
  assert.throws(() => recipe({ terms: [term, term] }), /Duplicate/);
  assert.throws(() => recipe({ lensComponents: { optical: { ejecta: 0, pwn: 0 } } }), /empty/);
});

test('analytic terms and the named pulsar must reference evidence for this object', () => {
  const configured = recipe({ terms: [term], pulsar: { id: 'central-star', positionArcsec: [0, 0, 0], rgb: [255, 255, 255],
    diameterArcsec: .2, alpha: 1, evidenceIds: ['measured-position'] } });
  const evidence = { schema: 'cssearth-nebula-physical-evidence@1', subjectId: configured.id,
    sources: [{ id: 'catalogue', url: 'https://example.org/catalogue' }],
    evidence: [{ id: 'authored-wind', classification: 'authored', sourceIds: [] },
      { id: 'measured-position', classification: 'observed', sourceIds: ['catalogue'] }] };
  assert.doesNotThrow(() => verifySampledEvidence(configured, evidence));
  assert.throws(() => verifySampledEvidence(configured, { ...evidence, subjectId: 'other' }), /another object/);
  assert.throws(() => verifySampledEvidence(configured, { ...evidence, evidence: evidence.evidence.slice(1) }), /missing physical evidence/);
  assert.throws(() => verifySampledEvidence(configured, { ...evidence, evidence: evidence.evidence.slice(0, 1) }), /missing physical evidence/);
});

test('sampled evidence rejects invalid classifications and unresolvable source attribution', () => {
  const configured = recipe({ terms: [term] });
  const ledger = { schema: 'cssearth-nebula-physical-evidence@1', subjectId: configured.id,
    sources: [{ id: 'paper', url: 'https://example.org/paper' }],
    evidence: [{ id: 'authored-wind', classification: 'authored', sourceIds: [] }] };
  for (const invalid of [{ ...ledger.evidence[0], classification: 'measured-depth' },
    { ...ledger.evidence[0], classification: 'observed', sourceIds: [] },
    { ...ledger.evidence[0], classification: 'published-model', sourceIds: ['missing-paper'] }])
    assert.throws(() => verifySampledEvidence(configured, { ...ledger, evidence: [invalid] }), /evidence|attribution|classification/i);
});

test('torus emission follows its declared plane and finite tube, not a spherical shell', () => {
  const ring: SampleTerm = { id: 'ring', kind: 'torus', centerArcsec: [2, -3, 4], axis: [0, 1, 0], radiusArcsec: 6,
    sigmaArcsec: .5, weight: 1, evidenceIds: ['ring-fit'] };
  const peak = analyticEmission(ring, 8, -3, 4);
  assert.ok(peak > 0); close(analyticEmission(ring, 2, -3, 10), peak);
  assert.equal(analyticEmission(ring, 2, -3, 4), 0);
  assert.equal(analyticEmission(ring, 2, 3, 4), 0);
  assert.equal(analyticEmission(ring, 8, -1, 4), 0);
  close(analyticEmission({ ...ring, axis: [0, 0, 1] }, 2, 3, 4), peak);
  assert.throws(() => recipe({ terms: [{ ...ring, axis: [0, 2, 0] }] }), /unit vector/);
});

test('jet orientation follows both endpoints with finite end caps', () => {
  const jet: SampleTerm = { id: 'jet', kind: 'jet', startArcsec: [-5, -4, -3], endArcsec: [5, 6, 7], sigmaArcsec: .5,
    weight: 2, evidenceIds: ['jet-axis'] };
  const peak = analyticEmission(jet, 0, 1, 2);
  assert.ok(peak > 0); close(analyticEmission(jet, ...jet.startArcsec), peak); close(analyticEmission(jet, ...jet.endArcsec), peak);
  assert.equal(analyticEmission(jet, 0, 6, 2), 0);
  assert.equal(analyticEmission(jet, 10, 11, 12), 0);
  close(analyticEmission({ ...jet, startArcsec: jet.endArcsec, endArcsec: jet.startArcsec }, 0, 1, 2), peak);
  assert.throws(() => recipe({ terms: [{ ...jet, endArcsec: jet.startArcsec }] }), /coincide/);
});

test('decoded FITS point splats preserve all positive extent and normalized mass support', () => {
  const values = new Float32Array([-4, -2, -3, 1, 5, 3, 4, 4, 0, 0, 0, 9, 100, 100, 100, 0, -100, -100, -100, -2]);
  const fits = decodeFits(encodeFits(values, 4, 5, {}));
  const configured = recipe({ source: { ...fixture.source, height: 5, columns: [0, 1, 2, 3] },
    rawToArcsec: [-2, 0, 0, 10, 0, 3, 0, -5, 0, 0, 4, 8] });
  const prepared = prepareSampledField(fits.values, configured);
  assert.deepEqual(prepared.evidence.rawBounds, { min: [0, -11, -4], max: [18, 4, 24] });
  assert.equal(prepared.evidence.pointCount, 3); assert.equal(prepared.evidence.nonpositiveFluxDiscarded, 2);
  for (let axis = 0; axis < 3; axis++) {
    assert.ok(prepared.bounds.min[axis]! < prepared.evidence.rawBounds.min[axis]!);
    assert.ok(prepared.bounds.max[axis]! > prepared.evidence.rawBounds.max[axis]!);
  }
  close(prepared.ejecta.reduce((a, b) => a + b, 0) / prepared.evidence.normalization, 1 + 2 + 3, 2e-6);
  assert.ok(prepared.ejecta.every(Number.isFinite)); assert.ok(prepared.ejecta.every(n => n >= 0));
  const out: EmissionVector3 = [0, 0, 0], field = prepared.field({ ejecta: 1, pwn: 0 });
  for (const [x, y, z] of [[18, -11, -4], [0, 4, 24], [10, -5, 8]] as const) { field.sampleEmission(x, y, z, out); assert.ok(out[0] > 0); }
});

test('two clouds on one sightline keep their empty intervening depth instead of photo extrusion', () => {
  const configured = recipe(), points = new Float32Array([0, 0, -10, 1, 0, 0, 10, 1]);
  const prepared = prepareSampledField(points, configured), out: EmissionVector3 = [0, 0, 0];
  const field = prepared.field({ ejecta: 1, pwn: 0 });
  field.sampleEmission(0, 0, -10, out); const front = out[0]; assert.ok(front > 0);
  field.sampleEmission(0, 0, 10, out); assert.ok(out[0] > 0);
  field.sampleEmission(0, 0, 0, out); assert.equal(out[0], 0);
  field.sampleEmission(10, 0, 0, out); assert.equal(out[0], 0);
  const stretched = prepared.field({ ejecta: 1, pwn: 0 }, 2);
  stretched.sampleEmission(0, 0, -20, out); close(out[0], front / 2);
});

test('independent wind terms never alter the ejecta array and spectral mixtures remain separate', () => {
  const points = new Float32Array([-10, -10, -10, 1, 10, 10, 10, 1]);
  const wind = prepareSampledField(points, recipe({ terms: [term] }));
  const zeroWind = prepareSampledField(points, recipe({ terms: [{ ...term, weight: 0 }] }));
  assert.deepEqual(wind.ejecta, zeroWind.ejecta);
  assert.ok(zeroWind.pwn.every(n => n === 0)); assert.ok(wind.pwn.some(n => n > 0));
  const out: EmissionVector3 = [0, 0, 0];
  wind.field({ ejecta: 1, pwn: 0 }).sampleEmission(0, 0, 0, out); assert.equal(out[0], 0);
  wind.field({ ejecta: 0, pwn: 1 }).sampleEmission(0, 0, 0, out); const center = out[0]; assert.ok(center > 0);
  wind.field({ ejecta: .2, pwn: .3 }).sampleEmission(0, 0, 0, out); close(out[0], center * .3);
  const swapped = prepareSampledField(points, recipe({ terms: [term], lensComponents: { optical: { ejecta: 0, pwn: 1 }, xray: { ejecta: 1, pwn: 0 } } }));
  assert.deepEqual(swapped.ejecta, wind.ejecta); assert.deepEqual(swapped.pwn, wind.pwn);
});

test('nonfinite point flux cannot contaminate an otherwise valid qualified field', () => {
  for (const flux of [NaN, Infinity, -Infinity]) {
    const points = new Float32Array([-10, -10, -10, 1, 10, 10, 10, flux]);
    assert.throws(() => prepareSampledField(points, recipe()), /[Nn]onfinite|normalization/);
  }
});
