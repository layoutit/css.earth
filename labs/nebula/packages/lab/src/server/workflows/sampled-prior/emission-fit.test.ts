import assert from 'node:assert/strict';
import { test } from 'node:test';
import { type EmissionVector3, type SkyBounds, prepareSampledField, type SpatialField, type SampledEmissionFit } from '@cssearth/bake/volume';
import type { CompilerImage } from '../compiler/images.ts';
import { readSampledRecipe, verifySampledEvidence } from '../../../features/sampled-prior/model.ts';
import { diffuseAtomEmission, diffuseAtomProjection, diffuseAtoms, fitSampledEmission, gridDiffuse } from '@cssearth/nebula-reconstruction/methods/sampled/emission-fit';

const fit: SampledEmissionFit = {
  sourceIds: ['optical'], evidenceIds: ['authored-diffuse'], centerArcsec: [0, 0, 0], axis: [.6, 0, .8],
  radiiArcsec: [9, 7, 6], spacingArcsec: 5, sigmaArcsec: 2.5, imageWidth: 40, iterations: 180,
  regularization: .001, maximumCoefficient: 3, maximumEjectaGain: 3,
};
const fixture = {
  schema: 'cssearth-sampled-nebula@1', id: 'emission-example', centerIcrsDegrees: [80, 22],
  evidence: { path: 'labs/nebula/models/example/physical-evidence.json', sha256: 'a'.repeat(64) },
  source: { path: '.local/nebula-lab/physical/example/points.fits', sha256: 'b'.repeat(64),
    url: 'https://example.org/points.fits', width: 4, height: 3, columns: [0, 1, 2, 3] },
  rawToArcsec: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0],
  grid: { longestAxis: 64, blurSigmaCells: .5, weightExponent: .5, peakOpticalDepth: .3 },
  terms: [{ kind: 'ellipsoid', id: 'wind', centerArcsec: [-4, 0, 0], sigmaArcsec: [1, 1, 1],
    weight: .08, evidenceIds: ['authored-wind'] }],
  lensComponents: { optical: { ejecta: 1, pwn: 1 }, xray: { ejecta: 0, pwn: 1 } }, emissionFit: fit,
};
const sky: SkyBounds = { min: [-12, -12], max: [12, 12] };
const source = new Float32Array([-20, -20, -20, 1, 20, 20, 20, 1, 3, 0, -2, 1]);
function prepared() { return prepareSampledField(source, readSampledRecipe(fixture)); }
function close(actual: number, expected: number, tolerance: number) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected}, tolerance ${tolerance}`);
}
/** Independent midpoint integration exercises the field actually consumed by the baker. */
function integrate(field: SpatialField, x: number, y: number, steps = 128): number {
  const dz = (field.bounds.max[2] - field.bounds.min[2]) / steps, out: EmissionVector3 = [0, 0, 0];
  let sum = 0;
  for (let i = 0; i < steps; i++) { field.sampleEmission(x, y, field.bounds.min[2] + (i + .5) * dz, out); sum += out[0] * dz; }
  return sum;
}
function observation(base: SpatialField, brightness = 1): Pick<CompilerImage, 'id' | 'sampleRgb'> {
  return { id: 'optical', sampleRgb(x, y, out) {
    // Two smooth structures deliberately do not share the fitter's atom centers or widths.
    const diffuse = .65 * Math.exp(-((x + 2.4) ** 2 + (y - 1.7) ** 2) / (2 * 3.1 ** 2)) +
      .38 * Math.exp(-((x - 4.7) ** 2 + (y + 2.1) ** 2) / (2 * 2.8 ** 2));
    const peak = 255 * (1 - Math.exp(-brightness * (integrate(base, x, y) + diffuse)));
    out[0] = peak; out[1] = peak * .8; out[2] = peak * .5;
    return true;
  } };
}

test('finite 3D atom projects to its numerically integrated emission and tapers in depth', () => {
  const atom = { centerArcsec: [2, -3, 5] as EmissionVector3, sigmaArcsec: 2.5 };
  for (const radius of [0, 1, 2.7, 3.9, 4, 5]) {
    const x = atom.centerArcsec[0] + radius * atom.sigmaArcsec, steps = 4000;
    const dz = 8 * atom.sigmaArcsec / steps;
    let integral = 0;
    for (let i = 0; i < steps; i++) integral += diffuseAtomEmission(atom, x, -3, 5 - 4 * atom.sigmaArcsec + (i + .5) * dz) * dz;
    close(diffuseAtomProjection(atom, x, -3), integral, 2e-6);
  }
  const center = diffuseAtomEmission(atom, 2, -3, 5);
  close(diffuseAtomEmission(atom, 2, -3, 7.5) / center, Math.exp(-.5), 1e-12);
  close(diffuseAtomEmission(atom, 4.5, -3, 5), diffuseAtomEmission(atom, 2, -3, 7.5), 1e-12);
  assert.equal(diffuseAtomEmission(atom, 2, -3, 15), 0);
  assert.equal(diffuseAtomEmission(atom, 2, -3, -5), 0);
});

test('fixed 3D supports stay inside the field and gridding adds finite nonnegative emission', () => {
  const data = prepared(), beforeEjecta = data.ejecta.slice(), beforeWind = data.pwn.slice();
  const atoms = diffuseAtoms(data, fit);
  assert.ok(atoms.length > 3);
  assert.ok(new Set(atoms.map(atom => atom.centerArcsec[2])).size > 2);
  for (const atom of atoms) for (let axis = 0; axis < 3; axis++) {
    assert.ok(atom.centerArcsec[axis]! - 4 * atom.sigmaArcsec >= data.bounds.min[axis]!);
    assert.ok(atom.centerArcsec[axis]! + 4 * atom.sigmaArcsec <= data.bounds.max[axis]!);
  }
  const added = gridDiffuse(data, atoms, atoms.map((_, index) => index === 0 ? .8 : 0));
  assert.ok(added.some(value => value > 0)); assert.ok(added.every(value => Number.isFinite(value) && value >= 0));
  assert.deepEqual(data.ejecta, beforeEjecta); assert.deepEqual(data.pwn, beforeWind);
  const atom = atoms[0]!, out: EmissionVector3 = [0, 0, 0], field = data.field({ ejecta: 0, pwn: 0 }, 1, added);
  field.sampleEmission(...atom.centerArcsec, out); const peak = out[0]; assert.ok(peak > 0);
  field.sampleEmission(atom.centerArcsec[0], atom.centerArcsec[1], atom.centerArcsec[2] + 2.5, out);
  assert.ok(out[0] > 0 && out[0] < peak * .8);
  field.sampleEmission(atom.centerArcsec[0], atom.centerArcsec[1], atom.centerArcsec[2] + 11, out); assert.equal(out[0], 0);
  assert.throws(() => gridDiffuse(data, atoms, []), /coefficients differ/);
  for (const bad of [-1, NaN, Infinity]) assert.throws(() => gridDiffuse(data, [atom], [bad]), /coefficient/);
  // Reject candidate growth before walking the lattice, including schema-valid extreme envelopes.
  for (const radius of [25, 1e5]) {
    const huge = readSampledRecipe({ ...fixture, emissionFit: { ...fit, radiiArcsec: [radius, radius, radius], spacingArcsec: 1 } }).emissionFit;
    assert.ok(huge);
    assert.throws(() => diffuseAtoms(data, huge), /bounded candidate lattice/);
  }
  assert.throws(() => diffuseAtoms(data, { ...fit, radiiArcsec: [10, 10, 10], spacingArcsec: 1, sigmaArcsec: 1 }), /bounded fit/);
  const signal = AbortSignal.abort(new Error('cancel-fit'));
  assert.throws(() => gridDiffuse(data, atoms, atoms.map(() => 1), signal), /cancel-fit/);
});

test('image fitting improves withheld and independently sampled pixels without moving measured or inferred geometry', () => {
  const data = prepared(), beforeEjecta = data.ejecta.slice(), beforeWind = data.pwn.slice(), beforeSource = source.slice();
  const beforeBounds = structuredClone(data.bounds), original = data.field({ ejecta: 1, pwn: 1 }), image = observation(original);
  const result = fitSampledEmission(data, image, { ejecta: 1, pwn: 1 }, fit, sky);
  const bright = fitSampledEmission(data, observation(original, 1.4), { ejecta: 1, pwn: 1 }, fit, sky);
  assert.deepEqual(data.ejecta, beforeEjecta); assert.deepEqual(data.pwn, beforeWind); assert.deepEqual(source, beforeSource);
  assert.deepEqual(data.bounds, beforeBounds); assert.deepEqual(result.field.bounds, beforeBounds);
  assert.deepEqual(result.receipt.atoms, bright.receipt.atoms);
  assert.ok(bright.receipt.coefficients.reduce((a, b) => a + b, 0) > result.receipt.coefficients.reduce((a, b) => a + b, 0) * 1.2);
  assert.ok(result.diffuse.some(n => n > 0)); assert.ok(result.diffuse.every(n => Number.isFinite(n) && n >= 0));
  assert.ok(result.receipt.validationPixels > 100);
  assert.equal(result.receipt.trainingPixels + result.receipt.validationPixels, fit.imageWidth ** 2);
  assert.ok(result.receipt.validationAfterRmse < result.receipt.validationBeforeRmse * .5);
  assert.ok(result.receipt.missingAfter < result.receipt.missingBefore * .5);
  let beforeError = 0, afterError = 0, noDiffuseError = 0;
  const noDiffuse = data.field({ ejecta: result.receipt.ejectaGain, pwn: 1 }), rgb: EmissionVector3 = [0, 0, 0];
  // Offset points are not the train or validation raster centers, and integrate baked 3D values.
  for (let y = 0; y < 17; y++) for (let x = 0; x < 19; x++) {
    const px = -11.5 + (x + .31) * 23 / 19, py = -11.5 + (y + .73) * 23 / 17;
    image.sampleRgb(px, py, rgb); const target = rgb[0] / 255;
    beforeError += ((1 - Math.exp(-integrate(original, px, py))) - target) ** 2;
    afterError += ((1 - Math.exp(-integrate(result.field, px, py))) - target) ** 2;
    noDiffuseError += ((1 - Math.exp(-integrate(noDiffuse, px, py))) - target) ** 2;
  }
  const acceptsReconstruction = (error: number) => assert.ok(error < beforeError * .25, 'missing diffuse structure remains');
  acceptsReconstruction(afterError);
  // Explicit no-fit and no-diffuse mutations must fail the SAME acceptance assertion.
  assert.throws(() => acceptsReconstruction(beforeError), /missing diffuse/);
  assert.throws(() => acceptsReconstruction(noDiffuseError), /missing diffuse/);
});

test('sampled recipe rejects malformed fitting controls and unowned source/evidence identities', () => {
  assert.deepEqual(readSampledRecipe(fixture).emissionFit, fit);
  const invalid: unknown[] = [null, {}, { ...fit, sourceIds: [] }, { ...fit, sourceIds: ['optical', 'optical'] },
    { ...fit, sourceIds: ['missing-lens'] }, { ...fit, evidenceIds: [] }, { ...fit, evidenceIds: ['wrong id'] },
    { ...fit, axis: [0, 0, 0] }, { ...fit, axis: [0, 0, 2] }, { ...fit, axis: [0, NaN, 1] },
    { ...fit, radiiArcsec: [9, 0, 6] }, { ...fit, centerArcsec: [0, 0, Infinity] },
    { ...fit, sigmaArcsec: 0 }, { ...fit, spacingArcsec: -1 }, { ...fit, imageWidth: 32.5 },
    { ...fit, imageWidth: 257 }, { ...fit, iterations: 0 }, { ...fit, iterations: 1.5 },
    { ...fit, regularization: 0 }, { ...fit, maximumCoefficient: Infinity }, { ...fit, maximumEjectaGain: .5 }];
  for (const emissionFit of invalid) assert.throws(() => readSampledRecipe({ ...fixture, emissionFit }), TypeError);
  const ledger = { schema: 'cssearth-nebula-physical-evidence@1', subjectId: fixture.id, sources: [],
    evidence: [{ id: 'authored-wind', classification: 'authored', sourceIds: [] },
      { id: 'authored-diffuse', classification: 'authored', sourceIds: [] }] };
  assert.doesNotThrow(() => verifySampledEvidence(readSampledRecipe(fixture), ledger));
  assert.throws(() => verifySampledEvidence(readSampledRecipe(fixture), { ...ledger, evidence: ledger.evidence.slice(0, 1) }), /missing physical evidence/);
});

test('insufficient image coverage and malformed covered pixels fail before publishing fitted material', () => {
  const data = prepared(), rgbImage: Pick<CompilerImage, 'id' | 'sampleRgb'> = { id: 'optical', sampleRgb(_x, _y, out) { out.fill(1); return false; } };
  assert.throws(() => fitSampledEmission(data, rgbImage, { ejecta: 1, pwn: 1 }, fit, sky), /coverage/);
  for (const value of [NaN, Infinity, -1, 256]) {
    const badImage: Pick<CompilerImage, 'id' | 'sampleRgb'> = { id: 'optical', sampleRgb(_x, _y, out) { out.fill(value); return true; } };
    assert.throws(() => fitSampledEmission(data, badImage, { ejecta: 1, pwn: 1 }, fit, sky), /pixel/);
  }
  for (const validationOnly of [true, false]) {
    const onePartition: Pick<CompilerImage, 'id' | 'sampleRgb'> = { id: 'optical', sampleRgb(x, y, out) {
      out.fill(40);
      const column = Math.floor((x - sky.min[0]) / (sky.max[0] - sky.min[0]) * fit.imageWidth);
      const row = Math.floor((sky.max[1] - y) / (sky.max[1] - sky.min[1]) * fit.imageWidth);
      return ((column + 3 * row) % 7 === 0) === validationOnly;
    } };
    assert.throws(() => fitSampledEmission(data, onePartition, { ejecta: 1, pwn: 1 }, fit, sky), /training and validation/);
  }
});
