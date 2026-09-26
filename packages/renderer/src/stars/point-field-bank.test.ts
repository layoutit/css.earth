import { expect, test } from 'vitest';
import { encodePointFieldBank, magnitudeDisplayAlphaChange } from '../../../../src/renderers/css/preparation/stars/point-field-bank.js';
import { POINT_FIELD_BANK_HEADER_BYTES, POINT_FIELD_MAGNITUDE_BOUND, decodePointFieldBank } from './point-field-bank.js';
import { IMPERCEPTIBLE_LUMINANCE } from './point-field-projection.js';
import type { PreparedPointFieldBank } from './types.js';

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
  expect(bank.bytes).toBe(bytes.length);
  expect(bank.names).toEqual([[0, 'Aldebaran']]);
  expect(decoded.stars.map(star => star.id)).toEqual(['row:2', 'row:0', 'row:1']);
  expect(decoded.stars.map(star => star.positionUnits)).toEqual(stars.map(star => star.positionUnits));
  expect(decoded.stars.map(star => star.coverageAnchor)).toEqual([true, false, false]);
  // 0.0004 mag is off the millimagnitude grid: it decodes to 0 within the declared bound.
  expect(decoded.stars.map(star => star.absoluteMagnitude)).toEqual([stars[0].absoluteMagnitude, stars[1].absoluteMagnitude, 0]);
  const magnitude = bank.quantization.find(entry => entry.field === 'star.absoluteMagnitude')!;
  expect(magnitude.measured).toBe(stars[2].absoluteMagnitude);
  expect(magnitude.measured).toBeLessThanOrEqual(magnitude.bound);
  expect(decoded.nodes).toEqual(nodes);
  expect(Object.isFrozen(decoded.stars[0]!.positionUnits) && Object.isFrozen(decoded.nodes[0]!.children)).toBe(true);
  // Unaligned views are copied before typed-array decoding.
  const shifted = new Uint8Array(bytes.length + 1); shifted.set(bytes, 1);
  expect(decode(shifted.subarray(1), bank)).toEqual(decoded);
});

test('bank decoding rejects drifted bytes, headers, layouts and ranges', () => {
  const { bytes, bank } = encode(), column = (name: string) => bank.columns.find(entry => entry.name === name)!;
  const tampered = (mutate: (copy: Uint8Array, view: DataView) => void) => {
    const copy = Uint8Array.from(bytes); mutate(copy, new DataView(copy.buffer)); return copy;
  };
  expect(() => decode(bytes.subarray(0, bytes.length - 8), bank)).toThrow('byte length');
  expect(() => decode(tampered(copy => { copy[0] = 0; }), bank)).toThrow('header');
  expect(() => decode(tampered((_, view) => view.setUint32(12, 4, true)), bank)).toThrow('header');
  expect(() => decode(tampered((_, view) => view.setUint32(POINT_FIELD_BANK_HEADER_BYTES, 0, true)), bank)).toThrow('header or directory');
  expect(() => decode(bytes, { ...bank, columns: bank.columns.map((entry, index) => index === 1 ? { ...entry, offset: entry.offset + 8 } : entry) })).toThrow('layout');
  expect(() => decode(tampered(copy => { copy[column('star.colorIndex').offset] = 2; }), bank)).toThrow('star');
  expect(() => decode(tampered((_, view) => view.setUint32(column('star.sourceRow').offset, 0, true)), bank)).toThrow('star');
  expect(() => decode(tampered((_, view) => view.setFloat32(column('star.positionUnits').offset, Number.NaN, true)), bank)).toThrow('star');
  expect(() => decode(tampered((_, view) => view.setFloat32(column('star.positionUnits').offset, 2048, true)), bank)).toThrow('star');
  expect(() => decode(tampered((_, view) => view.setUint32(column('star.coverageAnchor').offset, 3, true)), bank)).toThrow('anchor');
  expect(() => decode(tampered((_, view) => view.setUint32(column('node.children').offset, 9, true)), bank)).toThrow('children');
  expect(() => decode(tampered((_, view) => view.setFloat64(column('node.radiusUnits').offset, -1, true)), bank)).toThrow('node');
  expect(() => decode(bytes, { ...bank, names: [[3, 'Nowhere']] })).toThrow('names');
});

test('encoder refuses rows outside the declared storage and bounds', () => {
  expect(() => encode({ stars: [{ ...stars[0], positionUnits: [0.1, 0, 0] }, ...stars.slice(1)] })).toThrow('float32');
  expect(() => encode({ stars: [{ ...stars[0], absoluteMagnitude: 40 }, ...stars.slice(1)] })).toThrow('int16');
  expect(() => encode({ stars: [{ ...stars[0], id: 'other:7' }, ...stars.slice(1)] })).toThrow('source row');
  // A photometry table steep enough for half a millimagnitude to be visible fails preparation.
  const steep = { ...photometry, step: 1e-4 };
  expect(magnitudeDisplayAlphaChange(steep, atlas, POINT_FIELD_MAGNITUDE_BOUND)).toBeGreaterThan(IMPERCEPTIBLE_LUMINANCE);
  expect(() => encode({ photometry: steep })).toThrow('display threshold');
});
