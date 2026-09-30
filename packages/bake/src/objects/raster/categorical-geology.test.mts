import { required, fixtureRecord } from '@cssearth/objects/node/contract';
import { requireArray, requireString } from '@cssearth/core';
import { parseGeologyDataset, loadGeologySurface, createGeologySampler, categoryColorForValue, validateGeologyProfile, decodeGeologyAttributes, decodeGeologyPolygons } from '@cssearth/bake/objects/raster';
import assert from 'node:assert/strict';
import { sourceTest } from '@cssearth/objects/node/source-test';
const test = sourceTest();
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../../../../../src/objects/', import.meta.url));
const rectangle = (west: number, south: number, east: number, north: number) => [[west, south], [east, south], [east, north], [west, north], [west, south]];
const polygon = (category: number|null, rings: number[][][]) => ({category, rings, south: Math.min(...rings.flat().map(point => point[1])), north: Math.max(...rings.flat().map(point => point[1]))});
const body = async (id: string) => {
  const source = `${root}${id}/source`;
  const recipe = JSON.parse(await readFile(`${source}/preparation/raster.json`, 'utf8'));
  const surface = fixtureRecord(required(requireArray(recipe.surfaces).find(value => fixtureRecord(value).id === 'geology')));
  const {kind: _kind, ...science} = fixtureRecord(surface.science);
  const dataset = parseGeologyDataset({id: surface.id, ...science});
  return {source, dataset, surface: await loadGeologySurface(source, dataset)};
};

test('polygon sampling preserves holes, seam-split regions and categorical overlaps', () => {
  const sampler = createGeologySampler([
    polygon(0, [rectangle(-10, -10, 10, 10), rectangle(-2, -2, 2, 2)]),
    polygon(1, [rectangle(170, -10, 180, 10), rectangle(-180, -10, -170, 10)]),
    polygon(2, [rectangle(5, 5, 15, 15)]),
    polygon(null, [rectangle(-8, -8, -6, -6)]),
  ]);
  assert.equal(sampler.sample(0, 0), null, 'Polygon hole remains missing');
  assert.equal(sampler.sample(0, 8), 0);
  assert.equal(sampler.sample(7, 7), null, 'Conflicting units remain unknown');
  assert.equal(sampler.sample(12, 12), 2);
  assert.equal(sampler.sample(353, -7), null, 'Declared unknown overrides a unit');
  assert.equal(sampler.sample(179, 0), 1);
  assert.equal(sampler.sample(181, 0), 1);
  assert.equal(sampler.sample(-179, 0), 1);
  assert.equal(sampler.sample(90, 0), null, 'No fictitious global seam bridge');
  assert.equal(sampler.sample(0, 90), null);
});

test('discrete colors reject fractional and unknown category indices', () => {
  const dataset = {categories: [{color: '#123456'}, {color: '#abcdef'}]};
  assert.deepEqual(categoryColorForValue(0, dataset), [18, 52, 86]);
  assert.throws(() => categoryColorForValue(0.5, dataset), /Invalid/);
  assert.throws(() => categoryColorForValue(2, dataset), /Invalid/);
});

for (const id of ['io', 'ganymede']) test(`${id} archived geography, attribute identity and source pins remain intact`, async () => {
  const {source, dataset, surface} = await body(id);
  const directory = dataset.path.slice(0, dataset.path.lastIndexOf('/'));
  const receipts = JSON.parse(await readFile(`${source}/${directory}/intake-downloads.json`, 'utf8'));
  for (const receipt of receipts) {
    const bytes = await readFile(`${source}/${receipt.path}`);
    assert.ok(bytes.length > 0, receipt.path);
  }
  assert.equal(surface.report.records, id === 'io' ? 1502 : 3046);
  // Ganymede reads the authors' UNITNAME field, which keeps the three palimpsest classes the older Unit field merged.
  assert.equal(Object.keys(surface.report.counts).length, id === 'io' ? 15 : 25);
  assert.equal(surface.sample(0, 90), null);
  assert.equal(surface.sample(0, id === 'io' ? -89.5 : 89.9), null, 'Source polar gaps are preserved');
  for (const delta of [{sampling: 'bilinear'}, {relief: {referenceRadiusMeters: 1}}, {valueTransform: {scale: 1, offset: 0}}]) {
    assert.throws(() => validateGeologyProfile({...dataset, ...delta}), /Invalid/);
  }
  const drifted = structuredClone(dataset); drifted.grid.coordinateSystem = 'GCS_Other_2000';
  await assert.rejects(loadGeologySurface(source, drifted), /projection differs/);
  const incomplete = structuredClone(dataset); incomplete.categories.pop();
  await assert.rejects(loadGeologySurface(source, incomplete), /Unmapped geology symbol/);
});

test('Io label-point longitude is west while the same archived SHP coordinate is east', async () => {
  const {source, dataset, surface} = await body('io');
  const stem = `${source}/science/geology-sim3168/Io_GeoUnitsPoints`;
  const points = await readFile(`${stem}.shp`), {rows} = decodeGeologyAttributes(await readFile(`${stem}.dbf`));
  let offset = 100;
  for (const row of rows) {
    const x = points.readDoubleLE(offset + 12), y = points.readDoubleLE(offset + 20);
    if (required(row).Long_W) {
      const east = ((-Number(required(row).Long_W) + 180) % 360 + 360) % 360 - 180;
      assert.ok(Math.abs(east - x) < 1e-8);
      assert.ok(Math.abs(Number(required(row).Lat) - y) < 1e-8);
    }
    offset += 8 + points.readInt32BE(offset + 4) * 2;
  }
  assert.equal(dataset.categories[required(surface.sample(-97.14483174681664, -88.55184526182711))].value, 'Mu');
  assert.equal(dataset.categories[required(surface.sample(27.976930180564523, -83.46270116232336))].value, 'Fb');
});

test('Ganymede excludes only the declared zero-area ring, retaining its valid multipart polygon', async () => {
  const {source, dataset} = await body('ganymede'), bytes = await readFile(`${source}/${dataset.path}`);
  const polygons = decodeGeologyPolygons(bytes, dataset.grid);
  assert.equal(required(polygons[3022]).rings.length, 90);
  assert.throws(() => decodeGeologyPolygons(bytes, {...dataset.grid, withheldDegenerateRings: []}), /Unclosed/);
  assert.throws(() => decodeGeologyPolygons(bytes, {...dataset.grid, expectedRecords: 3045}), /population/);
  assert.throws(() => decodeGeologyPolygons(bytes.subarray(0, bytes.length - 1), dataset.grid), /header/);
  const invalid = structuredClone(dataset.grid); invalid.withheldDegenerateRings[0].point[0] += 0.1;
  assert.throws(() => decodeGeologyPolygons(bytes, invalid), /degenerate geology ring changed/);
});
