import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { parsePdsRadiusTable } from '../../../../tools/objects/terrestrial-layers/obj-shape.mts';
import { simplifyRadialShape, validateClosedMesh } from '../../../../tools/objects/terrestrial-layers/radial-terrain.mts';
const root = new URL('../../../../src/planets/fornjot/source/', import.meta.url);
const read = async path => JSON.parse(await readFile(new URL(path, root), 'utf8'));

test('Fornjot preserves the selected lower-limit elongation and explicit volume scale', async () => {
  const config = await read('preparation/terrestrial.json');
  const shape = parsePdsRadiusTable(await readFile(new URL('shape/ellipsoid.tab', root), 'utf8'), config.geometry.radialTerrain.grid);
  // Independent principal-axis anchors for the authored approximation (metres).
  for (const [lon, lat, expected] of [[0,0,3108.946990339562], [180,0,3108.946990339562], [90,0,2800.8531444500554], [270,0,2800.8531444500554], [0,90,2800.8531444500554], [0,-90,2800.8531444500554]]) {
    assert.ok(Math.abs(shape.sample(lon, lat) - expected) < .001, `${lon},${lat}`);
  }
  const major = shape.sample(0,0), minor = shape.sample(90,0), polar = shape.sample(0,90);
  // Denk et al. 2018 Table 3 supplies a minimum, not a unique 3D shape.
  assert.ok(Math.abs(major/minor - 1.11) < 1e-10);
  assert.ok(Math.abs(Math.cbrt(major*minor*polar) - 2900) < .001);
  const topology = validateClosedMesh(Uint32Array.from(shape.indices.flat()), shape.positions);
  assert.equal(topology.eulerCharacteristic, 2); assert.equal(topology.components, 1);
  const faces = await simplifyRadialShape(shape, config.geometry.radialTerrain, config.geometry.radius / 2900);
  assert.equal(faces.length, 480);
  assert.equal(faces.simplification.topology.eulerCharacteristic, 2);
  // Independent analytic volume versus the physically simplified polyhedron.
  const expectedVolume = 4/3 * Math.PI * 2900 ** 3;
  assert.ok(Math.abs(faces.simplification.topology.signedVolumeCubicMeters / expectedVolume - 1) < .04);
});

test('Fornjot supplies only missing coverage to the surface preparer', async () => {
  const config = await read('preparation/terrestrial.json');
  const pixels = await sharp(new URL('material/neutral.png', root).pathname).removeAlpha().raw().toBuffer();
  assert.equal(config.raster.observations[0].validity.noData, 160);
  assert.ok(pixels.every(value => value === 160));
});


test('fornjot stays within the independent vector position guards', async () => {
  const { loadAstronomyPackage } = await import('../../../../src/platform/astronomy-package.mts');
  const { satellitePositionKm, satelliteRecord } = await loadAstronomyPackage();
  const evidence = await read('validation/orbit-checks.json'), record = satelliteRecord('fornjot');
  for (const row of evidence.runs.find(run => run.label === 'holdouts').comparisons) {
    assert.ok(row.jdTdb >= record.fitFromJdTdb && row.jdTdb <= record.fitToJdTdb);
    const actual = satellitePositionKm('fornjot', row.jdTdb), expected = row.expectedPositionKm;
    assert.ok(Math.hypot(...actual.map((v,i) => v-expected[i])) < evidence.additionalPositionGuardKm);
    assert.ok(Math.abs(Math.hypot(...actual) / Math.hypot(...expected) - 1) < .02);
  }
});


test('Fornjot preserves the source identity and honest rotation/shape interpretation', async () => {
  const evidence = await read('survey/research.json');
  const content = await read('content/object.json');
  const rotation = await read('preparation/rotation.json');
  assert.equal(evidence.identity.targetNaif, '642');
  assert.equal(evidence.identity.designation, 'S/2004 S8');
  assert.equal(evidence.identity.solution, 'SAT456');
  assert.equal(evidence.rotation.tentative, true);
  assert.equal(evidence.scale.geometricAlbedoAssumption, 0.06);
  assert.equal(content.lenses.controls[0].detail, 'Approximate shape');
  assert.match(content.lenses.controls[0].description, /assumed/);
  assert.equal(rotation.phase, 'arbitrary-display-phase');
  assert.equal(rotation.declinationDegrees, 90);
  assert.equal(content.panel.facts.find(fact => fact.id === 'rotation').value, "7 or 9.5 h · tentative");
});
