/** The released longitude/latitude field reader against the reference library's fixture (fixtures/README.md): the grid is
 * four latitudes by eight longitudes, and every expected value is the one the fixture's definition states. */
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import test from 'node:test';
import { loadNetcdfLonLatField, loadScienceSurface } from '@cssearth/bake/objects/raster';

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

test('the scientific raster interpreter reads the format', async () => {
  const map = await loadScienceSurface(root, { kind: 'terrestrial-scientific', id: 'surface-temperature', label: 'Surface temperature', consumer: 'fixture', units: 'K', minimum: 200, maximum: 340,
    colors: ['#000004', '#fcffa4'], ...field() });
  assert.equal(map.sample(45, 22.5), surface(1, 2, 1));
});
