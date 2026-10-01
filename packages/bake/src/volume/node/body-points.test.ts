import assert from 'node:assert/strict';
import test from 'node:test';
import { BODY_POINTS_SOURCE_SCHEMA, bodyCentredBank, parseBodyPointsRecipe, parseBodyPointsTable } from './body-points.ts';

const recipe = () => ({ schema: BODY_POINTS_SOURCE_SCHEMA, id: 'dots', published: true, host: 'planet', source: 'an-ephemeris', meaning: 'Moons without a page.',
  table: { path: 'positions.csv', origin: 'https://example.test/ephemeris', generator: 'packages/bake/authoring/planet/positions.mts' },
  frame: { input: 'host-centred-icrf-km', output: 'sun-icrf', epochJdTt: 2461286.5 }, appearance: { colorCss: '#c8c8c8', radiusPx: 0.75, opacity: 1 } });
const hostFrame = { referenceFrame: 'sun-icrf', epochJdTt: 2461286.5, originM: [1.4e12, 2.4e11, 4.1e10] };

test('a body-centred bank holds the table\'s positions in megametres and sits at its host\'s world position', () => {
  const rows = parseBodyPointsTable('name,xKm,yKm,zKm\nA,1000,0,0\nB,0,-3000000,4000000.06\n', 'positions.csv');
  const bank = bodyCentredBank({ recipe: parseBodyPointsRecipe(recipe(), 'points.json'), rows, hostFrame });
  assert.deepEqual(bank.points, [[1, 0, 0], [0, -3000, 4000.0001]], 'megametres, rounded to 100 m');
  assert.deepEqual(bank.frame.originM, hostFrame.originM);
  assert.equal(bank.frame.metersPerUnit, 1e6);
  assert.deepEqual(bank.frame.boundsUnits, { min: [-5001, -5001, -5001], max: [5001, 5001, 5001] });
  assert.equal(bank.host, 'planet');
});

test('a bank whose rows were fetched at another epoch than its host\'s is refused, naming both', () => {
  const rows = parseBodyPointsTable('name,xKm,yKm,zKm\nA,1,2,3\n', 'positions.csv');
  assert.throws(() => bodyCentredBank({ recipe: parseBodyPointsRecipe(recipe(), 'points.json'), rows, hostFrame: { ...hostFrame, epochJdTt: 2451545 } }),
    /dots: its rows are in sun-icrf at JD 2461286\.5 TT, but planet is prepared in sun-icrf at JD 2451545 TT/u);
});

test('the table and the recipe say what is wrong with them', () => {
  assert.throws(() => parseBodyPointsTable('name,x,y,z\nA,1,2,3\n', 'positions.csv'), /positions\.csv: the header must be name,xKm,yKm,zKm with an optional class/u);
  assert.throws(() => parseBodyPointsTable('name,xKm,yKm,zKm\nA,1,2,3\nA,4,5,6\n', 'positions.csv'), /row 2: A is listed twice/u);
  assert.throws(() => parseBodyPointsTable('name,xKm,yKm,zKm\nA,1,,3\n', 'positions.csv'), /row 1: expected a name and three finite kilometres/u);
  assert.throws(() => parseBodyPointsRecipe({ ...recipe(), frame: { ...recipe().frame, input: 'icrs' } }, 'points.json'), /points\.json: frame\.input must be host-centred-icrf-km, got "icrs"/u);
  assert.throws(() => parseBodyPointsRecipe({ ...recipe(), seed: 1 }, 'points.json'), /points\.json: recipe has unknown seed/u);
});

test('a classed table colours each dot by its class, and counts them', () => {
  const classes = { source: 'a-paper', basis: 'Orbit direction.', entries: [{ id: 'prograde', label: 'Prograde', colorCss: '#aabbcc' }, { id: 'retrograde', label: 'Retrograde', colorCss: '#ccbbaa' }] };
  const rows = parseBodyPointsTable('name,xKm,yKm,zKm,class\nA,1000,0,0,retrograde\nB,0,2000,0,prograde\nC,0,0,3000,retrograde\n', 'positions.csv');
  const bank = bodyCentredBank({ recipe: parseBodyPointsRecipe({ ...recipe(), classes }, 'points.json'), rows, hostFrame });
  assert.deepEqual(bank.points, [[1, 0, 0, 1], [0, 2, 0, 0], [0, 0, 3, 1]]);
  assert.deepEqual(bank.appearance.palette, ['#aabbcc', '#ccbbaa']);
  assert.deepEqual(bank.classes?.entries.map(entry => [entry.id, entry.points]), [['prograde', 1], ['retrograde', 2]]);
  const unknown = parseBodyPointsTable('name,xKm,yKm,zKm,class\nA,1,2,3,sideways\n', 'positions.csv');
  assert.throws(() => bodyCentredBank({ recipe: parseBodyPointsRecipe({ ...recipe(), classes }, 'points.json'), rows: unknown, hostFrame }),
    /dots: positions\.csv gives A the class "sideways"; the recipe's classes are prograde, retrograde/u);
  assert.throws(() => bodyCentredBank({ recipe: parseBodyPointsRecipe(recipe(), 'points.json'), rows, hostFrame }), /has a class column, but the recipe names no classes/u);
});
