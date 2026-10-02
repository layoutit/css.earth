/** The published hot-region map reader, and PSR J0437-4715's record read against what Choudhury et al. (2024) say of their own fit. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { sourceTest } from '@cssearth/objects/node/source-test';
import { hotRegionTemperature, parseHotRegionSamples, parsePublishedHotRegions, publishedHotRegionMap } from '@cssearth/bake/objects/raster';

const test = sourceTest();
const cell = (value: number) => ({ value, cell: 'test' });
const record = (regions: unknown[]) => ({ schema: 'cssearth-published-hot-regions@1', source: 'test', regions });
const circle = (colatitudeRadians: number, radiusRadians: number, log10TemperatureK: number) => ({ colatitudeRadians: cell(colatitudeRadians), radiusRadians: cell(radiusRadians), log10TemperatureK: cell(log10TemperatureK) });

test('a circle is hot inside its angular radius; a ring has a cold middle; a ceding circle shows only outside its superseding one', () => {
  const quarter = Math.PI / 2, degree = Math.PI / 180;
  const map = parsePublishedHotRegions(record([
    { id: 'ring', phaseCycles: cell(0.25), superseding: circle(quarter, 20 * degree, 6), omit: { radiusRadians: cell(5 * degree) } },
    { id: 'pair', antiphased: true, phaseCycles: cell(0.25), superseding: circle(quarter, 5 * degree, 6.2), cede: { ...circle(quarter, 20 * degree, 5.7), azimuthRadians: cell(10 * degree) } }]));
  // Phase 0.25 is 90 degrees east; the antiphased region is half a turn further, at -90.
  assert.equal(hotRegionTemperature(map, 90, 0), null, 'the middle of a ring');
  assert.equal(hotRegionTemperature(map, 90, 10), 1e6);
  assert.equal(hotRegionTemperature(map, 90, 21), null, 'outside the ring');
  assert.equal(hotRegionTemperature(map, 111, 0), null);
  assert.ok(Math.abs(hotRegionTemperature(map, -90, 0)! - 10 ** 6.2) < 1e-6, 'the superseding circle wins where both cover');
  // The ceding circle is centred 10 degrees east of the superseding one, at -80.
  assert.ok(Math.abs(hotRegionTemperature(map, -62, 0)! - 10 ** 5.7) < 1e-6);
  assert.equal(hotRegionTemperature(map, -101, 0), null, 'west of the ceding circle');
  assert.equal(publishedHotRegionMap(map).sample(0, 91), null);
  assert.throws(() => parsePublishedHotRegions(record([{ id: 'a', phaseCycles: cell(0), superseding: circle(1, 0.3, 6) }, { id: 'b', phaseCycles: cell(0.05), superseding: circle(1, 0.3, 6) }])), /overlap/u);
  assert.throws(() => parsePublishedHotRegions(record([{ id: 'a', phaseCycles: cell(0), superseding: circle(1, 0.3, 6), omit: { radiusRadians: cell(0.4) } }])), /inside the superseding/u);
  // A separately measured temperature fills the surface outside the regions, and must be cooler than every region.
  const spot = { id: 'a', phaseCycles: cell(0), superseding: circle(1, 0.3, 6) }, bulk = (kelvin: number) => ({ temperatureK: cell(kelvin), source: 'another paper', url: 'https://arxiv.org/abs/0000.00000' });
  assert.equal(hotRegionTemperature(parsePublishedHotRegions({ ...record([spot]), bulk: bulk(250000) }), 180, -80), 250000);
  assert.throws(() => parsePublishedHotRegions({ ...record([spot]), bulk: bulk(2e6) }), /below the coolest hot region/u);
});

test('a posterior draws the mean of its samples: sharp where they agree, graded where they differ', () => {
  const degree = Math.PI / 180, column = (name: string) => ({ column: name });
  const posterior = { path: 'science/a-paper/samples.tsv', source: 'a paper\'s samples',
    columns: [{ id: 'spot', phaseCycles: column('phase'), superseding: { colatitudeRadians: column('colatitude'), radiusRadians: column('radius'), log10TemperatureK: column('temperature') } }] };
  const map = parsePublishedHotRegions({ ...record([{ id: 'spot', phaseCycles: cell(0), superseding: circle(Math.PI / 2, 15 * degree, 6) }]),
    bulk: { temperatureK: cell(250000), source: 'another paper', url: 'https://arxiv.org/abs/0000.00000' }, posterior });
  // Two samples of one spot on the equator at longitude 0: 10 and 20 degrees in radius, both at a million kelvin.
  const samples = parseHotRegionSamples(map, ['phase\tcolatitude\tradius\ttemperature', `0\t${Math.PI / 2}\t${10 * degree}\t6`, `0\t${Math.PI / 2}\t${20 * degree}\t6`, ''].join('\n'));
  const drawn = publishedHotRegionMap(map, samples);
  assert.ok(Math.abs(drawn.sample(5, 0)! - 1e6) < 1e-6, 'inside both samples');
  assert.ok(Math.abs(drawn.sample(15, 0)! - (1e6 + 250000) / 2) < 1e-6, 'inside one of the two');
  assert.equal(drawn.sample(25, 0), 250000, 'outside both: the bulk surface');
  assert.equal(drawn.report.posterior?.samples, 2);
  assert.throws(() => parseHotRegionSamples(map, 'phase\tcolatitude\n0\t1\n'), /no column radius/u);
  assert.throws(() => parsePublishedHotRegions({ ...record([{ id: 'spot', phaseCycles: cell(0), superseding: circle(1, 0.2, 6) }]), posterior }), /needs bulk/u);
});

test("PSR J0437-4715's record draws what Choudhury et al. (2024) describe: a ring around the north pole and a two-temperature spot in the south", async () => {
  const map = parsePublishedHotRegions(JSON.parse(await readFile(resolve('src/objects/psr-j0437-4715/source/science/choudhury-2024/hot-regions.json'), 'utf8')) as unknown);
  const at = (longitude: number, latitude: number) => hotRegionTemperature(map, longitude, latitude);
  // Section VI and Figure 11: "a ring encompassing the north pole". The pole is in the hole and the ring crosses every meridian.
  assert.equal(at(0, 90), map.bulk!.kelvin, 'the pole is in the hole of the ring, at the bulk temperature');
  for (let longitude = -180; longitude < 180; longitude += 10) {
    let hot = 0;
    for (let latitude = 40; latitude < 90; latitude += 0.5) if (at(longitude, latitude) !== map.bulk!.kelvin) hot++;
    assert.ok(hot > 0, `the ring crosses longitude ${longitude}`);
  }
  // "a two-temperature spot in the southern hemisphere", "almost at the observer inclination" (137.5 degrees from the north pole).
  const [primary, secondary] = map.regions;
  assert.ok(secondary!.ceding!.colatitudeRadians > Math.PI / 2 && Math.abs(secondary!.superseding.colatitudeRadians * 180 / Math.PI - 137.5) < 1);
  // "a very small and high temperature superseding component compared to the larger and low temperature ceding component".
  assert.ok(secondary!.superseding.radiusRadians < secondary!.ceding!.radiusRadians / 5 && secondary!.superseding.kelvin > secondary!.ceding!.kelvin);
  // "non-antipodal": the secondary's centre is far from the point opposite the primary's.
  const antipode = { colatitude: Math.PI - primary!.superseding.colatitudeRadians, longitude: primary!.superseding.longitudeDegrees + 180 };
  const s = secondary!.superseding, separation = Math.acos(Math.cos(antipode.colatitude) * Math.cos(s.colatitudeRadians) + Math.sin(antipode.colatitude) * Math.sin(s.colatitudeRadians) * Math.cos((antipode.longitude - s.longitudeDegrees) * Math.PI / 180));
  assert.ok(separation * 180 / Math.PI > 30, `the secondary is ${(separation * 180 / Math.PI).toFixed(1)} degrees from the primary's antipode`);
  // The three temperatures of the table's ML column, in kelvin, and the bulk surface.
  const temperatures = new Set<number>();
  for (let latitude = -89.75; latitude < 90; latitude += 0.5) for (let longitude = -179.75; longitude < 180; longitude += 0.5) { const kelvin = at(longitude, latitude); temperatures.add(Math.round(kelvin!)); }
  // The fourth is the bulk surface of Qi et al. (2026), Table 1: 2.50 x 10^5 K.
  assert.deepEqual([...temperatures].sort((a, b) => a - b), [250000, ...[10 ** 5.724, 10 ** 6.075, 10 ** 6.199].map(Math.round)]);
});
