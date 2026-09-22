import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { validatePds4ObservationPolicy, readPds4ColorLabel, decodePds4Color, mapPds4Color } from './observed-pds4.mts';
import {linearToSrgb} from '../color-transfer.mts';

// This test reads only the small pinned label, never an ignored image.
const label = readFileSync(new URL('../../../src/objects/charon/source/observations/nh_charon_color_mosaic.lblx', import.meta.url), 'utf8');
const radius = 2 / Math.PI;
const small = label.replace('<elements>1904</elements>', '<elements>2</elements>').replace('<elements>3808</elements>', '<elements>4</elements>')
  .replaceAll('>606000<', `>${radius}<`).replaceAll('>1000<', '>1<').replaceAll('>10.576695267086<', `>${1 / 90}<`)
  .replace('>-1904000<', '>-2<').replace('>952000<', '>1<');
const policy = { kind: 'pds4-float-rgb', labelPath: 'observations/nh_charon_color_mosaic.lblx',
  lidvid: 'urn:nasa:pds:nh_derived:plutosystem_composition:nh_charon_color_mosaic::1.0',
  bands: [2, 3, 4], wavelengthsNm: [870, 625, 475], displayRange: [0, 100] };
const entry = { path: 'observations/nh_charon_color_mosaic.img', width: 4, height: 2, projection: { referenceRadiusMeters: radius } };
const bytes = () => {
  const b = Buffer.alloc(4 * 2 * 4 * 4);
  for (let band = 0; band < 4; band++) for (let i = 0; i < 8; i++) b.writeFloatLE(10 * (band + 1) + i, (band * 8 + i) * 4);
  return b;
};

test('pinned label independently establishes dimensions, wavelengths, metric coordinates and finite missing bits', () => {
  const g = readPds4ColorLabel(label);
  assert.deepEqual([g.width, g.height, g.bandCount], [3808, 1904, 4]);
  assert.deepEqual(g.wavelengthsNm, [895, 870, 625, 475]);
  assert.deepEqual(g.origin, [-1904000, 952000]);
  assert.equal(g.radius, 606000); assert.equal(g.resolution, 1000); assert.equal(g.centerLongitude, 0);
  assert.equal(g.missingBits, 0xff7ffffb);
});

test('little-endian BSQ channels and north-up east-positive longitudes map without a latitude flip', () => {
  const source = decodePds4Color(bytes(), small, entry, policy);
  assert.deepEqual(source.selected, [8, 16, 24]);
  assert.equal(source.values[10], 22);
  const result = mapPds4Color(source, policy, 4, 2);
  const expected = [2, 3, 0, 1, 6, 7, 4, 5].flatMap(i => [20 + i, 30 + i, 40 + i].map(v => Math.round(255 * linearToSrgb(v / 100))));
  assert.deepEqual([...result.rgb], expected);
  assert.equal(result.missing.reduce((a, b) => a + b), 0);
});

test('finite PDS sentinel and nonfinite values invalidate the entire selected RGB footprint before interpolation', () => {
  const b = bytes(); b.writeUInt32LE(0xff7ffffb, (3 * 8) * 4); b.writeFloatLE(Infinity, (1 * 8 + 4) * 4);
  const source = decodePds4Color(b, small, entry, policy), mapped = mapPds4Color(source, policy, 8, 4);
  assert.equal(source.sourceMissingPixels, 2); assert.equal(source.valid[0], 0); assert.equal(source.valid[4], 0);
  assert.ok(Number.isFinite(source.values[24]));
  assert.ok(mapped.missing.some(v => v === 1)); assert.ok(mapped.missing.some(v => v === 0));
  for (let i = 0; i < mapped.missing.length; i++) if (mapped.missing[i]) assert.deepEqual([...mapped.rgb.subarray(i * 3, i * 3 + 3)], [0, 0, 0]);
});

test('negative observations remain valid and unused-band missing values do not erase selected RGB', () => {
  const b = bytes(); b.writeFloatLE(-.2, (3 * 8 + 2) * 4); b.writeUInt32LE(0xff7ffffb, 2 * 4);
  const source = decodePds4Color(b, small, entry, policy), result = mapPds4Color(source, policy, 4, 2);
  assert.equal(source.valid[2], 1); assert.equal(source.sourceMissingPixels, 0); assert.equal(result.missing[0], 0); assert.equal(result.rgb[2], 0);
});

test('rounded extent retains the source metric origin instead of assigning an exact 360-degree array roll', () => {
  const shifted = small.replace('>-2<', '>-2.1<');
  const result = mapPds4Color(decodePds4Color(bytes(), shifted, entry, policy), policy, 4, 2);
  assert.deepEqual([...result.rgb.subarray(0, 3)], [22.1, 32.1, 42.1].map(v => Math.round(255 * linearToSrgb(v / 100))));
  const expanded = mapPds4Color(decodePds4Color(bytes(), small, entry, policy), policy, 16, 8);
  assert.equal(expanded.missing.reduce((a, b) => a + b), 0);
});

test('unsupported identities, orders, projection conventions, units, scales and unsafe policies fail closed', () => {
  for (const xml of [small.replace('IEEE754LSBSingle', 'IEEE754MSBSingle'), small.replace('Positive East', 'Positive West'),
    small.replace('Planetocentric', 'Planetographic'), small.replace('Last Index Fastest', 'First Index Fastest'),
    small.replace('<cart:a_axis_radius unit="m">', '<cart:a_axis_radius unit="km">'),
    small.replace('<axes>3</axes>', '<axes>3</axes><scaling_factor>2</scaling_factor>'),
    small.replace('<sequence_number>2</sequence_number>', '<sequence_number>3</sequence_number>')]) assert.throws(() => readPds4ColorLabel(xml));
  assert.throws(() => decodePds4Color(bytes().subarray(0, 100), small, entry, policy), /byte length/);
  assert.throws(() => decodePds4Color(bytes(), small, entry, { ...policy, bands: [1, 3, 4] }), /identity, bands/);
  assert.throws(() => validatePds4ObservationPolicy({ ...policy, labelPath: '../other.xml' }), /policy/);
  assert.throws(() => validatePds4ObservationPolicy({ ...policy, displayRange: [1, 0] }), /policy/);
  assert.throws(() => validatePds4ObservationPolicy({ ...policy, colorDisplay: {} }), /unknown colorDisplay/);
});

test('empty or non-decimal zero-valued projection fields cannot masquerade as valid metadata', () => {
  for (const field of ['offset', 'cart:latitude_of_projection_origin', 'cart:standard_parallel_1']) {
    const pattern = new RegExp(`(<${field} unit="[^"]+">)0(?:\\.0*)?(</${field}>)`);
    assert.ok(pattern.test(small), `fixture has a zero-valued ${field}`);
    for (const value of ['', '  ', '0x0', '0b0', 'NaN', 'Infinity']) {
      const corrupted = small.replace(pattern, (_match, opening: string, closing: string) => `${opening}${value}${closing}`);
      assert.throws(() => decodePds4Color(bytes(), corrupted, entry, policy), /Invalid PDS4 number/);
    }
  }
});
