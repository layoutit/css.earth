import test from 'node:test';
import assert from 'node:assert/strict';
import { type EmissionVector3, prepareSampledField, prepareSampledMaterial, sampledPointColors } from '@cssearth/bake/volume';
import { gridDiffuse, type DiffuseAtom } from '@cssearth/nebula-reconstruction/methods/sampled/emission-fit';
import { readSampledRecipe } from '../../../features/sampled-prior/model.ts';

const points = new Float32Array([-1.2, 0, -5, 1, 1.2, 0, 5, 1, -15, -15, -15, 1e-10, 15, 15, 15, 1e-10]);
function recipe() {
  return readSampledRecipe({ schema: 'cssearth-sampled-nebula@1', id: 'material-example', centerIcrsDegrees: [80, 22],
    evidence: { path: 'labs/nebula/models/example/physical-evidence.json', sha256: 'a'.repeat(64) },
    source: { path: '.local/nebula-lab/physical/example/points.fits', sha256: 'b'.repeat(64),
      url: 'https://example.org/points.fits', width: 4, height: 4, columns: [0, 1, 2, 3] },
    rawToArcsec: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0],
    grid: { longestAxis: 32, blurSigmaCells: .9, weightExponent: .5, peakOpticalDepth: 1 },
    terms: [], lensComponents: { optical: { ejecta: 1, pwn: 0 } } });
}
const redBlue = { id: 'optical', sampleRgb(x: number, _y: number, out: EmissionVector3) {
  out[0] = x < 0 ? 255 : 0; out[1] = 0; out[2] = x < 0 ? 0 : 255; return true;
} };

test('qualified point colors remain at finite source depths where sky footprints overlap; XY extrusion fails', () => {
  const configured = recipe(), prepared = prepareSampledField(points, configured);
  const before = { points: points.slice(), ejecta: prepared.ejecta.slice(), wind: prepared.pwn.slice(), bounds: structuredClone(prepared.bounds) };
  let calls = 0;
  const material = prepareSampledMaterial(points, configured, prepared, { ...redBlue,
    sampleRgb(x, y, out) { calls++; return redBlue.sampleRgb(x, y, out); } }, { ejecta: 1, pwn: 0 });
  const preparedCalls = calls, near: EmissionVector3 = [0, 0, 0], far: EmissionVector3 = [0, 0, 0];
  function assertFiniteDepthColors(sample: typeof material.sampleMaterial) {
    assert.equal(sample(0, 0, -5, near), true); assert.equal(sample(0, 0, 5, far), true);
    assert.ok(near[0] > 254 && near[1] < 1 && near[2] < 1, `Near point must stay red: ${near}`);
    assert.ok(far[2] > 254 && far[0] < 1 && far[1] < 1, `Far point must stay blue: ${far}`);
  }
  assertFiniteDepthColors(material.sampleMaterial);
  assert.throws(() => assertFiniteDepthColors((x, y, _z, out) => redBlue.sampleRgb(x, y, out)), /Near point must stay red/);
  assert.equal(material.sampleMaterial(0, 0, 0, near), false, 'The gap between finite emitters must stay empty.');
  assert.equal(material.sampleMaterial(0, 0, 12, near), false, 'An image cannot extend source emission beyond its finite support.');
  assert.equal(calls, preparedCalls, 'Image pixels must not be read during subsequent 3D material samples.');
  assert.equal(preparedCalls, 4); assert.equal(material.receipt.observedPoints, 4); assert.equal(material.receipt.uncoveredPoints, 0);
  assert.deepEqual(points, before.points); assert.deepEqual(prepared.ejecta, before.ejecta);
  assert.deepEqual(prepared.pwn, before.wind); assert.deepEqual(prepared.bounds, before.bounds);
});

test('uncovered finite emitters retain neutral contributions and explicit coverage', () => {
  const configured = recipe(), values = points.slice(); values[6] = -5;
  const prepared = prepareSampledField(values, configured), rgb: EmissionVector3 = [0, 0, 0];
  const partial = prepareSampledMaterial(values, configured, prepared, { id: 'partial', sampleRgb(x, _y, out) {
    out[0] = 255; out[1] = out[2] = 0; return x < 0;
  } }, { ejecta: 1, pwn: 0 });
  assert.equal(partial.receipt.observedPoints, 2); assert.equal(partial.receipt.uncoveredPoints, 2);
  assert.ok(partial.sampleMaterial(0, 0, -5, rgb));
  assert.ok(rgb[0] > 254 && rgb[1] > 90 && rgb[1] < 170 && Math.abs(rgb[1] - rgb[2]) < 1,
    `Missing source should mix neutral with red, preserving emission: ${rgb}`);
  const absent = prepareSampledMaterial(values, configured, prepared, { id: 'absent', sampleRgb() { return false; } }, { ejecta: 1, pwn: 0 });
  assert.equal(absent.sampleMaterial(0, 0, -5, rgb), false); assert.equal(absent.receipt.uncoveredPoints, 4);
  const black = prepareSampledMaterial(values, configured, prepared, { id: 'black', sampleRgb(_x, _y, out) { out.fill(0); return true; } }, { ejecta: 1, pwn: 0 });
  assert.equal(black.sampleMaterial(0, 0, -5, rgb), false); assert.equal(black.receipt.uncoveredPoints, 4);
});

test('a finite diffuse atom owns one footprint color instead of repeating an image feature through its depth', () => {
  const configured = recipe(), prepared = prepareSampledField(points, configured);
  const atoms: DiffuseAtom[] = [{ centerArcsec: [0, 0, 0], sigmaArcsec: 1.5 }], coefficients = [1];
  const diffuse = gridDiffuse(prepared, atoms, coefficients), beforeDiffuse = diffuse.slice();
  const striped = { id: 'stripe', sampleRgb(x: number, _y: number, out: EmissionVector3) {
    out[0] = Math.abs(x) < .4 ? 255 : 0; out[1] = 0; out[2] = Math.abs(x) < .4 ? 0 : 255; return true;
  } };
  const material = prepareSampledMaterial(points, configured, prepared, striped, { ejecta: 0, pwn: 0 },
    { atoms, coefficients, diffuse, ejectaGain: 1 });
  function assertAttachedAtom(sample: typeof material.sampleMaterial) {
    const center: EmissionVector3 = [0, 0, 0], offset: EmissionVector3 = [0, 0, 0];
    assert.ok(sample(0, 0, 0, center));
    for (const p of [[1.5, 0, 0], [0, 0, 1.5], [-1, 0, 2]] as EmissionVector3[]) {
      assert.ok(sample(...p, offset));
      assert.ok(offset.every((channel, c) => Math.abs(channel - center[c]) < 1),
        `One atom cannot contain an extruded source stripe: ${center} versus ${offset}`);
    }
  }
  assertAttachedAtom(material.sampleMaterial);
  assert.throws(() => assertAttachedAtom((x, y, _z, out) => striped.sampleRgb(x, y, out)), /extruded source stripe/);
  const rgb: EmissionVector3 = [0, 0, 0]; assert.equal(material.sampleMaterial(0, 0, 8, rgb), false);
  assert.deepEqual(diffuse, beforeDiffuse); assert.equal(material.receipt.diffuseColors.length, 1);
});

test('invalid material fit lengths and invalid observed color fail before transport', () => {
  const configured = recipe(), prepared = prepareSampledField(points, configured);
  const atoms: DiffuseAtom[] = [{ centerArcsec: [0, 0, 0], sigmaArcsec: 1 }], diffuse = gridDiffuse(prepared, atoms, [1]);
  const base = { atoms, coefficients: [1], diffuse, ejectaGain: 1 }, weights = { ejecta: 1, pwn: 0 };
  assert.throws(() => prepareSampledMaterial(points.slice(4), configured, prepared, redBlue, weights), /source count/);
  assert.throws(() => prepareSampledMaterial(points, configured, prepared, redBlue, weights, { ...base, coefficients: [] }), /component fit/);
  assert.throws(() => prepareSampledMaterial(points, configured, prepared, redBlue, weights, { ...base, diffuse: new Float32Array(1) }), /grid shape/);
  for (const invalid of [NaN, Infinity, -1, 256]) assert.throws(() => prepareSampledMaterial(points, configured, prepared,
    { id: 'invalid', sampleRgb(_x, _y, out) { out[0] = invalid; out[1] = out[2] = 0; return true; } }, weights), /Invalid emitter material pixel/);
});

test('compact emitter colors regenerate the identical material without source images', () => {
  const configured=recipe(), prepared=prepareSampledField(points,configured);
  const original=prepareSampledMaterial(points,configured,prepared,redBlue,{ejecta:1,pwn:0});
  const replay=prepareSampledMaterial(points,configured,prepared,{id:'optical',sampleRgb(){throw new Error('Source images unavailable');}},
    {ejecta:1,pwn:0},undefined,undefined,{pointColors:sampledPointColors(points,configured,redBlue),windColors:[],atomColors:[]});
  assert.deepEqual(replay.gridMaterial,original.gridMaterial);
});
