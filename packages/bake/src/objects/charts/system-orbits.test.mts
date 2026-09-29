import assert from 'node:assert/strict';
import test from 'node:test';
import { hostedOrbit, bodyData } from '@cssearth/astronomy';
import { parseSystemOrbits, readSystemOrbits, renderSystemOrbits } from '@cssearth/bake/objects/charts';

const recipe = (highlight: string) => parseSystemOrbits({ kind: 'system-orbits', id: 'trappist-1e-orbits', title: 'TRAPPIST-1 e: orbits', description: 'd', output: 'o.svg', metadata: {}, system: 'trappist-1', highlight });

test('the orbits chart draws every hosted planet of the star from its own record, the transit toward Earth', () => {
  const orbits = readSystemOrbits(recipe('trappist-1e'));
  assert.deepEqual(orbits.map(orbit => orbit.id), ['trappist-1b', 'trappist-1c', 'trappist-1d', 'trappist-1e', 'trappist-1f', 'trappist-1g', 'trappist-1h'], 'innermost first');
  assert.deepEqual(orbits.filter(orbit => orbit.highlight).map(orbit => orbit.id), ['trappist-1e']);
  // The semi-major axis is the record's a/R* times the star's radius: the orbit the scene flies.
  const e = orbits[3]!, record = hostedOrbit('trappist-1e');
  assert.ok(Math.abs(e.a - record.semiMajorAxisStellarRadii * bodyData('trappist-1').meanRadiusKm / 149597870.7) < 1e-12);
  // At the transit, true anomaly pi/2 - omega, the planet is straight toward Earth: +y, the bottom of the chart.
  const omega = (record.argumentOfPeriapsisDegrees ?? 90) * Math.PI / 180, f = Math.PI / 2 - omega, r = e.a * (1 - e.e ** 2) / (1 + e.e * Math.cos(f));
  const theta = f + omega;
  assert.ok(Math.abs(r * Math.cos(theta)) < 1e-12 && r * Math.sin(theta) > 0);
  const svg = renderSystemOrbits(recipe('trappist-1e'), orbits);
  assert.equal((svg.match(/class="orbit"/gu) ?? []).length, 7);
  assert.match(svg, /Earth ↓/u);
  assert.throws(() => readSystemOrbits(recipe('wasp-12b')), /wasp-12b is not a hosted planet of trappist-1; its planets are trappist-1b/u);
});
