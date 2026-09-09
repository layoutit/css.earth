import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { parsePdsRadiusTable } from '../../../../tools/objects/terrestrial-layers/obj-shape.mjs';
import { simplifyRadialShape, validateClosedMesh } from '../../../../tools/objects/terrestrial-layers/radial-terrain.mjs';
const root = new URL('../../../../src/planets/albiorix/source/', import.meta.url);
const read = async path => JSON.parse(await readFile(new URL(path, root), 'utf8'));

test('Albiorix preserves the selected lower-limit elongation and explicit volume scale', async () => {
  const config = await read('preparation/terrestrial.json');
  const shape = parsePdsRadiusTable(await readFile(new URL('shape/ellipsoid.tab', root), 'utf8'), config.geometry.radialTerrain.grid);
  // Independent principal-axis anchors for the authored approximation (metres).
  for (const [lon, lat, expected] of [[0,0,17380.912359304763], [180,0,17380.912359304763], [90,0,12970.83011888415], [270,0,12970.83011888415], [0,90,12970.83011888415], [0,-90,12970.83011888415]]) {
    assert.ok(Math.abs(shape.sample(lon, lat) - expected) < .001, `${lon},${lat}`);
  }
  const major = shape.sample(0,0), minor = shape.sample(90,0), polar = shape.sample(0,90);
  // Denk et al. 2018 Table 3 supplies a minimum, not a unique 3D shape.
  assert.ok(Math.abs(major/minor - 1.34) < 1e-10);
  assert.ok(Math.abs(Math.cbrt(major*minor*polar) - 14300) < .001);
  const topology = validateClosedMesh(Uint32Array.from(shape.indices.flat()), shape.positions);
  assert.equal(topology.eulerCharacteristic, 2); assert.equal(topology.components, 1);
  const faces = await simplifyRadialShape(shape, config.geometry.radialTerrain, config.geometry.radius / 14300);
  assert.equal(faces.length, 480);
  assert.equal(faces.simplification.topology.eulerCharacteristic, 2);
  // Independent analytic volume versus the physically simplified polyhedron.
  const expectedVolume = 4/3 * Math.PI * 14300 ** 3;
  assert.ok(Math.abs(faces.simplification.topology.signedVolumeCubicMeters / expectedVolume - 1) < .04);
});

test('Albiorix supplies only missing coverage to the surface preparer', async () => {
  const config = await read('preparation/terrestrial.json');
  const pixels = await sharp(new URL('material/neutral.png', root).pathname).removeAlpha().raw().toBuffer();
  assert.equal(config.raster.observations[0].validity.noData, 160);
  assert.ok(pixels.every(value => value === 160));
});


test('albiorix stays within the independent vector position guards', async () => {
  const { loadAstronomyPackage } = await import('../../../../src/platform/astronomy-package.mjs');
  const { satellitePositionKm, satelliteRecord } = await loadAstronomyPackage();
  const evidence = await read('validation/orbit-checks.json'), record = satelliteRecord('albiorix');
  for (const row of evidence.runs.find(run => run.label === 'holdouts').comparisons) {
    assert.ok(row.jdTdb >= record.fitFromJdTdb && row.jdTdb <= record.fitToJdTdb);
    const actual = satellitePositionKm('albiorix', row.jdTdb), expected = row.expectedPositionKm;
    assert.ok(Math.hypot(...actual.map((v,i) => v-expected[i])) < evidence.additionalPositionGuardKm);
    assert.ok(Math.abs(Math.hypot(...actual) / Math.hypot(...expected) - 1) < .02);
  }
});
