import {irregularSatelliteConfig, satelliteOrbitEvidence, simplifiedSatelliteReport, satelliteSurvey, satelliteContent, satelliteRotation, satelliteText} from '../irregular-satellite-fixture.mts';
import {requireFiniteNumber} from '../../../../tools/sources/source-values.mts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { parsePdsRadiusTable } from '../../../../tools/objects/terrestrial-layers/obj-shape.mts';
import { simplifyRadialShape, validateClosedMesh } from '../../../../tools/objects/terrestrial-layers/radial-terrain.mts';
const root = new URL('../../../../src/objects/bestla/source/', import.meta.url);
const read = async (path:string):Promise<unknown> => JSON.parse(await readFile(new URL(path, root), 'utf8'));

test('Bestla preserves the selected lower-limit elongation and explicit volume scale', async () => {
  const config = irregularSatelliteConfig(await read('preparation/terrestrial.json'));
  const shape = parsePdsRadiusTable(await readFile(new URL('shape/ellipsoid.tab', root), 'utf8'), config.geometry.radialTerrain.grid);
  // Independent principal-axis anchors for the authored approximation (metres).
  for (const [lon, lat, expected] of [[0,0,4266.373073534494], [180,0,4266.373073534494], [90,0,2902.294607846595], [270,0,2902.294607846595], [0,90,2902.294607846595], [0,-90,2902.294607846595]] as const) {
    assert.ok(Math.abs(requireFiniteNumber(shape.sample(lon, lat)) - expected) < .001, `${lon},${lat}`);
  }
  const major = requireFiniteNumber(shape.sample(0,0)), minor = requireFiniteNumber(shape.sample(90,0)), polar = requireFiniteNumber(shape.sample(0,90));
  // Denk et al. 2018 Table 3 supplies a minimum, not a unique 3D shape.
  assert.ok(Math.abs(major/minor - 1.47) < 1e-10);
  assert.ok(Math.abs(Math.cbrt(major*minor*polar) - 3300) < .001);
  const topology = validateClosedMesh(Uint32Array.from(shape.indices.flat()), shape.positions);
  assert.equal(topology.eulerCharacteristic, 2); assert.equal(topology.components, 1);
  const faces = await simplifyRadialShape(shape, config.geometry.radialTerrain, config.geometry.radius / 3300);
  assert.equal(faces.length, 480);
  const report = simplifiedSatelliteReport(faces.simplification);
  assert.equal(report.topology.eulerCharacteristic, 2);
  // Independent analytic volume versus the physically simplified polyhedron.
  const expectedVolume = 4/3 * Math.PI * 3300 ** 3;
  assert.ok(Math.abs(report.topology.signedVolumeCubicMeters / expectedVolume - 1) < .04);
});

test('Bestla supplies only missing coverage to the surface preparer', async () => {
  const config = irregularSatelliteConfig(await read('preparation/terrestrial.json'));
  const pixels = await sharp(new URL('material/neutral.png', root).pathname).removeAlpha().raw().toBuffer();
  assert.equal(config.raster.observations[0].validity.noData, 160);
  assert.ok(pixels.every(value => value === 160));
});


test('bestla stays within the independent vector position guards', async () => {
  const { loadAstronomyPackage } = await import('../../../../src/platform/astronomy-package.mts');
  const { satellitePositionKm, satelliteRecord } = await loadAstronomyPackage();
  const evidence = satelliteOrbitEvidence(await read('validation/orbit-checks.json')), record = satelliteRecord('bestla');
  const holdouts = evidence.runs.find(run => run.label === 'holdouts'); assert.ok(holdouts);
  for (const row of holdouts.comparisons) {
    assert.ok(row.jdTdb >= record.fitFromJdTdb && row.jdTdb <= record.fitToJdTdb);
    const actual = satellitePositionKm('bestla', row.jdTdb), expected = row.expectedPositionKm;
    assert.ok(Math.hypot(...actual.map((v,i) => v-expected[i])) < evidence.additionalPositionGuardKm);
    assert.ok(Math.abs(Math.hypot(...actual) / Math.hypot(...expected) - 1) < .02);
  }
});


test('Bestla preserves the source identity and honest rotation/shape interpretation', async () => {
  const evidence = satelliteSurvey(await read('survey/research.json'));
  const content = satelliteContent(await read('content/object.json'));
  const rotation = satelliteRotation(await read('preparation/rotation.json'));
  assert.equal(evidence.identity.targetNaif, '639');
  assert.equal(evidence.identity.designation, 'S/2004 S18');
  assert.equal(evidence.identity.solution, 'SAT456');
  assert.equal(evidence.rotation.tentative, false);
  assert.equal(evidence.scale.geometricAlbedoAssumption, 0.06);
  const datasetText = satelliteText(await read('../text.json')).datasets[content.lenses.controls[0].id];
  assert.equal(datasetText?.detail, 'Approximate shape');
  assert.match(datasetText?.summary ?? '', /assumed/);
  assert.equal(rotation.phase, 'arbitrary-display-phase');
  assert.equal(rotation.declinationDegrees, -66.560708889);
  const rotationFact = content.panel.facts.find(fact => fact.id === 'rotation'); assert.ok(rotationFact);
  assert.equal(rotationFact.value, "14.6238 ± 0.0001 h");
});
