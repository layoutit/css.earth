import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { parseLonLatSliceTable } from '@cssearth/bake/objects/raster';
import { sourceTest } from '@cssearth/objects/node/source-test';
import { requireRecord } from '@cssearth/core';
import { deriveObjectDiscovery } from '../../../site/build/prepare/prepare-object-discovery.mts';
import { parseObjectDiscovery, discoveryDescription } from '@cssearth/objects';

const specification = { columns: { longitude: 2, latitude: 3, value: 5 }, slice: { column: 4, value: 0.1 }, coordinateToleranceDegrees: 0 };
const rows = [-135, -45, 45, 135].flatMap(lon => [-60, 0, 60].flatMap(lat => [0.1, 1].map(p => [1, lon, lat, p, 1000 + lon + lat + 100 * p].join(','))));
const text = rows.join('\n');

test('the climate simulation is never advertised as observed imagery', async () => {
  const read = async (path: string) => requireRecord(JSON.parse(await readFile(new URL(`../../../src/objects/wasp-103b/${path}`, import.meta.url), 'utf8')));
  const descriptor = await read('object.json'), content = await read('source/content/object.json');
  const discovery = deriveObjectDiscovery(requireRecord(descriptor.properties).catalog, content, [await read('source/preparation/raster.json')]);
  assert.equal(discovery.imagery, false);
  assert.equal(discovery.illustration, true);
  assert.equal(discovery.simulation, true);
  assert.equal(discoveryDescription(parseObjectDiscovery(discovery)), 'Simulation');
  assert.throws(() => parseObjectDiscovery({ ...discovery, illustration: false }), /qualified model/);
});

test('numeric slices keep native values, interpolate in geographic coordinates and wrap only longitude', () => {
  const map = parseLonLatSliceTable(text, specification);
  assert.equal(map.sample(45, 60), 1115);
  assert.equal(map.sample(0, 30), 1040);
  assert.equal(map.sample(180, 0), 1010);
  assert.equal(map.sample(-180, 0), map.sample(540, 0));
  assert.equal(map.sample(45, 61), null, 'no synthetic polar continuation');
  assert.equal(map.sample(NaN, 0), null);
  assert.equal(parseLonLatSliceTable([...rows].reverse().join('\n'), specification).sample(0, 30), 1040);
  assert.equal(parseLonLatSliceTable(text, { ...specification, slice: { column: 4, value: 1 } }).sample(0, 30), 1130);
});

test('an absent level, duplicate, missing cell, nonnumeric value or nonperiodic grid is refused', () => {
  assert.throws(() => parseLonLatSliceTable(text, { ...specification, slice: { column: 4, value: 0.2 } }), /does not contain/u);
  assert.throws(() => parseLonLatSliceTable(`${text}\n${rows[0]}`, specification), /Duplicate/u);
  assert.throws(() => parseLonLatSliceTable(rows.slice(1).join('\n'), specification), /missing grid cells/u);
  assert.throws(() => parseLonLatSliceTable(text.replace('815', 'NaN'), specification), /Invalid numeric/u);
  assert.throws(() => parseLonLatSliceTable(rows.filter(r => !r.startsWith('1,135,')).join('\n'), specification), /periodic/u);
});

sourceTest('wasp-103b')('the released GCM slice matches the independent temperature anchors in Kreidberg 2018 section 6', async () => {
  const text = await readFile(new URL('../../../src/objects/wasp-103b/source/science/kreidberg-2018/pressure-temperature.dat', import.meta.url), 'utf8');
  const map = parseLonLatSliceTable(text, { ...specification, slice: { column: 4, value: 0.11542 }, coordinateToleranceDegrees: 0.005 });
  assert.equal(map.report.width, 64);
  assert.equal(map.report.height, 30);
  // Paper section 6: 920--3360 K at approximately 0.1 bar; section 6.1: 3359 K at 0.11 bar.
  assert.ok(Math.abs(map.report.minimum - 920) < 5);
  assert.ok(Math.abs(map.report.maximum - 3360) < 2);
  assert.ok(Math.abs(map.sample(0, 0)! - 3359) < 2);
  assert.equal(map.sample(-177.19, -81.562), 1376.6);
  assert.equal(map.sample(0, 90), null);
  const native = text.trim().split(/\n/u).filter(line => line.trim()).map(line => line.split(',').map(Number)).filter(row => row[3] === 0.11542);
  for (const row of native) assert.ok(Math.abs(map.sample(row[1]!, row[2]!)! - row[4]!) < 1e-8, `native node ${row[1]}, ${row[2]}`);
});
