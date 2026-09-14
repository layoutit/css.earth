import assert from 'node:assert/strict';
import test from 'node:test';
import { extractEvidenceFields, registerEvidenceRaster } from './fields.js';
import { combineEvidence, inspectEvidence } from './combine.js';
import { evidenceGrid } from './provider.js';
import { readEvidenceSettings, type EvidenceGrid, type EvidenceInputs, type EvidenceSource } from './model.js';

function grid(size: number): EvidenceGrid {
  return { width: size, height: size, frameWidth: size, frameHeight: size, originX: 0, originY: 0, extentWidth: size, extentHeight: size,
    fieldArcminutes: [size / 60, size / 60], arcsecondsPerPixel: 1 };
}
function fixture(width = 128) {
  const luminance = new Float32Array(width * width), footprint = new Uint8Array(width * width).fill(1);
  for (let y = 0; y < width; y++) for (let x = 0; x < width; x++) {
    const bend = width / 2 + Math.sin(y / 17) * 9;
    luminance[y * width + x] = .1 + .2 * Math.exp(-(((x - bend) / 5) ** 2)) + .008 * Math.sin(x * 1.8 + y * 2.3);
  }
  return { luminance, footprint, width };
}
const scales = [1.25, 2.5, 5, 10, 20];
function source(id: string, width = 128): EvidenceSource {
  const image = fixture(width), fields = extractEvidenceFields(image.luminance, image.footprint, width, width, scales, .7);
  return { id, label: id, sourceSha256: '0'.repeat(64), mapSha256: '1'.repeat(64), sourcePanelSha256: '2'.repeat(64),
    imageToFrame: [1, 0, 0, 1, 0, 0], workingWidth: width, workingHeight: width, registeredRgba: new Uint8Array(width * width * 4),
    footprint: image.footprint, ...fields, samplingArcseconds: 1 };
}
function inputs(sources: EvidenceSource[]): EvidenceInputs {
  return { identity: 'test', grid: grid(sources[0].workingWidth), sources,
    method: { version: 'test', scaleArcseconds: scales, samplingLimitation: '', normalization: '', boundary: '' } };
}
test('registration preserves asymmetric landmarks under native resampling, rotation and translation', () => {
  const rgba = new Uint8Array(16 * 16 * 4); for (let p = 0; p < 256; p++) rgba[p * 4 + 3] = 255;
  rgba[(3 * 16 + 2) * 4] = 255;
  const result = registerEvidenceRaster(rgba, 16, 16, 32, 32, [0, .5, -.5, 0, 20, 4], grid(32));
  // Working center(2.5,3.5) -> native(5,7) -> frame(16.5,6.5).
  assert.equal(result.registeredRgba[(6 * 32 + 16) * 4], 255);
  assert.equal(result.footprint[6 * 32 + 16], 1);
  assert.equal(result.footprint[0], 0);
  assert.equal(result.registeredRgba[3], 0);
});
test('registered grid retains adjusted footprints outside the original common frame', () => {
  const value = evidenceGrid({ width: 100, height: 100, fieldArcminutes: [10, 10] }, [
    { nativeWidth: 100, nativeHeight: 100, imageToFrame: [1, 0, 0, 1, -40, 10] },
  ]);
  assert.equal(value.originX, -40); assert.equal(value.extentWidth, 140); assert.equal(value.extentHeight, 110);
});
test('different working resolutions retain the same angular ridge location after registration and common-scale smoothing', () => {
  const results = [64, 128].map(size => {
    const rgba = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const skyX = (x + .5) * 128 / size, skyY = (y + .5) * 128 / size;
      const ridge = 64 + 7 * Math.sin(skyY / 19), value = Math.round(20 + 150 * Math.exp(-(((skyX - ridge) / 4) ** 2)));
      const p = (y * size + x) * 4; rgba[p] = value; rgba[p + 1] = value; rgba[p + 2] = value; rgba[p + 3] = 255;
    }
    const registered = registerEvidenceRaster(rgba, size, size, 128, 128, [1, 0, 0, 1, 0, 0], grid(128));
    return extractEvidenceFields(registered.luminance, registered.footprint, 128, 128, [2, 4, 8, 16, 32], .7 * 128 / size);
  });
  for (const y of [40, 55, 70, 85]) {
    const peaks = results.map(result => {
      let best = 40; for (let x = 41; x < 88; x++) if (result.channels.ridges.signal[y * 128 + x] > result.channels.ridges.signal[y * 128 + best]) best = x;
      return best;
    });
    assert.ok(Math.abs(peaks[0] - peaks[1]) <= 1, `resolution-dependent ridge at ${peaks}`);
    assert.ok(Math.abs(peaks[0] - (64 + 7 * Math.sin((y + .5) / 19))) <= 2);
  }
});
test('crop boundaries and internal no-data holes do not create ridges or compact structures', () => {
  const width = 128, luminance = new Float32Array(width * width).fill(.4), footprint = new Uint8Array(width * width);
  for (let y = 8; y < 120; y++) for (let x = 16; x < 112; x++) if (!(x >= 60 && x < 68 && y > 30 && y < 80)) footprint[y * width + x] = 1;
  // Deliberately populate no-data with extreme junk: the convolution must ignore it.
  for (let p = 0; p < luminance.length; p++) if (!footprint[p]) luminance[p] = 100;
  const result = extractEvidenceFields(luminance, footprint, width, width, scales, .7);
  for (const plane of Object.values(result.channels)) {
    assert.ok(plane.signal.every(v => Number.isFinite(v) && v < .001));
    assert.equal(plane.coverage[64 * width + 64], 0);
  }
});
test('source-local normalization is stable under fixed brightness and additive background differences', () => {
  const a = fixture(), b = Float32Array.from(a.luminance, v => v * 2.7 + .23);
  const left = extractEvidenceFields(a.luminance, a.footprint, a.width, a.width, scales, .7);
  const right = extractEvidenceFields(b, a.footprint, a.width, a.width, scales, .7);
  for (const id of ['broad', 'ridges', 'compact'] as const) {
    let error = 0, total = 0;
    for (let p = 0; p < b.length; p++) { error += Math.abs(left.channels[id].signal[p] - right.channels[id].signal[p]); total += left.channels[id].signal[p]; }
    assert.ok(error / Math.max(1, total) < .003, `${id} changed by ${error / total}`);
  }
});
test('single-band structures survive blank or uncovered other bands; repeat evidence has separate agreement', () => {
  const a = source('a'), b = structuredClone(a); b.id = 'b';
  const one = combineEvidence(inputs([a]), { channel: 'ridges', weights: [1], sensitivity: 1 });
  assert.ok(one.union.some(v => v > .2)); assert.ok(one.agreement.every(v => v === 0));
  const paired = combineEvidence(inputs([a, b]), { channel: 'ridges', weights: [1, 1], sensitivity: 1 });
  assert.deepEqual(paired.union, one.union);
  const peak = one.union.indexOf(Math.max(...one.union)); assert.ok(paired.agreement[peak] > .2);
  b.channels.ridges.signal.fill(0);
  const blank = combineEvidence(inputs([a, b]), { channel: 'ridges', weights: [1, 1], sensitivity: 1 });
  assert.deepEqual(blank.union, one.union); assert.equal(blank.agreement[peak], 0);
  b.channels.ridges.coverage.fill(0); b.footprint.fill(0);
  const missingInputs = inputs([a, b]), missing = combineEvidence(missingInputs, { channel: 'ridges', weights: [1, 1], sensitivity: 1 });
  assert.deepEqual(missing.union, one.union);
  const inspection = inspectEvidence(missingInputs, missing, peak % 128, Math.floor(peak / 128));
  assert.equal(inspection.sources[1].observed, false); assert.equal(inspection.sources[1].value, null);
});
test('crossed ridge tangents are not repeated compatible evidence', () => {
  const a = source('a'), b = structuredClone(a); b.id = 'b';
  for (let p = 0; p < b.ridgeDirectionX.length; p++) { b.ridgeDirectionX[p] = -a.ridgeDirectionY[p]; b.ridgeDirectionY[p] = a.ridgeDirectionX[p]; }
  const result = combineEvidence(inputs([a, b]), { channel: 'ridges', weights: [1, 1], sensitivity: 1 });
  assert.ok(result.union.some(v => v > .2)); assert.ok(result.agreement.every(v => v < 1e-6));
});
test('all-channel agreement cannot pair different morphology channels', () => {
  const a = source('a'), b = structuredClone(a); b.id = 'b';
  for (const channel of ['ridges', 'compact'] as const) a.channels[channel].signal.fill(0);
  for (const channel of ['ridges', 'broad'] as const) b.channels[channel].signal.fill(0);
  a.channels.broad.signal[64 * 128 + 64] = 20; b.channels.compact.signal[64 * 128 + 64] = 20;
  const result = combineEvidence(inputs([a, b]), { channel: 'all', weights: [1, 1], sensitivity: 1 });
  assert.ok(result.union[64 * 128 + 64] > .5); assert.equal(result.agreement[64 * 128 + 64], 0);
});
test('channel and source controls change fields without manufacturing coverage', () => {
  const a = source('a'), data = inputs([a]);
  const low = combineEvidence(data, { channel: 'ridges', weights: [1], sensitivity: .25 });
  const high = combineEvidence(data, { channel: 'ridges', weights: [1], sensitivity: 4 });
  assert.ok(high.union.reduce((sum, v) => sum + v, 0) > low.union.reduce((sum, v) => sum + v, 0));
  assert.deepEqual(high.coverage, low.coverage);
  const disabled = combineEvidence(data, { channel: 'all', weights: [0], sensitivity: 4 });
  assert.ok(disabled.union.every(v => v === 0)); assert.ok(disabled.coverage[0].every(v => v === 0));
  assert.throws(() => readEvidenceSettings({ channel: 'invalid', weights: [1], sensitivity: 1 }, 1));
  assert.throws(() => readEvidenceSettings({ channel: 'all', weights: [NaN], sensitivity: 1 }, 1));
});
