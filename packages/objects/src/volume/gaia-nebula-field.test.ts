import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { GAIA_NEBULA_FIELD_SCHEMA, parseGaiaNebulaField } from './gaia-nebula-field.ts';

const star = () => ({ sourceId: '123456789012', raDeg: 10, decDeg: -5, distancePc: 100, distanceLowerPc: 90,
  distanceUpperPc: 110, pmRaMasYr: null, pmDecMasYr: 1, photGMeanMag: 12, bpRp: null, parallaxMas: -1,
  parallaxErrorMas: 1, ruwe: 1 });
const field = () => ({ schema: GAIA_NEBULA_FIELD_SCHEMA, id: 'field', coordinateEpochJulianYear: 2016, stars: [star()],
  selection: { centerIcrsDegrees: [10, -5], distancePc: 100, outerRadiusPc: 20, featherStartPc: 10,
    maximumStars: 2, retainIds: [], limitingMagnitude: 18, fadeMagnitude: 1, referenceMagnitude: 12,
    referenceDiameterPx: 2, referenceFocalPixels: 100 } });
const parse = (value: unknown) => parseGaiaNebulaField(value, { subset: 'catalogue-selection' });

test('catalogue-selection reads the full selection and preserves historical defaults and null motion', () => {
  const parsed = parse(field());
  assert.deepEqual(parsed.stars, [star()]);
  assert.equal(parsed.selection.retainedAppearance, 'dataset');
  assert.equal(parsed.selection.retainedMatchArcsec, 0);
  const anchor = { ...field(), selection: { ...field().selection, retainedAppearance: 'anchor', retainedMatchArcsec: 3 } };
  assert.equal(parse(anchor).selection.retainedAppearance, 'anchor');
});

test('catalogue-selection preserves validation order and diagnostic text', () => {
  const bad = (value: unknown, message: string) => assert.throws(() => parse(value), { name: 'TypeError', message });
  bad(null, 'Catalogue field requires an object.');
  bad({ schema: 'wrong' }, 'Catalogue field requires an object.');
  bad({ ...field(), schema: 'wrong' }, 'Invalid Gaia catalogue field schema or identity.');
  bad({ ...field(), id: '' }, 'Catalogue field requires nonempty text.');
  bad({ ...field(), selection: { ...field().selection, centerIcrsDegrees: [0] } }, 'Catalogue field needs a two-coordinate centre.');
  bad({ ...field(), selection: { ...field().selection, centerIcrsDegrees: [360, 0] } }, 'Catalogue field ICRS coordinates are invalid.');
  bad({ ...field(), selection: { ...field().selection, distancePc: 0 } }, 'Catalogue field requires positive values.');
  bad({ ...field(), selection: { ...field().selection, maximumStars: 2001 } }, 'Invalid catalogue field sphere, fade, match radius or budget.');
  bad({ ...field(), selection: { ...field().selection, retainIds: null } }, 'Catalogue field needs explicit retained identities.');
  bad({ ...field(), selection: { ...field().selection, retainedAppearance: 'other' } }, 'Invalid retained star appearance policy.');
  bad({ ...field(), selection: { ...field().selection, retainIds: ['a', 'a'] } }, 'Invalid retained catalogue identities or budget.');
  bad({ ...field(), stars: null }, 'Catalogue field requires source rows.');
  bad({ ...field(), stars: [star(), star()] }, 'Gaia source identities must be unique decimal strings.');
  bad({ ...field(), stars: [{ ...star(), distanceLowerPc: 101 }] }, 'Invalid Gaia distance posterior quantiles.');
  bad({ ...field(), stars: [{ ...star(), pmRaMasYr: undefined }] }, 'Catalogue field requires finite numbers.');
});

test('astrometry-table keeps the smaller, coercing subset independent of catalogue-selection', () => {
  const input = { schema: GAIA_NEBULA_FIELD_SCHEMA, coordinateEpochJulianYear: '2016', stars: [
    { sourceId: 123, raDeg: '10', decDeg: null, pmRaMasYr: null, pmDecMasYr: '2', parallaxMas: null }, {} ] };
  const rows = parseGaiaNebulaField(input, { subset: 'astrometry-table' });
  assert.deepEqual(rows[0], { id: '123', raDeg: 10, decDeg: 0, epochJulianYear: 2016,
    pmRaCosDecMasYr: 0, pmDecMasYr: 2, parallaxMas: 0 });
  assert.equal(rows[1]!.id, 'undefined');
  assert.ok(Number.isNaN(rows[1]!.raDeg));
  assert.equal('parallaxMas' in rows[1]!, false);
  assert.throws(() => parse(input), { message: 'Catalogue field requires an object.' });
});

test('astrometry-table preserves envelope and indexed row diagnostics', () => {
  const parse = (value: unknown) => parseGaiaNebulaField(value, { subset: 'astrometry-table' });
  assert.throws(() => parse([]), { message: 'astrometry member must be an object.' });
  assert.throws(() => parse({ schema: GAIA_NEBULA_FIELD_SCHEMA }), {
    message: 'The public astrometry executor reads a Gaia-named CSV table or the pinned Gaia nebula-field schema.' });
  assert.throws(() => parse({ schema: GAIA_NEBULA_FIELD_SCHEMA, stars: [{}, null] }), { message: 'star 1 must be an object.' });
});

test('Gaia consumers call their shared subset and retain no field parser', () => {
  const bake = readFileSync(new URL('../../../bake/src/nebula/catalogue-field.ts', import.meta.url), 'utf8');
  const telescope = readFileSync(new URL('../../../telescope-cli/src/family-operation.mts', import.meta.url), 'utf8');
  assert.match(bake, /parseGaiaNebulaField\(JSON\.parse\(bytes\.toString\(\)\) as unknown, \{ subset: 'catalogue-selection' \}\)/u);
  assert.match(telescope, /parseGaiaNebulaField\(JSON\.parse\(text\),\{subset:'astrometry-table'\}\)/u);
  for (const source of [bake, telescope]) {
    assert.doesNotMatch(source, /function parseField\(|source\.schema\s*!==\s*GAIA_NEBULA_FIELD_SCHEMA/u);
    assert.doesNotMatch(source, /Gaia source identities must be unique|Invalid Gaia distance posterior|The public astrometry executor reads a Gaia-named/u);
  }
});
