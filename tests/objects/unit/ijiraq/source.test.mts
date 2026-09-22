import {irregularSatelliteConfig, satelliteOrbitEvidence, simplifiedSatelliteReport, satelliteSurvey, satelliteContent, satelliteRotation, satelliteText} from '../irregular-satellite-fixture.mts';
import {requireFiniteNumber} from '../../../../tools/sources/source-values.mts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { parsePdsRadiusTable } from '../../../../tools/objects/terrestrial-layers/obj-shape.mts';
import { simplifyRadialShape, validateClosedMesh } from '../../../../tools/objects/terrestrial-layers/radial-terrain.mts';
const root = new URL('../../../../src/objects/ijiraq/source/', import.meta.url);
const read = async (path:string):Promise<unknown> => JSON.parse(await readFile(new URL(path, root), 'utf8'));

test('Ijiraq preserves the selected lower-limit elongation and explicit volume scale', async () => {
  const config = irregularSatelliteConfig(await read('preparation/terrestrial.json'));
  const shape = parsePdsRadiusTable(await readFile(new URL('shape/ellipsoid.tab', root), 'utf8'), config.geometry.radialTerrain.grid);
  // Independent principal-axis anchors for the authored approximation (metres).
  for (const [lon, lat, expected] of [[0,0,6736.936868842444], [180,0,6736.936868842444], [90,0,6237.904508187448], [270,0,6237.904508187448], [0,90,6237.904508187448], [0,-90,6237.904508187448]] as const) {
    assert.ok(Math.abs(requireFiniteNumber(shape.sample(lon, lat)) - expected) < .001, `${lon},${lat}`);
  }
  const major = requireFiniteNumber(shape.sample(0,0)), minor = requireFiniteNumber(shape.sample(90,0)), polar = requireFiniteNumber(shape.sample(0,90));
  // Denk et al. 2018 Table 3 supplies a minimum, not a unique 3D shape.
  assert.ok(Math.abs(major/minor - 1.08) < 1e-10);
  assert.ok(Math.abs(Math.cbrt(major*minor*polar) - 6400) < .001);
  const topology = validateClosedMesh(Uint32Array.from(shape.indices.flat()), shape.positions);
  assert.equal(topology.eulerCharacteristic, 2); assert.equal(topology.components, 1);
  const faces = await simplifyRadialShape(shape, config.geometry.radialTerrain, config.geometry.radius / 6400);
  assert.equal(faces.length, 480);
  const report = simplifiedSatelliteReport(faces.simplification);
  assert.equal(report.topology.eulerCharacteristic, 2);
  // Independent analytic volume versus the physically simplified polyhedron.
  const expectedVolume = 4/3 * Math.PI * 6400 ** 3;
  assert.ok(Math.abs(report.topology.signedVolumeCubicMeters / expectedVolume - 1) < .04);
});

test('Ijiraq supplies only missing coverage to the surface preparer', async () => {
  const config = irregularSatelliteConfig(await read('preparation/terrestrial.json'));
  const pixels = await sharp(new URL('material/neutral.png', root).pathname).removeAlpha().raw().toBuffer();
  assert.equal(config.raster.observations[0].validity.noData, 160);
  assert.ok(pixels.every(value => value === 160));
});


test('ijiraq stays within the independent vector position guards', async () => {
  const { loadAstronomyPackage } = await import('../../../../src/platform/astronomy-package.mts');
  const { satellitePositionKm, satelliteRecord } = await loadAstronomyPackage();
  const evidence = satelliteOrbitEvidence(await read('validation/orbit-checks.json')), record = satelliteRecord('ijiraq');
  const holdouts = evidence.runs.find(run => run.label === 'holdouts'); assert.ok(holdouts);
  for (const row of holdouts.comparisons) {
    assert.ok(row.jdTdb >= record.fitFromJdTdb && row.jdTdb <= record.fitToJdTdb);
    const actual = satellitePositionKm('ijiraq', row.jdTdb), expected = row.expectedPositionKm;
    assert.ok(Math.hypot(...actual.map((v,i) => v-expected[i])) < evidence.additionalPositionGuardKm);
    assert.ok(Math.abs(Math.hypot(...actual) / Math.hypot(...expected) - 1) < .02);
  }
});


test('Ijiraq preserves the source identity and honest rotation/shape interpretation', async () => {
  const evidence = satelliteSurvey(await read('survey/research.json'));
  const content = satelliteContent(await read('content/object.json'));
  const rotation = satelliteRotation(await read('preparation/rotation.json'));
  assert.equal(evidence.identity.targetNaif, '622');
  assert.equal(evidence.identity.designation, 'S/2000 S6');
  assert.equal(evidence.identity.solution, 'SAT456');
  assert.equal(evidence.rotation.tentative, false);
  assert.equal(evidence.scale.geometricAlbedoAssumption, 0.06);
  const datasetText = satelliteText(await read('../text.json')).datasets[content.lenses.controls[0].id];
  assert.equal(datasetText?.detail, 'Approximate shape');
  assert.match(datasetText?.summary ?? '', /assumed/);
  assert.equal(rotation.phase, 'arbitrary-display-phase');
  assert.equal(rotation.declinationDegrees, 90);
  const rotationFact = content.panel.facts.find(fact => fact.id === 'rotation'); assert.ok(rotationFact);
  assert.equal(rotationFact.value, "13.03 ± 0.14 h");
});
