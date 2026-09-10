import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createSourceManifest} from '../../../src/platform/source-manifest.mts';
import {validateClosedMesh} from '../../../tools/objects/terrestrial-layers/radial-terrain.mts';

const projectRoot = resolve(import.meta.dirname, '../../..');
const near = (actual, expected, label, relativeTolerance = 1e-10) => {
  assert.ok(Number.isFinite(actual) && Number.isFinite(expected), `${label}: finite numbers required`);
  assert.ok(Math.abs(actual - expected) <= Math.max(1e-12, Math.abs(expected) * relativeTolerance),
    `${label}: ${actual} differs from independently expected ${expected}`);
};
const dot = (a, b) => a.reduce((sum, value, axis) => sum + value * b[axis], 0);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

// Deliberately parse and integrate the original counted table independently of
// loadPdsPlateShape, so a shared loader/scale mistake cannot satisfy this check.
function inspectOriginalShape(text) {
  const rows = text.trim().split(/\r?\n/).filter(row => row.trim()).map(row => row.trim().split(/\s+/).map(Number));
  const [vertexCount, faceCount] = rows[0];
  assert.ok(Number.isInteger(vertexCount) && vertexCount >= 4);
  assert.ok(Number.isInteger(faceCount) && faceCount >= 4);
  assert.equal(rows.length, 1 + vertexCount + faceCount, 'Original table row counts');
  const vertices = rows.slice(1, vertexCount + 1);
  const faces = rows.slice(vertexCount + 1);
  for (const vertex of vertices) assert.ok(vertex.length === 3 && vertex.every(Number.isFinite));
  const edges = new Map(), directed = new Set(), adjacent = Array.from({length: vertexCount}, () => new Set());
  let signedVolume = 0;
  for (const face of faces) {
    assert.ok(face.length === 3 && new Set(face).size === 3);
    assert.ok(face.every(index => Number.isInteger(index) && index >= 1 && index <= vertexCount));
    const [a, b, c] = face.map(index => vertices[index - 1]);
    const ab = b.map((value, axis) => value - a[axis]);
    const ac = c.map((value, axis) => value - a[axis]);
    assert.ok(Math.hypot(...cross(ab, ac)) > 0, 'Original facet has nonzero area');
    signedVolume += dot(a, cross(b, c)) / 6;
    for (let corner = 0; corner < 3; corner++) {
      const a = face[corner] - 1, b = face[(corner + 1) % 3] - 1;
      const oriented = `${a}:${b}`, edge = a < b ? `${a}:${b}` : `${b}:${a}`;
      assert.ok(!directed.has(oriented), 'Original shared-edge winding is consistent');
      directed.add(oriented);
      edges.set(edge, (edges.get(edge) ?? 0) + 1);
      adjacent[a].add(b); adjacent[b].add(a);
    }
  }
  assert.ok([...edges.values()].every(count => count === 2), 'Original surface is closed and manifold');
  for (const edge of directed) {
    const [a, b] = edge.split(':');
    assert.ok(directed.has(`${b}:${a}`), 'Original edges have reversed pairs');
  }
  const reached = new Set([0]), pending = [0];
  while (pending.length) for (const vertex of adjacent[pending.pop()]) {
    if (!reached.has(vertex)) { reached.add(vertex); pending.push(vertex); }
  }
  assert.equal(reached.size, vertexCount, 'Original surface has one connected component and no unused vertices');
  assert.equal(vertexCount - edges.size + faceCount, 2, 'Original surface has spherical topology');
  assert.ok(signedVolume > 0, 'Original surface has positive signed volume');
  return {vertices, faces, signedVolume};
}

/**
 * independentExpected contains literal anchors from the original intake, never
 * values read from the generated package. expected.rotation can explicitly
 * replace the normal observed-pole checks for a separately qualified exception.
 */
export async function assertCalibratedAsteroidSource(id, independentExpected) {
  const expected = independentExpected;
  const directory = resolve(projectRoot, 'src/planets', id), sourceRoot = resolve(directory, 'source');
  const read = async path => JSON.parse(await readFile(resolve(directory, path), 'utf8'));
  const source = await createSourceManifest({planetId: id, planetName: expected.name ?? id, sourceRoot});
  await source.verify();
  const [config, calibration, model, properties, rotation, acquisition, content] = await Promise.all([
    'preparation/terrestrial.json', 'reference/calibration.json', 'reference/damit-model.json',
    'reference/model-properties.json', 'preparation/rotation.json', 'preparation/acquisition.json', 'content/object.json',
  ].map(path => read(`source/${path}`)));
  const radial = config.geometry.radialTerrain;
  assert.equal(radial.format, 'pds-plate-model');
  assert.equal(radial.grid.indexBase, 1);
  for (const input of source.manifest.inputs) {
    assert.ok(acquisition.operations.some(operation => operation.path === input.path), `${input.path}: restorable original input`);
  }
  const input = source.manifest.inputs.find(entry => entry.path === radial.path);
  assert.ok(input, 'Shape is a declared original source input');
  const bytes = await readFile(resolve(sourceRoot, radial.path));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), expected.shapeSha256, 'Original shape bytes are unchanged');
  assert.equal(input.expectedSha256, expected.shapeSha256);
  const original = inspectOriginalShape(bytes.toString('utf8'));
  assert.equal(original.vertices.length, expected.vertices);
  assert.equal(original.faces.length, expected.faces);
  assert.deepEqual(original.vertices[0], expected.firstVertex, 'Independent original-coordinate anchor');
  assert.deepEqual(original.faces[0], expected.firstFace, 'Independent original-connectivity anchor');
  near(original.signedVolume, expected.signedVolume, 'Original signed volume');
  assert.equal(radial.grid.expectedVertices, expected.vertices);
  assert.equal(radial.grid.expectedFaces, expected.faces);
  assert.equal(model.modelId, expected.modelId);
  if (expected.modelVersion !== undefined) assert.equal(model.modelVersion ?? model.version ?? model.sourceFields?.Version, expected.modelVersion);
  assert.equal(calibration.diameterKm, expected.diameterKm);
  if (expected.uncertaintyKm !== undefined) assert.equal(calibration.uncertaintyKm, expected.uncertaintyKm);
  const sourceDiameter = Math.cbrt(6 * original.signedVolume / Math.PI);
  const independentlyScaledDiameterKm = sourceDiameter * radial.grid.metersPerUnit / 1000;
  near(independentlyScaledDiameterKm, expected.diameterKm, 'Raw mesh physical diameter', 1e-8);
  near(calibration.scaleKmPerSourceUnit * 1000, radial.grid.metersPerUnit, 'Calibration versus executing grid');
  near(config.geometry.radiusKm * 2, expected.diameterKm, 'Display reference diameter');
  near(properties.shape.volumeCubicKm, original.signedVolume * (radial.grid.metersPerUnit / 1000) ** 3, 'Physical source volume');
  original.vertices[0].forEach((value, axis) => near(properties.shape.firstVertexKm[axis], value * radial.grid.metersPerUnit / 1000, 'Prepared physical coordinate anchor'));
  assert.deepEqual(properties.shape.firstFaceZeroBased, expected.firstFace.map(index => index - 1));
  const science = config.raster.scientific.find(lens => lens.id === 'elevation');
  assert.ok(science, 'Source-derived radius lens is present');
  assert.equal(science.path, radial.path);
  assert.equal(science.format, radial.format);
  assert.deepEqual(science.grid, radial.grid, 'Geometry and radius values use the same physical source grid');
  assert.equal(science.valueTransform.scale, 0.001, 'Radius metres become kilometres');
  near(science.valueTransform.offset, -expected.diameterKm / 2, 'Radius-minus-reference-sphere datum');
  near(science.relief.referenceRadiusMeters, expected.diameterKm * 500, 'Relief shares the datum');
  assert.equal(science.relief.heightToMeters, 1000);
  assert.equal(science.surfaceSampling.method, 'closest-source-point');
  assert.equal(input.projection.metersPerUnit, radial.grid.metersPerUnit);
  near(input.projection.referenceRadiusMeters, expected.diameterKm * 500, 'Source projection shares the datum');
  if (expected.rotation) {
    for (const [key, value] of Object.entries(expected.rotation)) assert.deepEqual(rotation[key], value, `Qualified rotation exception: ${key}`);
  } else {
    assert.equal(rotation.schema, 'cssearth-observed-pole@1');
    assert.equal(rotation.phase, 'arbitrary-display-phase');
    assert.equal(rotation.displayMeridianDegrees, 0);
    assert.equal(rotation.periodHours, expected.periodHours);
    assert.deepEqual(properties.poleEclipticJ2000Degrees, [expected.lambda, expected.beta]);
    const rad = Math.PI / 180, lambda = expected.lambda * rad, beta = expected.beta * rad, obliquity = 23.439291111 * rad;
    const equatorial = [Math.cos(beta) * Math.cos(lambda), Math.cos(beta) * Math.sin(lambda) * Math.cos(obliquity) - Math.sin(beta) * Math.sin(obliquity), Math.cos(beta) * Math.sin(lambda) * Math.sin(obliquity) + Math.sin(beta) * Math.cos(obliquity)];
    near(rotation.rightAscensionDegrees, Math.atan2(equatorial[1], equatorial[0]) / rad, 'Published pole right ascension');
    near(rotation.declinationDegrees, Math.asin(equatorial[2]) / rad, 'Published pole declination');
  }
  assert.equal(content.settings.controls.find(control => control.name === 'shadows')?.checked, false, 'Shadows default off');
  const [terrain, scene] = await Promise.all(['prepared/terrain.json', 'prepared/scene.json'].map(read));
  assert.deepEqual(terrain.source.grid, radial.grid, 'Prepared terrain preserves the physical source grid');
  assert.ok(terrain.faces.length > 0 && terrain.faces.length <= 800, 'Prepared face budget');
  assert.equal(scene.bodyLeaves.length, terrain.faces.length);
  assert.equal(terrain.simplification.sourceFaces, expected.faces);
  assert.equal(terrain.simplification.method, 'source-meshoptimizer');
  assert.ok(terrain.simplification.estimatedErrorMeters <= radial.simplification.maximumErrorMeters, 'Configured simplification error bound');
  const positions = [], lookup = new Map(), indices = [];
  for (const [index, face] of terrain.faces.entries()) {
    const leaf = scene.bodyLeaves[index];
    assert.equal(leaf.tag, 'u');
    assert.equal(leaf.attributes['data-polycss-texture-leaf-sizing'], 'raster');
    assert.equal(leaf.projectiveTextureLayer, undefined);
    assert.ok(leaf.style.includes('--polycss-atlas-width:128px'));
    for (const vertex of face.vertices) {
      const key = vertex.join(',');
      if (!lookup.has(key)) { lookup.set(key, positions.length); positions.push(vertex); }
      indices.push(lookup.get(key));
    }
  }
  const topology = validateClosedMesh(indices, positions);
  assert.equal(topology.components, 1);
  assert.equal(topology.eulerCharacteristic, 2);
}
