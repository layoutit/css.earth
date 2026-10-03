import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodePointFieldBank, magnitudeDisplayAlphaChange } from './point-field-bank.ts';
import { POINT_FIELD_BANK_HEADER_BYTES, POINT_FIELD_MAGNITUDE_BOUND, decodePointFieldBank, IMPERCEPTIBLE_LUMINANCE, parsePreparedCssPointFieldManifest, decodePreparedCssPointField, type PreparedPointFieldBank } from '@cssearth/objects';

const frame = { referenceFrame: 'sun-icrf', epochJdTt: 2461286.5, originM: [0, 0, 0], localToReferenceXyzw: [0, 0, 0, 1],
  metersPerUnit: 3.085677581491367e16, boundsUnits: { min: [-1024, -1024, -1024], max: [1024, 1024, 1024] } } as const;
const photometry = { minimumMagnitude: 0, maximumMagnitude: 20, step: 5, floor: 1 / 255, limitingMagnitude: 20, hintsLimitMagnitude: 10, minimumRadiusPx: .6,
  samples: [1, .8, .6, .4, .2].map(luminance => ({ radiusPx: 1, luminance })) };
const atlas = { tileSize: 32, haloRadii: 2.5, coreInnerRadii: .75, coreOuterRadii: 1.25, haloPeak: .08, samplesPerPixelAxis: 4 };
const stars = [
  // Reordered hierarchy rows keep a complete permutation of source rows.
  { id: 'row:2', positionUnits: [-110, 0, -100], absoluteMagnitude: Math.fround(-1.25), colorIndex: 1, name: 'Aldebaran', coverageAnchor: true },
  { id: 'row:0', positionUnits: [Math.fround(-90.1), 0, -100], absoluteMagnitude: Math.fround(4.838), colorIndex: 0, name: null, coverageAnchor: false },
  { id: 'row:1', positionUnits: [10, 0, Math.fround(-100.7)], absoluteMagnitude: Math.fround(0.0004), colorIndex: 0, name: null, coverageAnchor: false },
] as const;
const nodes = [
  { positionUnits: [-50.123456789, 0, -100], radiusUnits: 60.0000000001, absoluteMagnitude: -1.234567890123, colorIndex: 0, first: 0, count: 3, children: [1, 2] },
  { positionUnits: [-100, 0, -100], radiusUnits: 10, absoluteMagnitude: -.75, colorIndex: 1, first: 0, count: 2, children: [] },
  { positionUnits: [10, 0, -100.7], radiusUnits: 0, absoluteMagnitude: 0, colorIndex: 0, first: 2, count: 1, children: [] },
] as const;
const encode = (override: Partial<Parameters<typeof encodePointFieldBank>[0]> = {}) =>
  encodePointFieldBank({ path: 'stars.bin', idPrefix: 'row', frame, colorCount: 2, stars, nodes, photometry, atlas, ...override });
const decode = (bytes: Uint8Array, bank: PreparedPointFieldBank) => decodePointFieldBank(bytes, bank, { frame, colorCount: 2 });

test('bank decodes stars exactly on the float32 source grid and hierarchy nodes losslessly', () => {
  const { bytes, bank } = encode(), decoded = decode(bytes, bank);
  assert.equal(bank.bytes, bytes.length);
  assert.deepEqual(bank.names, [[0, 'Aldebaran']]);
  assert.deepEqual(decoded.stars.map(star => star.id), ['row:2', 'row:0', 'row:1']);
  assert.deepEqual(decoded.stars.map(star => star.positionUnits), stars.map(star => star.positionUnits));
  assert.deepEqual(decoded.stars.map(star => star.coverageAnchor), [true, false, false]);
  // 0.0004 mag is off the millimagnitude grid: it decodes to 0 within the declared bound.
  assert.deepEqual(decoded.stars.map(star => star.absoluteMagnitude), [stars[0].absoluteMagnitude, stars[1].absoluteMagnitude, 0]);
  const magnitude = bank.quantization.find(entry => entry.field === 'star.absoluteMagnitude')!;
  assert.equal(magnitude.measured, stars[2].absoluteMagnitude);
  assert.ok(magnitude.measured <= magnitude.bound);
  assert.deepEqual(decoded.nodes, nodes);
  assert.equal((Object.isFrozen(decoded.stars[0]!.positionUnits) && Object.isFrozen(decoded.nodes[0]!.children)), true);
  // Unaligned views are copied before typed-array decoding.
  const shifted = new Uint8Array(bytes.length + 1); shifted.set(bytes, 1);
  assert.deepEqual(decode(shifted.subarray(1), bank), decoded);
});

test('bank decoding rejects drifted bytes, headers, layouts and ranges', () => {
  const { bytes, bank } = encode(), column = (name: string) => bank.columns.find(entry => entry.name === name)!;
  const tampered = (mutate: (copy: Uint8Array, view: DataView) => void) => {
    const copy = Uint8Array.from(bytes); mutate(copy, new DataView(copy.buffer)); return copy;
  };
  assert.throws(() => decode(bytes.subarray(0, bytes.length - 8), bank), /byte length/);
  assert.throws(() => decode(tampered(copy => { copy[0] = 0; }), bank), /header/);
  assert.throws(() => decode(tampered((_, view) => view.setUint32(12, 4, true)), bank), /header/);
  assert.throws(() => decode(tampered((_, view) => view.setUint32(POINT_FIELD_BANK_HEADER_BYTES, 0, true)), bank), /header or directory/);
  assert.throws(() => decode(bytes, { ...bank, columns: bank.columns.map((entry, index) => index === 1 ? { ...entry, offset: entry.offset + 8 } : entry) }), /layout/);
  assert.throws(() => decode(tampered(copy => { copy[column('star.colorIndex').offset] = 2; }), bank), /star/);
  assert.throws(() => decode(tampered((_, view) => view.setUint32(column('star.sourceRow').offset, 0, true)), bank), /star/);
  assert.throws(() => decode(tampered((_, view) => view.setFloat32(column('star.positionUnits').offset, Number.NaN, true)), bank), /star/);
  assert.throws(() => decode(tampered((_, view) => view.setFloat32(column('star.positionUnits').offset, 2048, true)), bank), /star/);
  assert.throws(() => decode(tampered((_, view) => view.setUint32(column('star.coverageAnchor').offset, 3, true)), bank), /anchor/);
  assert.throws(() => decode(tampered((_, view) => view.setUint32(column('node.children').offset, 9, true)), bank), /children/);
  assert.throws(() => decode(tampered((_, view) => view.setFloat64(column('node.radiusUnits').offset, -1, true)), bank), /node/);
  assert.throws(() => decode(bytes, { ...bank, names: [[3, 'Nowhere']] }), /names/);
});

test('encoder refuses rows outside the declared storage and bounds', () => {
  assert.throws(() => encode({ stars: [{ ...stars[0], positionUnits: [0.1, 0, 0] }, ...stars.slice(1)] }), /float32/);
  assert.throws(() => encode({ stars: [{ ...stars[0], absoluteMagnitude: 40 }, ...stars.slice(1)] }), /int16/);
  assert.throws(() => encode({ stars: [{ ...stars[0], id: 'other:7' }, ...stars.slice(1)] }), /source row/);
  // A photometry table steep enough for half a millimagnitude to be visible fails preparation.
  const steep = { ...photometry, step: 1e-4 };
  assert.ok(magnitudeDisplayAlphaChange(steep, atlas, POINT_FIELD_MAGNITUDE_BOUND) > IMPERCEPTIBLE_LUMINANCE);
  assert.throws(() => encode({ photometry: steep }), /display threshold/);
});

test('encoded bank manifest passes the objects parser with bounded display quantization', () => {
  const { bytes, bank } = encode();
  const manifest = parsePreparedCssPointFieldManifest({ schema: 'cssearth-css-point-field-bank@1', id: 'fixture', frame, bank,
    atlas: { path: 'atlas.webp', columns: 2, tileSize: 32, colors: [[255, 255, 255], [255, 128, 0]], haloRadii: atlas.haloRadii },
    photometry, policy: { activeSlots: 3, transitionSlots: 3, maxErrorPx: 2, transitionMs: 180 },
    labels: { activeSlots: 1, transitionSlots: 1, capHeightPx: 12, gapPx: 7, maxAlpha: .55, fadeMs: 300 },
    resources: [{ path: 'atlas.webp', width: 64, height: 32, bytes: 1 }] });
  assert.equal(decodePreparedCssPointField(manifest, bytes).stars.length, stars.length);
  const magnitude = manifest.bank.quantization.find(entry => entry.field === 'star.absoluteMagnitude')!;
  assert.equal(magnitude.bound, POINT_FIELD_MAGNITUDE_BOUND);
  assert.ok(magnitude.measured >= 0 && magnitude.measured <= magnitude.bound);
  assert.equal(magnitude.displayAlphaChange, magnitudeDisplayAlphaChange(manifest.photometry, atlas, magnitude.bound));
  assert.ok(magnitude.displayAlphaChange < IMPERCEPTIBLE_LUMINANCE);
  for (const field of manifest.bank.quantization.filter(entry => entry !== magnitude)) assert.deepEqual([field.bound, field.measured, field.displayAlphaChange], [0, 0, 0]);
});
