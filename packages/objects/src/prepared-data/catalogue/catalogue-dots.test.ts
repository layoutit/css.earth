import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodePreparedBank, encodePreparedBank } from '../../prepared-bank.js';
import { parsePreparedGalaxyCatalog } from './galaxy-catalog.js';
import { GALAXY_DISPLAY_SAMPLE_SCHEMA } from './galaxy-display-sample.js';
import { catalogueDots, decodeCatalogueDots, encodeCatalogueDots } from './catalogue-dots.js';

const row = (id: string, name: string, group: string, positionM: number[], detailedObjectId?: string) => ({ id, name, aliases: [], positionM,
  skyPosition: { raDeg: 0, decDeg: 0, sourceRef: 'source' }, distance: { valuePc: 1, method: 'parallax', sourceRef: 'source' },
  membership: { group, subgroup: 'field', basis: 'Source' }, status: 'confirmed', ...(detailedObjectId ? { detailedObjectId } : {}) });
const PLACE = [3.085677581491367e16, 0, 0];
const catalog = parsePreparedGalaxyCatalog({ schema: 'cssearth-galaxy-catalog@1', frame: { referenceFrame: 'sun-icrf', epochJdTt: 2461286.5 },
  sources: [{ id: 'source', url: 'https://example.org', citation: 'Source', bytes: 1 }],
  // One parsec along the first axis: the place its sky position and distance give.
  objects: [row('near', 'Near', 'local-group', PLACE), row('packaged', 'Packaged', 'local-group', PLACE, 'packaged'),
    row('far', 'Far', 'local-volume', PLACE), row('unsampled', 'Unsampled', 'local-group', PLACE)],
  exclusions: [], selection: { description: 'Source' } });
const sample = { schema: GALAXY_DISPLAY_SAMPLE_SCHEMA, ids: ['near'] };

test("the catalogue's dots are its sampled Local Group galaxies without a package, and travel as their ids and places alone", () => {
  const dots = catalogueDots(catalog, sample, 7);
  assert.deepEqual(dots.ids, ['near']);
  assert.deepEqual([...dots.positionsM], PLACE, 'a place keeps every digit');
  assert.deepEqual(catalogueDots(catalog).ids, ['near', 'unsampled'], 'without a sample, every named Local Group row without a package');
  const { bytes } = encodePreparedBank(encodeCatalogueDots(dots), 'dots.bin');
  const read = decodeCatalogueDots(decodePreparedBank(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, 'dots.bin'), 'dots.bin');
  assert.deepEqual({ ...read, positionsM: [...read.positionsM] }, { ...dots, positionsM: [...dots.positionsM] });
  assert.ok(bytes.byteLength < 400, `the file holds no catalogue: ${bytes.byteLength} bytes`);
});

test('dots without a frame, with a repeated id or with a place that is not a number are refused by name', () => {
  const bank = encodeCatalogueDots(catalogueDots(catalog, sample, 7));
  assert.throws(() => decodeCatalogueDots({ ...bank, fields: { ...bank.fields, frame: { referenceFrame: 'sun-icrf' } } }, 'dots.bin'), /dots.bin: its frame names a reference frame and an epoch/u);
  assert.throws(() => decodeCatalogueDots({ ...bank, fields: { ...bank.fields, ids: ['near', 'near'] }, columns: { positionM: new Float64Array(6) } }, 'dots.bin'), /dots.bin: its ids are distinct names/u);
  assert.throws(() => decodeCatalogueDots({ ...bank, columns: { positionM: Float64Array.from([1, Number.NaN, 3]) } }, 'dots.bin'), /dots.bin: dot near has no finite place/u);
  assert.throws(() => decodeCatalogueDots({ ...bank, columns: { positionM: new Float64Array(2) } }, 'dots.bin'), /dots.bin: column positionM must be f64 with 3 values/u);
  assert.throws(() => decodeCatalogueDots({ ...bank, schema: 'cssearth-galaxy-catalog@1' }, 'dots.bin'), /dots.bin: expected cssearth-catalogue-dots@1/u);
});
