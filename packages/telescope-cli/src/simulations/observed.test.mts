/** JWST's time series set on a planet's orbit (observed.mts), offline: rows as MAST serves them, made here. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { hostedOrbit, starAstrometry } from '@cssearth/astronomy';
import { isPublic, jwstTimeSeries, MATCH_ARCSEC, parseTimeSeries, planetsWatched, visitLine, visitsOf, type TimeSeriesRow } from './observed.mts';

const MJD_J2000 = 51_544.5;
/** A star at 10, 20 degrees in 2000 that moves one arcsecond north a year, and a planet of one day with a transit at MJD 60000. */
const star = { rightAscensionDegrees: 10, declinationDegrees: 20, positionEpochJulianYear: 2000, properMotionRaMasPerYear: 0, properMotionDecMasPerYear: 1000 }, orbit = { periodDays: 1, transitTimeBmjdTdb: 60_000 };
/** Where that star is at a time, as the archive would point at it. */
const row = (startMjd: number, endMjd: number, more: Partial<TimeSeriesRow> = {}): TimeSeriesRow => ({ programme: '1', instrument: 'MIRI', investigator: 'Dang', title: 'A phase curve', raDegrees: 10,
  decDegrees: 20 + (startMjd - MJD_J2000) / 365.25 / 3600, startMjd, endMjd, releaseMjd: 60_500, ...more });

test('MAST\'s rows are read as served; a row with no place or no times is left out and a wrong type is refused', () => {
  const served = { obs_id: 'jw1', target_name: 'K2-141', s_ra: 350.9, s_dec: -1.19, instrument_name: 'MIRI/SLITLESS', proposal_id: '2347', proposal_pi: 'Dang, Lisa', obs_title: 'A Hell of a Phase Curve', t_min: 60_103.5, t_max: 60_104.4, t_obs_release: 60_470.1 };
  assert.deepEqual(parseTimeSeries([served, { ...served, s_ra: null }, { ...served, t_min: null }, { ...served, t_obs_release: null, proposal_id: 2159 }]),
    [{ programme: '2347', instrument: 'MIRI', investigator: 'Dang', title: 'A Hell of a Phase Curve', raDegrees: 350.9, decDegrees: -1.19, startMjd: 60_103.5, endMjd: 60_104.4, releaseMjd: 60_470.1 },
      { programme: '2159', instrument: 'MIRI', investigator: 'Dang', title: 'A Hell of a Phase Curve', raDegrees: 350.9, decDegrees: -1.19, startMjd: 60_103.5, endMjd: 60_104.4, releaseMjd: null }]);
  assert.throws(() => parseTimeSeries([{ ...served, s_dec: 'south' }]), /row 1\.s_dec/u);
});

test('the archive is asked once, for JWST observations of type timeseries', async () => {
  const asked: Record<string, unknown>[] = [];
  assert.deepEqual(await jwstTimeSeries(async request => { asked.push(request); return []; }), []);
  assert.equal(asked.length, 1);
  assert.deepEqual((asked[0]!.params as { filters: unknown }).filters, [{ paramName: 'obs_collection', values: ['JWST'] }, { paramName: 'dataproduct_type', values: ['timeseries'] }]);
});

test('a visit is set on the orbit: what it holds, how many orbits it spans, and the day it is public', () => {
  const visits = visitsOf([
    row(60_000.4, 60_000.6), // half an orbit after transit, and no transit
    row(60_009.9, 60_010.1, { programme: '2' }), // a transit
    row(60_020, 60_020.7, { programme: '3', releaseMjd: 61_000 }), row(60_020.72, 60_021.3, { programme: '3', releaseMjd: 61_100 }), // two segments, one visit of 1.3 orbits
    row(60_030.2, 60_030.3, { programme: '4', releaseMjd: null }), // neither
    row(60_040.9, 60_041.6, { programme: '5' }), // a transit and the half-orbit place, under one orbit
    { ...row(60_050, 60_052, { programme: '6' }), raDegrees: 10.1 }, // another star, six arcminutes away
  ], star, orbit);
  assert.deepEqual(visits.map(visit => [visit.programme, visit.part, visit.orbits, visit.hours, visit.publicOn]),
    [['1', 'eclipse', 0.2, 4.8, '2024-07-09'], ['2', 'transit', 0.2, 4.8, '2024-07-09'], ['3', 'whole-orbit', 1.3, 31.2, '2026-03-01'], ['4', 'neither', 0.1, 2.4, null], ['5', 'transit-and-eclipse', 0.7, 16.8, '2024-07-09']]);
  assert.equal(visitLine(visits[2]!, '2026-01-01'), '2023-03-17 · MIRI · program 3 (Dang) · 31.2 h, 1.3 orbits · a whole orbit · private until 2026-03-01');
  assert.equal(visitLine(visits[2]!, '2026-03-01').endsWith('· public'), true);
  assert.equal(isPublic(visits[3]!, '2030-01-01'), false, 'no stated date is not public');
  assert.match(visitLine(visits[3]!, '2030-01-01'), /neither transit nor eclipse · no public date stated$/u);
});

test('a star is matched where it is in the visit\'s year, not where its catalogue puts it', () => {
  // In 2023 the star has moved 23 arcseconds: a row at its 2000 place is another place on the sky.
  const stale = { ...row(60_020, 60_021.3), decDegrees: 20 };
  assert.ok(23 > MATCH_ARCSEC);
  assert.equal(visitsOf([stale], star, orbit).length, 0);
  assert.equal(visitsOf([row(60_020, 60_021.3)], star, orbit).length, 1);
});

test('every planet with a recorded transit is asked of its own star: GJ 1214 b\'s whole orbit is found from its package orbit', () => {
  const place = starAstrometry('gj-1214'), period = hostedOrbit('gj-1214b').periodDays, when = MJD_J2000 + (place.positionEpochJulianYear - 2000) * 365.25;
  const watched = planetsWatched([{ programme: '1803', instrument: 'MIRI', investigator: 'Bean', title: 'GJ 1214b', raDegrees: place.rightAscensionDegrees, decDegrees: place.declinationDegrees, startMjd: when, endMjd: when + period * 1.09, releaseMjd: 59_900 }]);
  assert.deepEqual([...watched.keys()], ['gj-1214b']);
  assert.deepEqual(watched.get('gj-1214b')!.map(visit => [visit.part, visit.orbits]), [['whole-orbit', 1.09]]);
});
