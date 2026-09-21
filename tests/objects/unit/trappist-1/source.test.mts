/** The TRAPPIST-1 system's eight packages: their source pins, and that each planet turns synchronously with longitude 0 on its
 * star and orbits it. The planets' radii, masses and orbits are the astronomy records' (packages/astronomy/data/bodies), which
 * packages/astronomy/src/hostedOrbits.test.ts checks against the transit geometry. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { BODIES, hostedOrbit, hostedPlanetStateRelativeKm } from '@cssearth/astronomy';
import { createSourceManifest } from '../../../../src/platform/source-manifest.mts';
import { requireBodyFixedToIcrf, requireBodyOrbit } from '../../../../src/platform/solar-geometry.mts';
import { requireRecord } from '../../../../tools/source-values.mts';

const objects = resolve(import.meta.dirname, '../../../../src/objects');
const PLANETS = ['trappist-1b', 'trappist-1c', 'trappist-1d', 'trappist-1e', 'trappist-1f', 'trappist-1g', 'trappist-1h'] as const;

test('every TRAPPIST-1 package verifies against its source pins', async () => {
  for (const id of ['trappist-1', ...PLANETS]) {
    const name = id === 'trappist-1' ? 'TRAPPIST-1' : `TRAPPIST-1${id.slice(-1)}`;
    const source = await createSourceManifest({ planetId: id, planetName: name, sourceRoot: resolve(objects, id, 'source') });
    await source.verify();
  }
});

test('each planet turns synchronously with longitude 0 on TRAPPIST-1 and orbits it', async () => {
  for (const id of PLANETS) {
    const rotation = requireRecord(JSON.parse(await readFile(resolve(objects, id, 'source/preparation/rotation.json'), 'utf8')) as unknown);
    assert.equal(rotation.schema, 'cssearth-synchronous-rotation@1', id);
    assert.equal(rotation.host, 'trappist-1', id);
    // At the scene epoch the prepared body frame's +X points from the planet to its star.
    const m = requireBodyFixedToIcrf(id), state = hostedPlanetStateRelativeKm(id, 2461286.5), distance = Math.hypot(...state.positionKm);
    for (let axis = 0; axis < 3; axis++) assert.ok(Math.abs(m[axis * 3]! + state.positionKm[axis]! / distance) < 1e-9, `${id}: body +X faces the star`);
    assert.equal(requireBodyOrbit(id).centerBodyId, 'trappist-1', id);
    assert.equal(BODIES[id].parent, 'trappist-1', id);
  }
});

test('each planet transits when the Agol et al. (2024) forecast says, through the year around the scene epoch', async () => {
  // The forecast rows within a year of 2026-09-03, BJD_TDB - 2450000, as the star package pins them. A circular orbit cannot follow
  // transit-timing variations, so each planet is held to the largest departure its orbit record states, plus a minute.
  const [header, ...rows] = (await readFile(resolve(objects, 'trappist-1/source/science/agol-2024/forecast-2025-2027.csv'), 'utf8')).trim().split('\n');
  assert.equal(header, 'planet,transit,bjd_tdb_minus_2450000,agol2021_bjd_tdb_minus_2450000,difference_days,uncertainty_days');
  for (const [index, id] of PLANETS.entries()) {
    const orbit = hostedOrbit(id), times = rows.map(row => row.split(',').map(Number)).filter(row => row[0] === index + 1).map(row => row[2]! + 49999.5);
    const bound = Math.max(...(orbit.sources.period.match(/by ([+-][0-9.]+) to ([+-][0-9.]+) min/u) ?? []).slice(1).map(value => Math.abs(Number(value)))) + 1;
    assert.ok(times.length > 30 && Number.isFinite(bound), id);
    for (const time of times) {
      const cycles = Math.round((time - orbit.transitTimeBmjdTdb) / orbit.periodDays), predicted = orbit.transitTimeBmjdTdb + cycles * orbit.periodDays;
      assert.ok(Math.abs(predicted - time) * 1440 <= bound, `${id}: transit at ${time} predicted ${((predicted - time) * 1440).toFixed(1)} min off`);
    }
  }
});
