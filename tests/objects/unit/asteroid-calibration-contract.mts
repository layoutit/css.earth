import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createSourceManifest} from '../../../src/platform/source-manifest.mts';
import {readJsonSource, requireArray, requireFiniteNumber, requireRecord, requireString} from '../../../tools/sources/source-values.mts';
import {validateClosedMesh} from '../../../tools/objects/terrestrial-layers/radial-terrain.mts';

const projectRoot = resolve(import.meta.dirname, '../../..');
type Coordinates = readonly number[];
interface CalibrationExpectation {
  readonly name?: string;
  readonly modelId: number;
  readonly modelVersion?: string;
  readonly vertices: number;
  readonly faces: number;
  readonly firstVertex: Coordinates;
  readonly firstFace: Coordinates;
  readonly signedVolume: number;
  readonly diameterKm: number;
  readonly uncertaintyKm?: number | null;
  readonly lambda?: number;
  readonly beta?: number;
  readonly periodHours?: number;
  readonly rotation?: Readonly<Record<string, unknown>>;
}

const near = (actual: number, expected: number, label: string, relativeTolerance = 1e-10): void => {
  assert.ok(Number.isFinite(actual) && Number.isFinite(expected), `${label}: finite numbers required`);
  assert.ok(Math.abs(actual - expected) <= Math.max(1e-12, Math.abs(expected) * relativeTolerance),
    `${label}: ${actual} differs from independently expected ${expected}`);
};
const dot = (a: Coordinates, b: Coordinates): number => a.reduce((sum, value, axis) => sum + value * b[axis], 0);
const cross = (a: Coordinates, b: Coordinates): number[] => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const recordAt = (value: Record<string, unknown>, key: string, label: string): Record<string, unknown> => requireRecord(value[key], label);
const arrayAt = (value: Record<string, unknown>, key: string, label: string): unknown[] => requireArray(value[key], label);
const numberAt = (value: Record<string, unknown>, key: string, label: string): number => requireFiniteNumber(value[key], label);
const numberVector = (value: unknown, label: string): number[] => requireArray(value, label).map((entry, index) => requireFiniteNumber(entry, `${label}[${index}]`));

// Deliberately parse and integrate the original counted table independently of
// loadPdsPlateShape, so a shared loader/scale mistake cannot satisfy this check.
function inspectOriginalShape(text: string): {vertices: number[][]; faces: number[][]; signedVolume: number} {
  const rows = text.trim().split(/\r?\n/).filter(row => row.trim()).map(row => row.trim().split(/\s+/).map(Number));
  const [vertexCount, faceCount] = rows[0];
  assert.ok(Number.isInteger(vertexCount) && vertexCount >= 4);
  assert.ok(Number.isInteger(faceCount) && faceCount >= 4);
  assert.equal(rows.length, 1 + vertexCount + faceCount, 'Original table row counts');
  const vertices = rows.slice(1, vertexCount + 1);
  const faces = rows.slice(vertexCount + 1);
  for (const vertex of vertices) assert.ok(vertex.length === 3 && vertex.every(Number.isFinite));
  const edges = new Map<string, number>(), directed = new Set<string>(), adjacent = Array.from({length: vertexCount}, () => new Set<number>());
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
  while (pending.length) for (const vertex of adjacent[pending.pop()!]) {
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
export async function assertCalibratedAsteroidSource(id: string, independentExpected: CalibrationExpectation): Promise<void> {
  const expected = independentExpected;
  const directory = resolve(projectRoot, 'src/objects', id), sourceRoot = resolve(directory, 'source');
  const read = async (path: string): Promise<Record<string, unknown>> => requireRecord(
    await readJsonSource(resolve(directory, path)), `${id} ${path}`,
  );
  const source = await createSourceManifest({objectId: id, objectName: expected.name ?? id, sourceRoot});
  await source.verify();
  const [config, calibration, model, properties, rotation, acquisition, content, sourceManifest] = await Promise.all([
    'preparation/terrestrial.json', 'reference/calibration.json', 'reference/damit-model.json',
    'reference/model-properties.json', 'preparation/rotation.json', 'preparation/acquisition.json', 'content/object.json', 'manifest.json',
  ].map(path => read(`source/${path}`)));
  const radial = recordAt(recordAt(config, 'geometry', 'terrestrial geometry'), 'radialTerrain', 'radial terrain');
  assert.equal(radial.format, 'pds-plate-model');
  const radialGrid = recordAt(radial, 'grid', 'radial grid');
  assert.equal(radialGrid.indexBase, 1);
  const operations = arrayAt(acquisition, 'operations', 'acquisition operations').map(
    (operation, index) => requireRecord(operation, `acquisition operation ${index}`),
  );
  for (const input of source.manifest.inputs) {
    assert.ok(operations.some(operation => operation.path === input.path), `${input.path}: restorable original input`);
  }
  const radialPath = requireString(radial.path, 'Radial source path');
  const input = source.manifest.inputs.find(entry => entry.path === radialPath);
  assert.ok(input, 'Shape is a declared original source input');
  const bytes = await readFile(resolve(sourceRoot, radialPath));
  const original = inspectOriginalShape(bytes.toString('utf8'));
  assert.equal(original.vertices.length, expected.vertices);
  assert.equal(original.faces.length, expected.faces);
  assert.deepEqual(original.vertices[0], expected.firstVertex, 'Independent original-coordinate anchor');
  assert.deepEqual(original.faces[0], expected.firstFace, 'Independent original-connectivity anchor');
  near(original.signedVolume, expected.signedVolume, 'Original signed volume');
  assert.equal(radialGrid.expectedVertices, expected.vertices);
  assert.equal(radialGrid.expectedFaces, expected.faces);
  assert.equal(model.modelId, expected.modelId);
  if (expected.modelVersion !== undefined) {
    const sourceFields = model.sourceFields === undefined ? undefined : requireRecord(model.sourceFields, 'model source fields');
    assert.equal(model.modelVersion ?? model.version ?? sourceFields?.Version, expected.modelVersion);
  }
  assert.equal(calibration.diameterKm, expected.diameterKm);
  if (expected.uncertaintyKm !== undefined) assert.equal(calibration.uncertaintyKm, expected.uncertaintyKm);
  const sourceDiameter = Math.cbrt(6 * original.signedVolume / Math.PI);
  const metersPerUnit = numberAt(radialGrid, 'metersPerUnit', 'radial grid metres per unit');
  const independentlyScaledDiameterKm = sourceDiameter * metersPerUnit / 1000;
  near(independentlyScaledDiameterKm, expected.diameterKm, 'Raw mesh physical diameter', 1e-8);
  near(numberAt(calibration, 'scaleKmPerSourceUnit', 'calibration scale') * 1000, metersPerUnit, 'Calibration versus executing grid');
  near(numberAt(recordAt(config, 'geometry', 'terrestrial geometry'), 'radiusKm', 'display radius') * 2, expected.diameterKm, 'Display reference diameter');
  const shape = recordAt(properties, 'shape', 'model shape');
  near(numberAt(shape, 'volumeCubicKm', 'shape volume'), original.signedVolume * (metersPerUnit / 1000) ** 3, 'Physical source volume');
  const preparedFirstVertex = numberVector(shape.firstVertexKm, 'prepared first vertex');
  original.vertices[0].forEach((value, axis) => near(preparedFirstVertex[axis], value * metersPerUnit / 1000, 'Prepared physical coordinate anchor'));
  assert.deepEqual(shape.firstFaceZeroBased, expected.firstFace.map(index => index - 1));
  const science = arrayAt(recordAt(config, 'raster', 'terrestrial raster'), 'scientific', 'scientific lenses')
    .map((lens, index) => requireRecord(lens, `scientific lens ${index}`))
    .find(lens => lens.id === 'elevation');
  assert.ok(science, 'Source-derived radius lens is present');
  const scientificLens = science;
  assert.equal(scientificLens.path, radial.path);
  assert.equal(scientificLens.format, radial.format);
  assert.deepEqual(scientificLens.grid, radialGrid, 'Geometry and radius values use the same physical source grid');
  const valueTransform = recordAt(scientificLens, 'valueTransform', 'scientific value transform');
  assert.equal(valueTransform.scale, 0.001, 'Radius metres become kilometres');
  near(numberAt(valueTransform, 'offset', 'scientific datum'), -expected.diameterKm / 2, 'Radius-minus-reference-sphere datum');
  const relief = recordAt(scientificLens, 'relief', 'scientific relief');
  near(numberAt(relief, 'referenceRadiusMeters', 'relief datum'), expected.diameterKm * 500, 'Relief shares the datum');
  assert.equal(relief.heightToMeters, 1000);
  assert.equal(recordAt(scientificLens, 'surfaceSampling', 'surface sampling').method, 'closest-source-point');
  const manifestInput = arrayAt(sourceManifest, 'inputs', 'source manifest inputs')
    .map((entry, index) => requireRecord(entry, `source manifest input ${index}`))
    .find(entry => entry.path === radialPath);
  assert.ok(manifestInput, 'Radial source projection is declared');
  const projection = recordAt(manifestInput, 'projection', 'source projection');
  assert.equal(projection.metersPerUnit, metersPerUnit);
  near(numberAt(projection, 'referenceRadiusMeters', 'source projection datum'), expected.diameterKm * 500, 'Source projection shares the datum');
  if (expected.rotation) {
    for (const [key, value] of Object.entries(expected.rotation)) assert.deepEqual(rotation[key], value, `Qualified rotation exception: ${key}`);
  } else {
    assert.equal(rotation.schema, 'cssearth-observed-pole@1');
    assert.equal(rotation.phase, 'arbitrary-display-phase');
    assert.equal(rotation.displayMeridianDegrees, 0);
    assert.equal(rotation.periodHours, expected.periodHours);
    assert.deepEqual(properties.poleEclipticJ2000Degrees, [expected.lambda, expected.beta]);
    const lambdaDegrees = expected.lambda, betaDegrees = expected.beta;
    assert.ok(lambdaDegrees !== undefined && betaDegrees !== undefined && expected.periodHours !== undefined, 'Observed-pole anchors are required');
    const rad = Math.PI / 180, lambda = lambdaDegrees * rad, beta = betaDegrees * rad, obliquity = 23.439291111 * rad;
    const equatorial = [Math.cos(beta) * Math.cos(lambda), Math.cos(beta) * Math.sin(lambda) * Math.cos(obliquity) - Math.sin(beta) * Math.sin(obliquity), Math.cos(beta) * Math.sin(lambda) * Math.sin(obliquity) + Math.sin(beta) * Math.cos(obliquity)];
    near(numberAt(rotation, 'rightAscensionDegrees', 'rotation right ascension'), Math.atan2(equatorial[1], equatorial[0]) / rad, 'Published pole right ascension');
    near(numberAt(rotation, 'declinationDegrees', 'rotation declination'), Math.asin(equatorial[2]) / rad, 'Published pole declination');
  }
  const controls = arrayAt(recordAt(content, 'settings', 'object settings'), 'controls', 'object controls')
    .map((control, index) => requireRecord(control, `object control ${index}`));
  assert.equal(controls.find(control => control.name === 'shadows')?.checked, false, 'Shadows default off');
  const [terrain, scene] = await Promise.all(['prepared/terrain.json', 'prepared/scene.json'].map(read));
  assert.deepEqual(recordAt(terrain, 'source', 'prepared terrain source').grid, radialGrid, 'Prepared terrain preserves the physical source grid');
  const terrainFaces = arrayAt(terrain, 'faces', 'prepared terrain faces').map((face, index) => requireRecord(face, `prepared terrain face ${index}`));
  assert.ok(terrainFaces.length > 0 && terrainFaces.length <= 800, 'Prepared face budget');
  const bodyLeaves = arrayAt(scene, 'bodyLeaves', 'prepared body leaves').map((leaf, index) => requireRecord(leaf, `prepared body leaf ${index}`));
  assert.equal(bodyLeaves.length, terrainFaces.length);
  const simplification = recordAt(terrain, 'simplification', 'terrain simplification');
  assert.equal(simplification.sourceFaces, expected.faces);
  assert.equal(simplification.method, 'source-meshoptimizer');
  assert.ok(numberAt(simplification, 'estimatedErrorMeters', 'simplification error') <= numberAt(recordAt(radial, 'simplification', 'radial simplification'), 'maximumErrorMeters', 'maximum simplification error'), 'Configured simplification error bound');
  const positions: number[][] = [], lookup = new Map<string, number>(), indices: number[] = [];
  for (const [index, face] of terrainFaces.entries()) {
    const leaf = bodyLeaves[index];
    assert.equal(leaf.tag, 'u');
    assert.equal(recordAt(leaf, 'attributes', 'prepared leaf attributes')['data-polycss-texture-leaf-sizing'], 'raster');
    assert.equal(leaf.projectiveTextureLayer, undefined);
    assert.ok(typeof leaf.style === 'string' && leaf.style.includes('--polycss-atlas-width:128px'));
    for (const vertex of arrayAt(face, 'vertices', 'prepared face vertices')) {
      const coordinates = numberVector(vertex, 'prepared vertex');
      const key = coordinates.join(',');
      if (!lookup.has(key)) { lookup.set(key, positions.length); positions.push(coordinates); }
      indices.push(lookup.get(key)!);
    }
  }
  const topology = validateClosedMesh(indices, positions);
  assert.equal(topology.components, 1);
  assert.equal(topology.eulerCharacteristic, 2);
}
