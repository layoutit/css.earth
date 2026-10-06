import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseMatches, periodColumns } from './rotation-catalogues.mts';
import { adoptPeriod, recordedPeriods, starMetadata } from './star-metadata.mts';

const row = (title: string, name: string, unit: string, description: string) => ({ res_title: title, table_name: 'J/A+A/600/A13/tablea3', name, unit, column_description: description });

test('the registry answer keeps only stars\' own rotation periods in a unit of time', () => {
  const kept = periodColumns([row('HARPS M dwarf sample magnetic activity', 'prot', 'd', 'Rotation period'), row('Lightcurves of 14 NEAs', 'per', 'h', 'Rotation period'),
    row('Rotation in A-F stars', 'p/sini', 'd', 'Rotation period over sin(i)'), row('Rotating neutron stars models. I.', 'p', 'ms', 'Rotation period'),
    row('Four new WASP planets', 'per', 'd', 'Orbital period (not rotation)'), row('Stellar Rotation in the Orion Nebula Cluster', 'per', 'yr', 'Rotation period')]);
  assert.deepEqual(kept.map(column => `${column.name} ${column.unit}`), ['prot d', 'per yr']);
});

test('a matched row gives its period in days with the table, the column and how far it lies; a star keeps its nearer row', () => {
  const column = { table: 'J/A+A/600/A13/tablea3', title: 'HARPS M dwarf  sample magnetic activity', name: 'prot', unit: 'd' };
  const csv = 'angDist,id,ra,dec,_RAJ2000,_DEJ2000,Name,Prot\n0.006149,au-mic,311.289719,-31.340899,311.2897183,-31.3409006,Gl803,10\n2.9,au-mic,311.289719,-31.340899,311.29,-31.3409,other,3\n4.2,far,1,1,1,1,x,7\n0.02,none,2,2,2,2,y,\n';
  assert.deepEqual(parseMatches(csv, column), [{ id: 'au-mic', period: { days: 10, source: 'VizieR J/A+A/600/A13/tablea3 (HARPS M dwarf sample magnetic activity), column Prot: 10 d, the row 0.0 arcsec from the star\'s J2000 place' } }]);
  assert.equal(parseMatches(csv, { ...column, unit: 'h' })[0]!.period.days, 0.416667);
  assert.deepEqual(parseMatches('<?xml version="1.0"?><error/>', column), []);
});

test('a catalogued period is adopted only when most agree with it, and all are kept either way', () => {
  const a = { days: 11.1, source: 'table A' }, b = { days: 11.68, source: 'table B' }, c = { days: 12.3, source: 'table C' }, half = { days: 5.7, source: 'table D' };
  assert.equal(adoptPeriod([c, a, b]), b); assert.equal(adoptPeriod([a]), a); assert.equal(adoptPeriod([]), undefined);
  // A rotation and its half do not agree: which one the star turns in is not chosen here.
  assert.equal(adoptPeriod([a, half]), undefined);
  // One table's alias does not undo three that agree.
  assert.equal(adoptPeriod([half, a, b, c]), a);
  const agreed = starMetadata({ radiusKm: 0.76 * 695700, measuredAxis: false }, undefined, { name: 'eps Eri', vsiniKmS: { value: 2.4 } }, undefined, [c, a, b]);
  assert.equal(agreed.rotationPeriodDays, 11.68); assert.equal(agreed.rotationPeriodSource, 'table B. The middle of 3 catalogued periods, 3 of them within 20% of it'); assert.equal(typeof agreed.spinInclinationDegrees, 'number');
  const split = starMetadata({ measuredAxis: false }, undefined, undefined, undefined, [a, half]);
  assert.equal('rotationPeriodDays' in split, false); assert.deepEqual(recordedPeriods(split), [a, half]);
});
