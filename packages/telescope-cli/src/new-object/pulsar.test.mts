/** The pulsar route of the object generator: the spec's refusals, the tilted frame, and a package written from cited values offline. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { directionFromRaDec } from '@cssearth/astronomy';
import type { NsxTable } from '@cssearth/bake/objects/stellar';
import type { Archive } from './archives.mts';
import { generatePulsar, parsePulsarSpec, pulsarRecord, tiltedOrientation } from './pulsar.mts';
import { parseObjectSpecs } from './spec.mts';

const cell = (value: number) => ({ value, cell: 'test' }), paper = 'https://arxiv.org/abs/2407.06789', cited = (value: number) => ({ value, source: 'A paper, Table 1', url: paper });
const pulsar = { id: 'test-pulsar', name: 'Test Pulsar', description: 'A test.', paper: { url: paper, credit: 'A paper' },
  position: { rightAscensionDegrees: 69.3, declinationDegrees: -47.25, epochJulianYear: 2010.79, properMotionRaMasPerYear: 121.4, properMotionDecMasPerYear: -71.5, source: 'A paper, Table 1', url: paper },
  distance: cited(157), radialVelocity: cited(-75), radius: cited(11.36), mass: cited(1.418), spin: { frequencyHz: 173.69, inclinationDegrees: 137.5, source: 'A paper, Table 1', url: paper },
  hotRegions: { label: 'NICER', path: 'science/a-paper/hot-regions.json', url: paper, credit: 'A paper', observed: 'NICER pulse profiles',
    record: { schema: 'cssearth-published-hot-regions@1', source: 'A paper', regions: [{ id: 'spot', phaseCycles: cell(0.25), superseding: { colatitudeRadians: cell(1), radiusRadians: cell(0.2), log10TemperatureK: cell(6.1) } }] } },
  limb: { nsxTable: 'nsx_H_v200804.out' }, text: { card: 'A test pulsar.', introduction: 'A test pulsar with one hot spot.', locator: 'Abstract' } };
const arxiv = '<feed><entry><title>A test paper</title><author><name>Ada Author</name></author><published>2024-07-09T00:00:00Z</published></entry></feed>';
const archive: Archive = { text: async () => arxiv, bytes: async () => Buffer.alloc(0), exists: async () => true, redirect: async () => undefined } as Archive;

/** A table whose law is u1 = 0.8, u2 = 0 at every node, in place of the 256 MB one. */
function nsxTable(): NsxTable {
  const log10Temperature = [5, 6.5], log10Gravity = [13.7, 15], log10EnergyOverKt = [-1, 0, 1], mu = [1, 0.75, 0.5, 0.25, 0.05, 0.000001];
  const log10Intensity = new Float64Array(2 * 2 * 3 * mu.length);
  let row = 0;
  for (const _temperature of log10Temperature) for (const _gravity of log10Gravity) for (const energy of log10EnergyOverKt) for (const cosine of mu) log10Intensity[row++] = Math.log10(0.2 + 0.8 * cosine) - energy * energy;
  return { log10Temperature, log10Gravity, log10EnergyOverKt, mu, log10Intensity };
}

test('a pulsar spec is checked before anything is written', () => {
  assert.equal(parsePulsarSpec(pulsar).system, 'Test Pulsar system');
  assert.throws(() => parsePulsarSpec({ ...pulsar, radius: cited(8000) }), /radius.value 8000 is outside 5 to 30/u);
  assert.throws(() => parsePulsarSpec({ ...pulsar, temperature: cited(1e6) }), /unknown pulsar spec fields temperature/u);
  assert.throws(() => parsePulsarSpec({ ...pulsar, limb: undefined }), /a pulsar is drawn with its atmosphere's limb/u);
  assert.throws(() => parsePulsarSpec({ ...pulsar, spin: { ...pulsar.spin, inclinationDegrees: 190 } }), /outside 0 to 180/u);
  assert.throws(() => parsePulsarSpec({ ...pulsar, hotRegions: { ...pulsar.hotRegions, record: { schema: 'other' } } }), /cssearth-published-hot-regions@1/u);
  assert.deepEqual(parseObjectSpecs({ pulsars: [pulsar] }).pulsars.map(spec => spec.id), ['test-pulsar']);
  assert.throws(() => parseObjectSpecs({ pulsars: [pulsar, pulsar] }), /Object ids repeat: test-pulsar/u);
  const record = pulsarRecord(parsePulsarSpec(pulsar), 9000);
  assert.equal(record.physical.meanRadiusKm, 11.36);
  assert.equal('effectiveTemperatureK' in record.physical, false, 'no whole-surface temperature is measured');
});

test('the north pole is tilted from the line of sight by the published angle, and longitude 0 faces Earth', () => {
  for (const inclination of [30, 90, 137.5]) {
    const { rightAscensionDegrees, declinationDegrees, displayMeridianDegrees } = tiltedOrientation(69.3, -47.25, inclination);
    const pole = directionFromRaDec(rightAscensionDegrees, declinationDegrees), toEarth = directionFromRaDec(69.3, -47.25).map(value => -value);
    const dot = (a: readonly number[], b: readonly number[]) => a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;
    assert.ok(Math.abs(Math.acos(dot(pole, toEarth)) * 180 / Math.PI - inclination) < 1e-9);
    // The body +X axis (longitude 0 on the equator): the node turned about the pole by W. Earth lies on its meridian.
    const length = Math.hypot(pole[0], pole[1]), node = [-pole[1] / length, pole[0] / length, 0], w = displayMeridianDegrees * Math.PI / 180;
    const along = [pole[1] * node[2]! - pole[2] * node[1]!, pole[2] * node[0]! - pole[0] * node[2]!, pole[0] * node[1]! - pole[1] * node[0]!];
    const x = node.map((value, k) => Math.cos(w) * value + Math.sin(w) * along[k]!), y = [pole[1] * x[2]! - pole[2] * x[1]!, pole[2] * x[0]! - pole[0] * x[2]!, pole[0] * x[1]! - pole[1] * x[0]!];
    assert.ok(Math.abs(dot(y, toEarth)) < 1e-9 && dot(x, toEarth) > 0, `Earth is on the meridian of longitude 0 at inclination ${inclination}`);
  }
});

test('a pulsar package is its cited values and its hot-region map, with no temperature or colour of its own', async () => {
  const { files, regions, minimum, maximum } = await generatePulsar(parsePulsarSpec(pulsar), { archive, order: 9000, epochJdTt: 2461286.5, nsxTable: nsxTable() });
  const read = (path: string) => JSON.parse(String(files.get(path))) as Record<string, any>;
  assert.equal(regions, 1);
  assert.deepEqual([minimum, maximum], [1200000, 1300000]);
  const raster = read('src/objects/test-pulsar/source/preparation/raster.json');
  assert.deepEqual(raster.surfaces.map((surface: { id: string; science: { format: string } }) => [surface.id, surface.science.format]), [['temperature', 'published-hot-region-map']]);
  assert.equal(read('src/objects/test-pulsar/source/measurements.json').schema, 'cssearth-neutron-star@1');
  const limb = read('src/objects/test-pulsar/source/photometry/nsx-limb-darkening.json');
  assert.deepEqual([limb.u1.value, limb.u2.value, raster.surfaces[0].science.limbDarkening.path], [0.8, 0, 'photometry/nsx-limb-darkening.json']);
  assert.equal(read('src/objects/test-pulsar/object.json').properties.recipe.shape.radiusKm, 11.36);
  assert.deepEqual(read('src/objects/test-pulsar/source/content/object.json').panel.facts.map((fact: { value: string }) => fact.value), ['11.36 km', '1.418 solar masses', '174 turns a second', '157 parsecs']);
  assert.ok(files.has('src/objects/test-pulsar/source/science/a-paper/hot-regions.json') && files.has('src/sources/arxiv-2407-06789.json'));
  assert.ok(![...files.values()].some(value => String(value).includes('TODO(new-object)')), 'nothing is left for a person to fill in');
});

test("posterior samples are thinned into the package and the map draws their mean", async () => {
  const column = (name: string) => ({ column: name });
  const record = { ...pulsar.hotRegions.record, bulk: { temperatureK: cell(250000), source: 'Another paper, Table 1 measure', url: paper },
    posterior: { path: 'science/a-paper/posterior-samples.tsv', source: 'a deposit', columns: [{ id: 'spot', phaseCycles: column('phase'), superseding: { colatitudeRadians: column('colatitude'), radiusRadians: column('radius'), log10TemperatureK: column('temperature') } }] } };
  const spec = { ...pulsar, hotRegions: { ...pulsar.hotRegions, record }, posterior: { samples: 'post_equal_weights.dat', parameters: ['mass', 'phase', 'colatitude', 'radius', 'temperature'], keep: 100, url: 'https://doi.org/10.5281/zenodo.13766753', credit: 'A deposit' } };
  assert.throws(() => parsePulsarSpec({ ...spec, hotRegions: pulsar.hotRegions }), /need hotRegions.record.posterior/u);
  // 300 samples of one spot whose radius grows from 0.1 to 0.4 rad: every third is kept.
  const posteriorText = Array.from({ length: 300 }, (_, i) => `1.4 0.25 1 ${(0.1 + 0.001 * i).toFixed(4)} 6.1`).join('\n');
  const { files } = await generatePulsar(parsePulsarSpec(spec), { archive, order: 9000, epochJdTt: 2461286.5, nsxTable: nsxTable(), posteriorText });
  const rows = String(files.get('src/objects/test-pulsar/source/science/a-paper/posterior-samples.tsv')).trim().split('\n');
  assert.deepEqual([rows[0], rows.length], ['phase\tcolatitude\tradius\ttemperature', 101]);
  const stored = JSON.parse(String(files.get('src/objects/test-pulsar/source/preparation/new-object.json'))) as { posterior: { samples: string } };
  assert.equal(stored.posterior.samples, 'post_equal_weights.dat');
  assert.match(String(files.get('src/objects/test-pulsar/README.md')), /the mean over 100 of the fit's 300 posterior samples \(every 3rd\)/u);
});
