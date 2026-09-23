/** WASP-18b's Eigenspectra products (Challener, Weiner Mansfield et al. 2025; Zenodo 10.5281/zenodo.14751570): the reader
 * takes the deposited grids as they are, and the deposited flux maps, turned by this package's own orbit and synchronous rotation,
 * reproduce the deposited light curves, with the east-west mirror clearly worse over the 25 wavelengths. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { deflateRawSync } from 'node:zlib';
import { BODIES, hostedOrbit, starAstrometry } from '@cssearth/astronomy';
import { sourceTest } from '../../../tests/objects/source-test.mts';
import { fitScaleAndOffset, mapPhaseCurve, mirrorGrid, type EmissionGrid } from '../eclipse-map/phase-curve.mts';
import { loadEigenspectraGroups, loadEigenspectraTemperature } from './eigenspectra-map.mts';
import { readNpz } from './npz.mts';

const test = sourceTest('wasp-18b');
const root = new URL('../../../src/objects/wasp-18b/source/', import.meta.url).pathname;
const science = (name: string) => `science/challener-2025/${name}`;
const GROUPS = science('eigenspectra_25_bins_3_groups.npz');

/** One .npy member, as numpy writes a float64 array, in C or Fortran order. */
function npy(shape: number[], values: number[], fortran = false) {
  let header = `{'descr': '<f8', 'fortran_order': ${fortran ? 'True' : 'False'}, 'shape': (${shape.join(', ')}${shape.length === 1 ? ',' : ''}), }`;
  while ((10 + header.length + 1) % 64) header += ' ';
  header += '\n';
  const head = Buffer.alloc(10); head.write('\x93NUMPY', 0, 'latin1'); head[6] = 1; head[7] = 0; head.writeUInt16LE(header.length, 8);
  const data = Buffer.alloc(values.length * 8); values.forEach((value, i) => data.writeDoubleLE(value, i * 8));
  return Buffer.concat([head, Buffer.from(header, 'latin1'), data]);
}
/** A ZIP of named members, stored or deflated. */
function zip(members: [string, Buffer][], deflate: boolean) {
  const locals: Buffer[] = [], central: Buffer[] = []; let offset = 0;
  for (const [name, data] of members) {
    const body = deflate ? deflateRawSync(data) : data, file = Buffer.from(name);
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(deflate ? 8 : 0, 8); local.writeUInt32LE(body.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(file.length, 26);
    const entry = Buffer.alloc(46); entry.writeUInt32LE(0x02014b50, 0); entry.writeUInt16LE(deflate ? 8 : 0, 10); entry.writeUInt32LE(body.length, 20); entry.writeUInt32LE(data.length, 24); entry.writeUInt16LE(file.length, 28); entry.writeUInt32LE(offset, 42);
    locals.push(local, file, body); central.push(entry, file); offset += 30 + file.length + body.length;
  }
  const directory = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(members.length, 8); end.writeUInt16LE(members.length, 10); end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

test('the .npz reader reads stored and deflated members, scalars, and Fortran-order arrays in C order', () => {
  for (const deflate of [false, true]) {
    const archive = readNpz(zip([['arr_0.npy', npy([], [1.45])], ['arr_1.npy', npy([2, 3], [1, 4, 2, 5, 3, 6], true)], ['arr_2.npy', npy([2, 3], [1, 2, 3, 4, 5, 6])]], deflate));
    assert.deepEqual([...archive.get('arr_0')!.values], [1.45]);
    assert.deepEqual(archive.get('arr_0')!.shape, []);
    assert.deepEqual([...archive.get('arr_1')!.values], [1, 2, 3, 4, 5, 6], 'Fortran order is rearranged row by row');
    assert.deepEqual([...archive.get('arr_2')!.values], [1, 2, 3, 4, 5, 6]);
  }
});

test('the temperature maps are read on their node grid, over the observed longitudes, with the paper\'s hotspot near noon', async () => {
  let highest = -Infinity;
  for (const wave of ['0.89', '1.45', '2.79']) {
    const map = await loadEigenspectraTemperature(root, { path: science(`temp_wave_${wave}.npz`), observedFrom: GROUPS });
    const report = map.report as { wavelengthMicrons: number; observedLongitudes: number[]; hottestObserved: { value: number; latitude: number; longitude: number } };
    assert.ok(Math.abs(report.wavelengthMicrons - Number(wave)) < 0.01);
    assert.deepEqual(report.observedLongitudes.map(value => Math.round(value * 100) / 100), [-150.92, 133.87]);
    // The paper: the longitude of maximum brightness lies within a few degrees of the substellar point at every wavelength.
    assert.ok(Math.abs(report.hottestObserved.longitude) < 8 && Math.abs(report.hottestObserved.latitude) < 3, `${wave}: ${JSON.stringify(report.hottestObserved)}`);
    assert.equal(map.sample(170, 0), null, 'never seen during the eclipse');
    assert.ok(Math.abs(map.sample(report.hottestObserved.longitude, report.hottestObserved.latitude)! - report.hottestObserved.value) < 1e-6);
    highest = Math.max(highest, report.hottestObserved.value);
  }
  // Figure 1's colour scale tops at the hottest observed node of the 25 maps: 3,711 K, at 2.79 µm.
  assert.ok(Math.abs(highest - 3710.95) < 0.01, `${highest}`);
});

test('the group map puts the hotspot at noon, the ring around it and the outer group beyond, and its borders are drawn thin', async () => {
  const groups = await loadEigenspectraGroups(root, { path: GROUPS });
  assert.deepEqual((groups.report as { counts: Record<string, number> }).counts, { 0: 28478, 1: 13853, 2: 8969 });
  assert.equal(groups.sample(0, 0), 2, 'hotspot');
  assert.equal(groups.sample(60, 0), 1, 'ring');
  assert.equal(groups.sample(100, 0), 0, 'outer');
  assert.equal(groups.sample(170, 0), null);
  const map = await loadEigenspectraTemperature(root, { path: science('temp_wave_1.45.npz'), observedFrom: GROUPS, boundaries: true });
  const pixel = 360 / 2048;
  // Along the equator eastward the map crosses the hotspot-ring border once and the ring-outer border once.
  let crossings = 0, previous = false;
  for (let lon = 0; lon <= 133; lon += pixel) { const on = map.outline!(lon, 0, pixel); if (on && !previous) crossings++; previous = on; }
  assert.equal(crossings, 2);
  assert.equal(map.outline!(0, 0, pixel), false, 'no line inside the hotspot');
});

test('the deposited flux maps fit the deposited light curves through the package orbit and rotation; the east-west mirror does not', async () => {
  const maps = readNpz(await readFile(`${root}${science('Eigen_posteriors_Fpfs.npz')}`)), curves = readNpz(await readFile(`${root}${science('spec_lambin_25.npz')}`));
  const radians = (name: string) => maps.get(name)!.values.map(value => value * 180 / Math.PI);
  const latitudes = radians('arr_1'), longitudes = radians('arr_2'), flux = maps.get('arr_3')!.values, cells = 180 * 360;
  const time = curves.get('arr_0')!.values.map(value => value - 2400000.5), data = curves.get('arr_3')!.values, error = curves.get('arr_4')!.values, samples = time.length;
  const orbit = hostedOrbit('wasp-18b' as never), host = starAstrometry('wasp-18' as never);
  const radiusRatio = BODIES['wasp-18b' as keyof typeof BODIES].meanRadiusKm / BODIES['wasp-18' as keyof typeof BODIES].meanRadiusKm;
  let eastWest = 0, northSouth = 0, uniform = 0, worst = 0;
  for (let wave = 0; wave < 25; wave++) {
    // arr_3 holds the lower, best and upper maps at each wavelength; the best is the middle one.
    const grid: EmissionGrid = { width: 360, height: 180, values: flux.slice((wave * 3 + 1) * cells, (wave * 3 + 2) * cells), latitudes, longitudes };
    const d = data.slice(wave * samples, (wave + 1) * samples), e = error.slice(wave * samples, (wave + 1) * samples);
    const fit = (g: EmissionGrid) => fitScaleAndOffset(mapPhaseCurve(g, orbit, host, radiusRatio, time), d, e, () => true);
    const deposited = fit(grid), dof = deposited.samples - 2;
    worst = Math.max(worst, deposited.reducedChiSquared);
    // The light curves are in parts per million; a map in planet-to-star flux per projected area needs no other scaling.
    assert.ok(Math.abs(deposited.scale / 1e6 - 1) < 0.02, `scale ${deposited.scale}`);
    eastWest += (fit(mirrorGrid(grid, 'longitude')).reducedChiSquared - deposited.reducedChiSquared) * dof;
    northSouth += (fit(mirrorGrid(grid, 'latitude')).reducedChiSquared - deposited.reducedChiSquared) * dof;
    uniform += (fit({ ...grid, values: new Float64Array(cells).fill(1) }).reducedChiSquared - deposited.reducedChiSquared) * dof;
  }
  // Measured 2026-09-23 over all 25 wavelengths: chi-squared rises 384.8 mirrored east-west, 4468.3 for a uniform planet, and falls
  // 15.9 mirrored north-south (north and south are not decided, as the paper says); the paper reports 1.02 to 1.39 per wavelength.
  assert.ok(worst < 1.4, `reduced chi-squared up to ${worst}`);
  assert.ok(Math.abs(eastWest - 384.8) < 1, `east-west ${eastWest}`);
  assert.ok(Math.abs(uniform - 4468.3) < 1, `uniform ${uniform}`);
  assert.ok(Math.abs(northSouth) < 20, `north-south ${northSouth}`);
});
