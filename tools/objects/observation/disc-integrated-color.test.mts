import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { discIntegratedColor, filterReflectance, parseCieTable, parseDiscColorRecord } from './disc-integrated-color.mts';

const root = new URL('../../../src/objects/makemake/source/', import.meta.url);
const read = async (path: string) => readFile(new URL(path, root));
const colorMatching = parseCieTable((await read('reference/CIE_xyz_1931_2deg.csv')).toString('utf8'), 3);
const illuminant = parseCieTable((await read('reference/CIE_std_illum_D65.csv')).toString('utf8'), 1);
const makemake = JSON.parse((await read('photometry/disc-color.json')).toString('utf8'));
const withObject = (indices: Record<string, number>) => ({ ...makemake, object: { ...makemake.object,
  indices: Object.fromEntries(Object.entries(indices).map(([name, value]) => [name, { value }])) } });

test('an object with the Sun\'s colours is neutral at its geometric albedo', () => {
  const sun = Object.fromEntries(Object.entries(makemake.sun.indices).map(([name, value]) => [name, (value as { value: number }).value]));
  const color = discIntegratedColor(parseDiscColorRecord(withObject(sun)), colorMatching, illuminant);
  assert.deepEqual(color.reflectance.map(([, value]) => value), [1, 1, 1, 1]);
  for (const channel of color.linear) assert.ok(Math.abs(channel - 0.82) < 1e-3, `D65 white scaled to the albedo, got ${color.linear.join(', ')}`);
});

test('a redder B-V lowers blue reflectance and a redder V-R raises red', () => {
  const [b, , r, i] = filterReflectance(parseDiscColorRecord(makemake));
  assert.ok(b![1] < 1 && r![1] > 1 && i![1] < 1);
  assert.ok(Math.abs(b![1] - 10 ** (-0.4 * (0.91 - 0.653))) < 1e-12);
});

test('Makemake\'s published colours and albedo give a pale warm sRGB colour', () => {
  const color = discIntegratedColor(parseDiscColorRecord(makemake), colorMatching, illuminant);
  assert.deepEqual(color.srgb, [240, 233, 211]);
  assert.ok(color.linear[0] > color.linear[1] && color.linear[1] > color.linear[2]);
});

test('Haumea\'s rotation-corrected colours and occultation albedo give a light, nearly neutral gray', async () => {
  const haumea = JSON.parse(await readFile(new URL('../../../src/objects/haumea/source/photometry/disc-color.json', import.meta.url), 'utf8'));
  const color = discIntegratedColor(parseDiscColorRecord(haumea), colorMatching, illuminant);
  assert.deepEqual(color.srgb, [188, 189, 191]);
  assert.ok(color.linear[2] > color.linear[0], 'the slightly negative solar-relative B-V reads faintly blue');
});

test('records and tables fail closed', () => {
  assert.throws(() => parseDiscColorRecord({ ...makemake, schema: 'other' }), /cssearth-disc-integrated-color@1/);
  assert.throws(() => parseDiscColorRecord({ ...makemake, geometricAlbedo: { ...makemake.geometricAlbedo, band: 'R' } }), /V-band/);
  assert.throws(() => parseDiscColorRecord(withObject({ 'B-V': 0.91, 'V-R': 0.41 })), /V-I/);
  assert.throws(() => parseCieTable('380,1,2\n', 3), /Invalid CIE table row/);
  assert.throws(() => discIntegratedColor(parseDiscColorRecord(makemake), new Map([[380, [0, 0, 0]]]), illuminant), /cover 381 nm/);
});
