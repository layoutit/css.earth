import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { sourceTest } from '@cssearth/objects/node/source-test';
import { parseTecplotLonLat } from '@cssearth/bake/objects/raster';
import { surfaceArguments } from './surface-reconstruction.mts';
import { BRIGHTNESS_VARIABLE, decidingTwin, FACING_VARIABLE, facingOf, parseSurfaceSeason, surfaceTable, TABLE_STEP_DEGREES } from './surface-star.mts';
const test = sourceTest();

const SEASON = resolve(import.meta.dirname, 'seasons/udkadua-mirc-2011-09/season.json');

test('the λ Andromedae season parses: six nights in order, every value of the star with its paper cell, and malformed seasons fail', async () => {
  const record = JSON.parse(await readFile(SEASON, 'utf8')) as Record<string, unknown>, season = parseSurfaceSeason(record);
  assert.equal(season.object, 'udkadua'); assert.equal(season.nights.length, 6); assert.equal(season.referenceNight, '2011-09-14');
  assert.deepEqual([season.star.diameterMas.value, season.star.limbPowerLaw.value, season.star.inclinationDegrees.value, season.star.positionAngleDegrees.value, season.star.rotationPeriodDays.value], [2.742, 0.231, 85.63, 26.09, 54.2]);
  for (const cited of Object.values(season.star)) assert.match(cited.source, /Martinez et al\. \(2021\), ApJ 916, 60, Table 4/u);
  assert.deepEqual([season.recipe.level, season.recipe.regularizer, season.recipe.weight, season.recipe.iterations], [3, 'sobel2', 10, 1000]);
  for (const night of season.nights) assert.match(night.origin, /^https:\/\/raw\.githubusercontent\.com\/fabienbaron\/ROTIR\.jl\/[0-9a-f]{40}\/demos\/data\//u);
  assert.throws(() => parseSurfaceSeason({ ...record, referenceNight: '2011-09-15' }), /not one of the season's/u);
  assert.throws(() => parseSurfaceSeason({ ...record, nights: (record.nights as unknown[]).slice(0, 1) }), /two or more nights/u);
  assert.throws(() => parseSurfaceSeason({ ...record, reconstruction: { ...(record.reconstruction as object), code: 'squeeze' } }), /ROTIR/u);
  assert.throws(() => parseSurfaceSeason({ ...record, papers: [] }), /names the papers/u);
});

test('several nights are one run: every file, the power law, the period that turns the star between them, and the coverage', () => {
  const args = surfaceArguments(['a.oifits', 'b.oifits'], '/work', { diameterMas: 2.742, limbDarkening: 0.231, limbLaw: 'power', inclinationDegrees: 85.63, positionAngleDegrees: 26.09, rotationPeriodDays: 54.2, regularizer: 'sobel2', weight: 10, level: 3, iterations: 1000, coverage: true });
  const values = Object.fromEntries(args.map(arg => arg.split('=') as [string, string]));
  assert.match(values.oifits!, /a\.oifits,.*b\.oifits$/u);
  assert.deepEqual([values.ld_law, values.ld1, values.rotation_period_days, values.regularizer, values.weight, values.level, values.coverage], ['3', '0.231', '54.2', 'sobel2', '10', '3', '/work/surface-coverage.fits']);
  assert.throws(() => surfaceArguments(['a.oifits', 'b.oifits'], '/work', { diameterMas: 2.7 }), /rotation period/u);
  // One file, as Polaris was run, states no period and writes no coverage.
  assert.ok(!surfaceArguments('a.oifits', '/work', { diameterMas: 3.16 }).some(arg => /^(?:rotation_period_days|coverage)=/u.test(arg)));
});

test('the table puts longitude 0 on the meridian that faced the observer, and a node never seen holds the mean', () => {
  // ROTIR's grid, 36 x 18 cells: brightness 2 where its longitude is under 180 and 1 beyond; the observer stood at 270 on the
  // reference night, and nothing east of ROTIR longitude 90 to 180 was ever seen.
  const columns = 36, rows = 18, values = new Float32Array(columns * rows);
  for (let r = 0; r < rows; r++) for (let c = 0; c < columns; c++) values[r * columns + c] = (c + 0.5) * 10 < 180 ? 2 : 1;
  const table = surfaceTable({ columns, rows, values }, longitude => { const rotir = (longitude % 360 + 360) % 360; return rotir > 90 && rotir < 180 ? -0.5 : 0.5; }, 270, 'a "test" star');
  const parsed = parseTecplotLonLat(table.text, 'test.dat'), brightness = parsed.variables.indexOf(BRIGHTNESS_VARIABLE), seen = parsed.variables.indexOf(FACING_VARIABLE);
  assert.deepEqual([parsed.columns, parsed.rows, parsed.lonStep], [360 / TABLE_STEP_DEGREES + 1, 180 / TABLE_STEP_DEGREES + 1, TABLE_STEP_DEGREES]);
  const at = (longitude: number, latitude: number) => parsed.values[(latitude + 90) / TABLE_STEP_DEGREES * parsed.columns + longitude / TABLE_STEP_DEGREES]!;
  // Table longitude 0 is ROTIR 270 (brightness 1); table 100 is ROTIR 10 (brightness 2); table 200 is ROTIR 110, never seen.
  assert.ok(at(100, 0)[brightness]! / at(0, 0)[brightness]! > 1.99 && at(100, 0)[brightness]! / at(0, 0)[brightness]! < 2.01);
  assert.equal(at(200, 0)[brightness], 100); assert.ok(at(200, 0)[seen]! < 0 && at(0, 0)[seen]! > 0);
  // The seen surface is two thirds at 1 and one third at 2: its mean is 4/3, so the two values are 75% and 150%.
  assert.ok(Math.abs(table.minimumPercent - 75) < 1.5 && Math.abs(table.maximumPercent - 150) < 3, `${table.minimumPercent} ${table.maximumPercent}`);
  assert.doesNotMatch(table.text.split('\n')[0]!, /"test"/u);
});

test('a place faced the observer as squarely as on its best night, and one behind the limb on every night never did', () => {
  // The observer on the equator at longitude 270 on one night and at 180 on another.
  const facing = facingOf([{ colatitude: 90, longitude: 270 }, { colatitude: 90, longitude: 180 }]);
  assert.ok(Math.abs(facing(270, 0) - 1) < 1e-12 && Math.abs(facing(180, 0) - 1) < 1e-12);
  assert.ok(Math.abs(facing(225, 0) - Math.SQRT1_2) < 1e-12); assert.ok(facing(30, 0) < 0); assert.ok(Math.abs(facing(0, 90)) < 1e-12);
});

test('the spots are taken against the spottiest spotless twin that fits on the sphere', () => {
  const twins = [{ scale: 1, ratio: 2.94, fits: true }, { scale: 0.98, ratio: 1.51, fits: false }, { scale: 0.99, ratio: 2.57, fits: true }, { scale: 1.01, ratio: 2.14, fits: true }, { scale: 1.02, ratio: 1.4, fits: false }];
  assert.equal(decidingTwin(twins).scale, 1.01);
  // Where the data do not hold the size, every twin fits and the spottiest decides, as for a sky-plane image.
  assert.equal(decidingTwin(twins.map(twin => ({ ...twin, fits: true }))).scale, 1.02);
  assert.throws(() => decidingTwin(twins.map(twin => ({ ...twin, fits: twin.scale !== 1 }))), /not a check/u);
});
