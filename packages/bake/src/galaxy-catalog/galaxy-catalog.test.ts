import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { M_PER_PC } from '@cssearth/astronomy';
import { parsePreparedGalaxyCatalog } from '@cssearth/catalog';
import { parseGalaxyRecipe } from './config.ts';
import { parseGalaxyDisplaySampling, prepareGalaxyDisplaySample } from './display-sample.ts';
import { galaxyPositionM, classifyMembership, prepareGalaxyCatalog } from './prepare.ts';
import { parseGalaxyCsv, readAuthorMetadata } from './source.ts';
import type { AuthorMetadata, CsvRow } from './types.ts';

const directory = resolve('src/objects/local-group-galaxies');
const json = async (path: string) => JSON.parse(await readFile(resolve(directory, path), 'utf8')) as unknown;
const recipe = () => json('source/catalogue.json').then(parseGalaxyRecipe);
function sourceArchive(yaml: string): Buffer {
  const payload = Buffer.from(yaml), header = Buffer.alloc(512);
  header.write('release/data/new_field.yaml', 0);
  header.write(payload.length.toString(8).padStart(11, '0') + '\0', 124);
  header.fill(32, 148, 156); header.write('0', 156);
  const sum = header.reduce((total, n) => total + n, 0);
  header.write(sum.toString(8).padStart(6, '0') + '\0 ', 148);
  return gzipSync(Buffer.concat([header, payload, Buffer.alloc((512 - payload.length % 512) % 512 + 1024)]));
}

test('four detailed centers retain measured directions and distance references in Sun ICRS', async () => {
  const data = parsePreparedGalaxyCatalog(await json('prepared/catalogue.json'));
  const expected = [
    ['m31', 10.683916666666665, 41.26566666666666, 776247.116629, 'Savino2022'],
    ['m33', 23.462, 30.6603, 859013.521505, 'Savino2022'],
    ['lmc', 78.76, -69.19, 49590.6727505, 'Pietrzynski2019'],
    ['smc', 16.25, -72.42, 62440, 'Graczyk2020'],
  ] as const;
  for (const [id, ra, dec, pc, reference] of expected) {
    const row = data.objects.find(row => row.id === id)!;
    assert.equal(row.skyPosition.raDeg, ra); assert.equal(row.skyPosition.decDeg, dec);
    assert.equal(row.distance.valuePc, pc); assert(row.distance.sourceRef.startsWith(reference));
    const [x, y, z] = row.positionM;
    assert(Math.abs(Math.atan2(y, x) * 180 / Math.PI - ra) < 1e-9);
    assert(Math.abs(Math.atan2(z, Math.hypot(x, y)) * 180 / Math.PI - dec) < 1e-9);
  }
  const smc = data.objects.find(row => row.id === 'smc')!;
  assert.deepEqual(smc.distance.uncertainty, { statisticalPc: 470, systematicPc: 810 });
  assert(smc.halfLightRadius!.sourceRef.startsWith('Munoz2018'));
});

test('cardinal coordinates independently establish handedness, axis order and physical scale', () => {
  const roundedPc = Number(M_PER_PC.toPrecision(12));
  assert.deepEqual(galaxyPositionM(0, 0, 1), [roundedPc, 0, 0]);
  assert.deepEqual(galaxyPositionM(90, 0, 1), [0, roundedPc, 0]);
  assert.deepEqual(galaxyPositionM(180, 0, 1), [-roundedPc, 0, 0]);
  assert.deepEqual(galaxyPositionM(0, -90, 1), [0, 0, -roundedPc]);
  assert.throws(() => galaxyPositionM(360, 0, 1), /astrometry/);
});

test('membership never follows a spatial-radius cut and keeps published subgroup ambiguity', async () => {
  const r = await recipe();
  const data = parsePreparedGalaxyCatalog(await json('prepared/catalogue.json'));
  assert.equal(data.objects.find(row => row.id === 'wlm')?.membership.group, 'local-group');
  assert.equal(data.objects.find(row => row.id === 'ngc_3109')?.membership.group, 'local-volume');
  assert.equal(data.objects.find(row => row.id === 'leo_1')?.membership.subgroup, 'unknown');
  const author: AuthorMetadata = { key: 'new_field', location: { ra: 0, dec: 0 }, name_discovery: {} };
  const base: CsvRow = { key: 'new_field', table: 'field', name: 'New field galaxy', ra: '0', dec: '0', distance_modulus: '0', ref_distance: 'MeasuredPaper', confirmed_real: '1', confirmed_galaxy: '1' };
  const custom = { ...r, eligibleTables: ['field'], membershipNames: {}, distanceOverrides: {}, detailObjects: {}, citedRows: {} };
  for (const modulus of ['0', '30']) {
    const prepared = prepareGalaxyCatalog([{ ...base, distance_modulus: modulus }], new Map([[author.key, author]]), new Map(), custom, []);
    assert.equal(prepared.objects[0]!.membership.group, 'uncertain');
  }
});

test('a cited row places a galaxy beyond the pinned catalogue under its own id, with its cited membership', async () => {
  const r = await recipe();
  const citedRows = { far_elliptical: { name: 'Far elliptical', aliases: ['NGC 1', 'Far elliptical'], raDeg: 187.7, decDeg: 12.4, positionRef: 'cited:position',
    distance: { valuePc: 16_800_000, method: 'adopted', sourceRef: 'cited:distance' },
    membership: { group: 'galaxy-cluster' as const, subgroup: 'virgo' as const, basis: 'Fixture.', sourceRef: 'cited:membership' } } };
  const custom = { ...r, eligibleTables: ['field'], membershipNames: {}, distanceOverrides: {}, detailObjects: { far_elliptical: { id: 'far-elliptical', focusRadiusM: 1e21 } }, citedRows };
  const prepared = prepareGalaxyCatalog([], new Map(), new Map(), custom, []);
  const row = prepared.objects[0]!;
  assert.equal(row.id, 'far-elliptical'); assert.equal(row.detailedObjectId, 'far-elliptical');
  assert.deepEqual(row.aliases, ['NGC 1']); assert.equal(row.membership.subgroup, 'virgo');
  assert.ok(Math.abs(Math.hypot(...row.positionM) / M_PER_PC - 16_800_000) < 1e-3);
  assert.throws(() => parseGalaxyRecipe({ ...JSON.parse(JSON.stringify(r)), citedRows: { x: { ...citedRows.far_elliptical, membership: { ...citedRows.far_elliptical.membership, group: 'uncertain' } } } }), /galaxy cluster/);
});

test('new source objects follow authored host associations without a fixed galaxy-id dispatch', async () => {
  const r = { ...await recipe(), hostRoots: { anchor: 'andromeda' as const }, membershipNames: {} };
  const m = new Map<string, AuthorMetadata>([
    ['future', { key: 'future', name_discovery: { host: 'secondary' } }],
    ['secondary', { key: 'secondary', name_discovery: { host: 'anchor' } }],
  ]);
  assert.equal(classifyMembership('future', m, r, new Map()).subgroup, 'andromeda');
  m.set('secondary', { key: 'secondary' });
  assert.equal(classifyMembership('future', m, r, new Map()).group, 'uncertain');
  m.set('secondary', { key: 'secondary', name_discovery: { host: 'future' } });
  assert.throws(() => classifyMembership('future', m, r, new Map()), /Cyclic/);
});

test('strict source parser rejects malformed rows, ambiguous recipes and mutated consumed YAML', async () => {
  assert.deepEqual(parseGalaxyCsv('key,name\r\na,"A, ""quoted"" name"\r\n'), [{ key: 'a', name: 'A, "quoted" name' }]);
  assert.throws(() => parseGalaxyCsv('key,name\na,b,c\n'), /number of fields/);
  assert.throws(() => parseGalaxyCsv('key,key\na,b\n'), /unique/);
  assert.throws(() => parseGalaxyCsv('key,name\na,"broken\n'), /Unclosed/);
  const r = await recipe();
  assert.throws(() => parseGalaxyRecipe({ ...r, inferMembershipRadiusPc: 3e6 }), /Unknown/);
  assert.throws(() => parseGalaxyRecipe({ ...r, catalogue: { ...r.catalogue, path: '../escape.csv' } }), /contained/);
  const metadata = readAuthorMetadata(await readFile(resolve(directory, 'source', r.archive.path)), r.archiveInputPrefix, r.eligibleTables);
  assert(metadata.get('lmc')?.name_discovery?.other_name?.includes('Large Magellanic Cloud'));
  // The author has two unused name entries; the released CSV determines the label.
  assert(metadata.has('ngc_4517-kdg_171'));
  const yaml = 'key: new_field\ntable: field\nlocation:\n  ra: 0\n  dec: 0\n';
  assert(readAuthorMetadata(sourceArchive(yaml), 'release/data/', ['field']).has('new_field'));
  assert.throws(() => readAuthorMetadata(sourceArchive(yaml.replace('  ra: 0', '  ra: 0\n  ra: 90')), 'release/data/', ['field']), /Duplicate consumed/);
});

test('display sampling requires the authored budget and scale and preserves catalogue identities', async () => {
  const catalogue = parsePreparedGalaxyCatalog(await json('prepared/catalogue.json'));
  for (const input of [undefined, {}, { budget: 48 }, { cellSizeMpc: .15 }, { budget: 0, cellSizeMpc: .15 }, { budget: 1.5, cellSizeMpc: .15 }, { budget: 1, cellSizeMpc: 0 }, { budget: 1, cellSizeMpc: Infinity }]) {
    assert.throws(() => parseGalaxyDisplaySampling(input));
  }
  const sampled = prepareGalaxyDisplaySample(catalogue, parseGalaxyDisplaySampling({ budget: 1, cellSizeMpc: .25 }));
  assert.equal(sampled.ids.length, 1);
  assert.equal(sampled.budget, 1);
  assert.equal(sampled.cellSizeM, 250_000 * M_PER_PC);
  assert(catalogue.objects.some(row => row.id === sampled.ids[0] && row.membership.group === 'local-group' && !row.detailedObjectId));
});
