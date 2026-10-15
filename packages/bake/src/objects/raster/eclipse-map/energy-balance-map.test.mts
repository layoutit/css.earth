import assert from 'node:assert/strict';
import { sourceTest } from '@cssearth/objects/node/source-test';
import { loadPublishedEnergyBalanceMap, parsePublishedEnergyBalanceMap, thermalPhaseFunction } from '@cssearth/bake/objects/raster';

const test = sourceTest();
const objects = new URL('../../../../../../src/objects/', import.meta.url);

test('over one turn every longitude emits what it absorbs: the mean of P^4 is 1/pi whatever epsilon is', () => {
  for (const epsilon of [0.3, 1, 10.9, 50]) {
    const p = thermalPhaseFunction(epsilon);
    const mean = p.reduce((sum, value) => sum + value ** 4, 0) / p.length;
    assert.ok(Math.abs(mean - 1 / Math.PI) < 1e-4, `epsilon ${epsilon}: ${mean}`);
  }
});

test('with no transport each longitude is in equilibrium with its own starlight, and westward winds mirror the map', () => {
  const steps = 7200, rock = thermalPhaseFunction(0, steps);
  for (const degrees of [-120, -45, 0, 30, 89]) {
    const i = (degrees + 180) / 360 * steps;
    assert.ok(Math.abs(rock[i]! - Math.max(Math.cos(degrees * Math.PI / 180), 0) ** 0.25) < 1e-12);
  }
  const east = thermalPhaseFunction(2, steps), west = thermalPhaseFunction(-2, steps);
  for (const i of [100, 1800, 3600, 5000]) assert.ok(Math.abs(west[i]! - east[(steps - i) % steps]!) < 1e-15);
  // East-blowing winds carry the heat past noon: the hottest longitude lies east of the point under the star.
  let hottest = 0; for (let i = 1; i < steps; i++) if (east[i]! > east[hottest]!) hottest = i;
  assert.ok(-180 + hottest * 360 / steps > 0);
});

test('WASP-100 b: Jansen & Kipping (2020)\'s fitted model gives back their printed hottest and coldest points', async () => {
  const map = await loadPublishedEnergyBalanceMap(new URL('wasp-100b/source', objects).pathname, { path: 'science/jansen-kipping-2020/energy-balance-map.json' });
  const { derived } = map.report as unknown as { derived: Record<string, number> };
  // Their results table: T_max 2710 +/- 100 K, T_min 2380 +170/-200 K; their parameter table: T_eq 2099 +/- 38 K for a zero albedo.
  assert.ok(Math.abs(derived.maximumK! - 2710) <= 100, `hottest ${derived.maximumK}`);
  assert.ok(Math.abs(derived.minimumK! - 2380) <= 170, `coldest ${derived.minimumK}`);
  assert.ok(Math.abs(derived.equilibriumK! - 2099) <= 1, `equilibrium ${derived.equilibriumK}`);
  // The printed offset, 71 +2/-4 degrees east, is the median over their samples; the map of the median parameters peaks at 66.
  assert.ok(derived.hotspotDegreesEast! > 60 && derived.hotspotDegreesEast! < 73, `hottest at ${derived.hotspotDegreesEast}`);
  // cos(latitude)^(1/4): the same east of noon north and south, cooler toward the poles.
  assert.equal(map.sample(66, 40), map.sample(66, -40));
  assert.ok(map.sample(66, 0)! > map.sample(66, 60)!);
});

test('a record outside the model\'s range is refused', () => {
  const cell = (value: number) => ({ value, cell: String(value), where: 'test' });
  const base = { schema: 'cssearth-published-energy-balance-map@1', source: 's', reported: {},
    model: { kind: 'cowan-agol-2011', starTemperatureK: cell(6000), semiMajorAxisStellarRadii: cell(5), bondAlbedo: cell(0.2), redistribution: cell(1), intrinsicFactor: cell(1) } };
  assert.doesNotThrow(() => parsePublishedEnergyBalanceMap(base));
  assert.throws(() => parsePublishedEnergyBalanceMap({ ...base, model: { ...base.model, bondAlbedo: cell(1) } }), /Bond albedo/u);
  assert.throws(() => parsePublishedEnergyBalanceMap({ ...base, model: { ...base.model, kind: 'other' } }), /Unknown energy-balance model/u);
});
