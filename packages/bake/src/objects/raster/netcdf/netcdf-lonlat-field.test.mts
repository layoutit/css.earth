/** The released longitude/latitude field reader against the reference library's fixture (fixtures/README.md): the grid is
 * four latitudes by eight longitudes, and every expected value is the one the fixture's definition states. */
import assert from 'node:assert/strict';
import { mkdtemp, open, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { decodeNetcdfLonLatField, loadNetcdfLonLatField, loadScienceSurface, openClassicNetcdf, valueRange, type NetcdfVariable } from '@cssearth/bake/objects/raster';

const root = resolve(import.meta.dirname, 'fixtures');
const field = (overrides: Record<string, unknown> = {}) => ({ format: 'netcdf-lonlat-field', path: 'field-cdf2.nc', variable: 'TS',
  coordinates: { longitude: 'lon', latitude: 'lat' }, select: { time: 1 }, sourceUnits: 'K', longitudeZeroAt: 0, coordinateToleranceDegrees: 0.005, ...overrides });
/** TS[time, lat i, lon j] as the fixture defines it. */
const surface = (time: number, i: number, j: number) => 200 + 100 * time + 10 * i + j;

test('a field is read at the stated time, reproduces every node and is bilinear between them', async () => {
  const map = await loadNetcdfLonLatField(root, field());
  for (let i = 0; i < 4; i++) for (let j = 0; j < 8; j++) assert.equal(map.sample(j * 45, -67.5 + i * 45), surface(1, i, j), `node ${i},${j}`);
  assert.equal(map.sample(22.5, -67.5), surface(1, 0, 0) + 0.5, 'halfway between two longitudes');
  assert.equal(map.sample(0, -45), surface(1, 0, 0) + 5, 'halfway between two latitudes');
  // The grid goes all the way around: between its last longitude and its first.
  assert.equal(map.sample(337.5, 22.5), (surface(1, 2, 7) + surface(1, 2, 0)) / 2);
  assert.equal(map.sample(-45, 22.5), surface(1, 2, 7), 'longitude -45 is 315 east');
  assert.equal(map.sample(0, 80), null, 'no row is released beyond 67.5 degrees, and none is invented');
  assert.deepEqual(map.report, { format: 'netcdf-lonlat-field', variable: 'TS', dimensions: ['time', 'lat', 'lon'], select: { time: 1 }, units: 'K', longitudeZeroAt: 0,
    width: 8, height: 4, longitudeRange: [0, 315], latitudeRange: [-67.5, 67.5], minimum: 300, maximum: 337, missing: 0,
    polarCoverage: 'No extrapolation beyond the released latitude samples.' });
  assert.equal((await loadNetcdfLonLatField(root, field({ select: { time: 0 } }))).sample(90, 22.5), surface(0, 2, 2));
});

test('the body\'s zero meridian falls on the grid longitude the recipe states', async () => {
  // A model that puts the star overhead at 180 degrees east: body longitude 0 reads the grid's 180.
  const map = await loadNetcdfLonLatField(root, field({ longitudeZeroAt: 180 }));
  assert.equal(map.sample(0, -67.5), surface(1, 0, 4));
  assert.equal(map.sample(90, -67.5), surface(1, 0, 6));
  assert.equal(map.sample(-180, -67.5), surface(1, 0, 0));
});

test('a level is selected by name, latitudes stored north to south are turned, and packed values are unpacked', async () => {
  const level = await loadNetcdfLonLatField(root, field({ variable: 'T', select: { time: 0, lev: 1 } }));
  assert.equal(level.sample(45, 22.5), 1000 + 10 * 2 + 1 + 0.5);
  // TSD[latd i, lon j] = 300 + 10 i + j with latd running 67.5 down to -67.5.
  const turned = await loadNetcdfLonLatField(root, field({ variable: 'TSD', coordinates: { longitude: 'lon', latitude: 'latd' }, select: {} }));
  assert.equal(turned.sample(45, 67.5), 301);
  assert.equal(turned.sample(45, -67.5), 331);
  assert.deepEqual(turned.report.latitudeRange, [-67.5, 67.5]);
  // PACKED stores 10 i + j as shorts, with scale 0.5, offset 200 and one cell at the fill value.
  const packed = await loadNetcdfLonLatField(root, field({ variable: 'PACKED', select: {} }));
  assert.equal(packed.sample(135, -22.5), 200 + 0.5 * 13);
  assert.equal(packed.sample(90, -22.5), null, 'the cell at the fill value has no value');
  assert.equal(packed.sample(100, -22.5), null, 'nor does a sample that would use it');
  assert.equal(packed.report.missing, 1);
  assert.deepEqual([packed.report.minimum, packed.report.maximum], [200, 218.5]);
});

test('whatever the recipe leaves unsaid or says wrongly is refused with the file and the field', async () => {
  await assert.rejects(loadNetcdfLonLatField(root, field({ select: {} })), /field-cdf2\.nc, select gives no index along time; TS varies along time, lat, lon/u);
  await assert.rejects(loadNetcdfLonLatField(root, field({ select: { time: 2 } })), /field-cdf2\.nc, select\.time is 2; time has 2 entries, counted from 0/u);
  await assert.rejects(loadNetcdfLonLatField(root, field({ select: { time: 0, lat: 1 } })), /select names lat, which TS is not selected along/u);
  await assert.rejects(loadNetcdfLonLatField(root, field({ select: { time: 0, lev: 0 } })), /select names lev, which TS is not selected along/u);
  await assert.rejects(loadNetcdfLonLatField(root, field({ sourceUnits: 'degC' })), /sourceUnits is "degC", and the file gives TS the units "K"/u);
  await assert.rejects(loadNetcdfLonLatField(root, field({ variable: 'date', select: {} })), /sourceUnits is "K", and the file gives date the units null/u);
  await assert.rejects(loadNetcdfLonLatField(root, field({ variable: 'TSKIN' })), /field-cdf2\.nc has no variable TSKIN/u);
  await assert.rejects(loadNetcdfLonLatField(root, field({ coordinates: { longitude: 'lonr', latitude: 'lat' } })), /longitude variable lonr has the units "radians", not degrees/u);
  await assert.rejects(loadNetcdfLonLatField(root, field({ coordinates: { longitude: 'lon', latitude: 'lev' } })), /latitude variable lev has the units "hPa", not degrees/u);
  await assert.rejects(loadNetcdfLonLatField(root, field({ variable: 'TSD', select: {} })), /TSD does not vary along lat, the dimension of its latitude lat/u);
  await assert.rejects(loadNetcdfLonLatField(root, field({ path: '../field-cdf2.nc' })), /must be inside the source directory/u);
  const { longitudeZeroAt: _unsaid, ...silent } = field();
  await assert.rejects(loadNetcdfLonLatField(root, silent), /field-cdf2\.nc, longitudeZeroAt/u);
});

test('a release kept as its first bytes and the bytes of the selected grid reads as the whole file does', async () => {
  // The two ranges a 3.5 GB release is kept as, cut here from the fixture: everything up to the end of its coordinates, and TS at time 1.
  const whole = await openClassicNetcdf(resolve(root, 'field-cdf2.nc'));
  const coordinates = ['lat', 'lon'].map(name => valueRange(whole, name, 0, whole.variables.get(name)!.shape[0]!, 'fixture'));
  const head = { offset: 0, length: Math.max(...coordinates.map(range => range.offset + range.length)) }, grid = valueRange(whole, 'TS', 32, 32, 'fixture');
  await whole.close();
  const directory = await mkdtemp(join(tmpdir(), 'cssearth-netcdf-')), file = await open(resolve(root, 'field-cdf2.nc'), 'r');
  try {
    for (const [name, range] of [['field.head.dat', head], ['field.TS-time1.dat', grid]] as const) {
      const bytes = Buffer.alloc(range.length);
      await file.read(bytes, 0, range.length, range.offset);
      await writeFile(join(directory, name), bytes);
    }
    const kept = (overrides: Record<string, unknown> = {}) => field({ path: 'field.head.dat', field: 'field.TS-time1.dat', ...overrides });
    const manifest = (range: { offset: number; length: number }) => writeFile(join(directory, 'manifest.json'), JSON.stringify({ inputs: [
      { path: 'field.head.dat', range: head }, { path: 'field.TS-time1.dat', range }, { path: 'another.json' }] }));
    await manifest(grid);
    const map = await loadNetcdfLonLatField(directory, kept()), reference = await loadNetcdfLonLatField(root, field());
    for (let i = 0; i < 4; i++) for (let j = 0; j < 8; j++) assert.equal(map.sample(j * 45, -67.5 + i * 45), surface(1, i, j), `node ${i},${j}`);
    assert.deepEqual(map.report, reference.report);
    // The recipe's selection and the manifest's range must be the same bytes: another time lies elsewhere in the release.
    await assert.rejects(loadNetcdfLonLatField(directory, kept({ select: { time: 0 } })),
      new RegExp(`field\\.TS-time1\\.dat: the manifest declares 128 bytes from ${grid.offset}, and the header in field\\.head\\.dat puts the selected TS at 128 bytes from `, 'u'));
    await assert.rejects(loadNetcdfLonLatField(directory, kept(), new Map([['field.head.dat', head]])), /the manifest declares no byte range/u);
    await assert.rejects(loadNetcdfLonLatField(directory, kept(), new Map([['field.head.dat', { offset: 4, length: head.length }], ['field.TS-time1.dat', grid]])), /a range from offset 0/u);
    await writeFile(join(directory, 'field.TS-time1.dat'), Buffer.alloc(grid.length - 4));
    await assert.rejects(loadNetcdfLonLatField(directory, kept()), /field\.TS-time1\.dat has 124 bytes, and the selected TS has 128/u);
    await assert.rejects(loadNetcdfLonLatField(directory, kept({ field: '../x.dat' })), /must be inside the source directory/u);
  } finally { await file.close(); await rm(directory, { recursive: true }); }
});

test('a grid that ends on its first longitude again is read without the repeat', async () => {
  // The LMD models' grid: -180 to 180 with both ends stored, here four steps of 90 degrees and three latitudes, north first.
  const variable = (name: string, dimensions: string[], shape: number[], units: string): NetcdfVariable => ({ name, dimensions, shape, type: 'double', attributes: { units } });
  const longitudes = [-180, -90, 0, 90, 180], latitudes = [90, 0, -90], value = (row: number, column: number) => 100 * row + (column % 4);
  const source = (repeat: number) => ({
    variables: new Map([['tsurf', variable('tsurf', ['Time', 'latitude', 'longitude'], [2, 3, 5], 'K')], ['longitude', variable('longitude', ['longitude'], [5], 'degrees_east')],
      ['latitude', variable('latitude', ['latitude'], [3], 'degrees_north')]]),
    values: async (name: string) => Float64Array.from(name === 'longitude' ? longitudes : latitudes),
    slice: async (_name: string, start: number, count: number) => {
      assert.deepEqual([start, count], [15, 15], 'only the grid at the second time is read');
      return Float64Array.from({ length: 15 }, (_, index) => index === 4 ? repeat : value(Math.floor(index / 5), index % 5));
    },
  });
  const recipe = { variable: 'tsurf', coordinates: { longitude: 'longitude', latitude: 'latitude' }, select: { Time: 1 }, sourceUnits: 'K', longitudeZeroAt: 0, coordinateToleranceDegrees: 0.005 };
  const map = await decodeNetcdfLonLatField(source(0), recipe, 'lmd.nc');
  assert.deepEqual([map.report.width, map.report.height, map.report.longitudeRange, map.report.latitudeRange], [4, 3, [-180, 90], [-90, 90]]);
  assert.equal(map.sample(0, 0), 102);
  assert.equal(map.sample(135, 90), 1.5, 'between the last kept longitude and the first, around the seam');
  assert.equal(map.sample(180, -90), 200);
  await assert.rejects(decodeNetcdfLonLatField(source(7), recipe, 'lmd.nc'), /lmd\.nc: tsurf ends on its first longitude again, and row 0 holds 0 there and 7 360 degrees on/u);
});

/** The NetCDF-4 fixture's fields (fixtures/README.md): its longitudes start at 22.5, and T and P lie on three levels. */
const netcdf4 = (overrides: Record<string, unknown> = {}) => field({ path: 'field-nc4.nc', ...overrides });
const isobar = (at: number, overrides: Record<string, unknown> = {}) => netcdf4({ variable: 'T', select: { time: 0 },
  isobar: { along: 'lev', pressure: 'P', pressureUnits: 'Pa', at, ...overrides } });

test('a NetCDF-4 file is read through the same recipe', async () => {
  const map = await loadNetcdfLonLatField(root, netcdf4());
  for (let i = 0; i < 4; i++) for (let j = 0; j < 8; j++) assert.equal(map.sample(22.5 + j * 45, -67.5 + i * 45), surface(1, i, j), `node ${i},${j}`);
  assert.deepEqual([map.report.format, map.report.width, map.report.height, map.report.longitudeRange, map.report.missing], ['netcdf-lonlat-field', 8, 4, [22.5, 337.5], 0]);
  const packed = await loadNetcdfLonLatField(root, netcdf4({ variable: 'PACKED', select: {} }));
  assert.equal(packed.sample(157.5, -22.5), 200 + 0.5 * 13);
  assert.equal(packed.sample(112.5, -22.5), null, 'the cell at the fill value has no value');
  await assert.rejects(loadNetcdfLonLatField(root, netcdf4({ variable: 'SQUEEZED', select: {} })), /variable SQUEEZED is stored chunked/u);
  await assert.rejects(loadNetcdfLonLatField(root, netcdf4({ field: 'field.TS-time1.dat' })), /field-nc4\.nc is NetCDF-4, which is kept whole/u);
});

test('a field is read at one pressure, between the two levels either side of it', async () => {
  // T[k, i, j] = 1000 - 100 k + 10 i + j at the first time, and P[k, j] = 1000 * 10^-k * (1 + j / 8) Pa: the pressure of 150 Pa
  // lies between the first two levels in the columns j < 4, on the second level exactly at j = 4, and above it beyond.
  const map = await loadNetcdfLonLatField(root, isobar(150));
  for (let i = 0; i < 4; i++) for (let j = 0; j < 8; j++) {
    const k = j < 4 ? 0 : 1, lower = 1000 * 10 ** -k * (1 + j / 8), share = Math.log(150 / lower) / Math.log(0.1);
    const expected = 1000 - 100 * k + 10 * i + j - 100 * share, value = map.sample(22.5 + j * 45, -67.5 + i * 45)!;
    assert.ok(Math.abs(value - expected) < 1e-9, `column ${i},${j}: ${value} for ${expected}`);
  }
  assert.equal(map.sample(22.5 + 4 * 45, -67.5), 904, 'on a level exactly, the value is that level\'s own');
  assert.deepEqual([map.report.select, map.report.isobar, map.report.missing], [{ time: 0 }, { along: 'lev', pressure: 'P', pressureUnits: 'Pa', at: 150, levels: 3 }, 0]);
  assert.equal((await loadNetcdfLonLatField(root, isobar(150, {}))).sample(22.5, -67.5), 1000 - 100 * Math.log(0.15) / Math.log(0.1));
  // 1200 Pa is deeper than the first level of the columns j < 2, which hold 1000 and 1125 Pa there: they have no value.
  const deep = await loadNetcdfLonLatField(root, isobar(1200));
  assert.equal(deep.report.missing, 8);
  assert.equal(deep.sample(22.5, -67.5), null, 'nothing is extrapolated below the first level');
  assert.ok(Math.abs(deep.sample(22.5 + 2 * 45, -67.5)! - (1002 - 100 * Math.log(1200 / 1250) / Math.log(0.1))) < 1e-9);
  await assert.rejects(loadNetcdfLonLatField(root, isobar(5000)), /every cell of T is a missing value/u);
});

test('an isobar the file cannot give is refused with the reason', async () => {
  await assert.rejects(loadNetcdfLonLatField(root, isobar(0)), /isobar\.at must be a pressure above zero/u);
  await assert.rejects(loadNetcdfLonLatField(root, isobar(150, { along: 'lat' })), /isobar\.along is lat, which is not a level dimension of T; it varies along time, lev, lat, lon/u);
  await assert.rejects(loadNetcdfLonLatField(root, isobar(150, { along: 'height' })), /isobar\.along is height, which is not a level dimension of T/u);
  await assert.rejects(loadNetcdfLonLatField(root, netcdf4({ variable: 'T', select: { time: 0, lev: 1 }, isobar: { along: 'lev', pressure: 'P', pressureUnits: 'Pa', at: 150 } })),
    /select names lev, which T is not selected along/u);
  await assert.rejects(loadNetcdfLonLatField(root, isobar(150, { pressure: 'PRES' })), /field-nc4\.nc has no pressure variable PRES/u);
  await assert.rejects(loadNetcdfLonLatField(root, isobar(150, { pressure: 'TS' })), /TS varies along time, lat, lon, not on the grid of T \(time, lev, lat, lon\)/u);
  await assert.rejects(loadNetcdfLonLatField(root, isobar(150, { pressureUnits: 'hPa' })), /isobar\.pressureUnits is "hPa", and the file gives P the units "Pa"/u);
  // A model's pressure can waver near its top. Away from the pressure asked for that changes nothing; a column that passes
  // it more than once has no one surface at that pressure.
  const variable = (name: string, dimensions: string[], shape: number[], units: string): NetcdfVariable => ({ name, dimensions, shape, type: 'double', attributes: { units } });
  const pressures = [100, 10, 1, 1.2, 0.9], temperatures = [500, 400, 300, 200, 100];
  const source = { variables: new Map([['T', variable('T', ['level', 'lat', 'lon'], [5, 2, 2], 'K')], ['P', variable('P', ['level', 'lat', 'lon'], [5, 2, 2], 'Pa')],
      ['lon', variable('lon', ['lon'], [2], 'degrees_east')], ['lat', variable('lat', ['lat'], [2], 'degrees_north')]]),
    values: async (name: string) => name === 'lon' ? Float64Array.of(0, 180) : name === 'lat' ? Float64Array.of(-45, 45)
      : Float64Array.from({ length: 20 }, (_, index) => (name === 'P' ? pressures : temperatures)[Math.floor(index / 4)]!),
    slice: async () => { throw new Error('an isobar reads every level'); } };
  const wavering = (at: number) => decodeNetcdfLonLatField(source, { variable: 'T', coordinates: { longitude: 'lon', latitude: 'lat' }, select: {}, isobar: { along: 'level', pressure: 'P', pressureUnits: 'Pa', at },
    sourceUnits: 'K', longitudeZeroAt: 0, coordinateToleranceDegrees: 0.005 }, 'model.nc');
  assert.equal((await wavering(10)).sample(0, 45), 400);
  assert.ok(Math.abs((await wavering(31.622776601683793)).sample(0, 45)! - 450) < 1e-9, 'halfway between two levels in the logarithm of pressure');
  await assert.rejects(wavering(1.1), /model\.nc: a column's pressure passes 1\.1 3 times along its levels, so no one surface there has that pressure/u);
});

test('the scientific raster interpreter reads the format', async () => {
  const map = await loadScienceSurface(root, { kind: 'terrestrial-scientific', id: 'surface-temperature', label: 'Surface temperature', consumer: 'fixture', units: 'K', minimum: 200, maximum: 340,
    colors: ['#000004', '#fcffa4'], ...field() });
  assert.equal(map.sample(45, 22.5), surface(1, 2, 1));
});
