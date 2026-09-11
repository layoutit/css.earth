import { required, fixtureRecord } from '../../test-values.mts';
import { fixtureSource } from '../test-source-fixture.mts';
import { createIndexedShape } from './obj-shape.mts';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadRadialTerrain, radialTriangles, simplifyRadialShape, validateClosedMesh, removeOppositeFacePairs } from './radial-terrain.mts';
import { loadPdsScalarGrid, parsePdsScalarLabel } from './pds-scalar-grid.mts';

test('source topology preserves translated inward-facing facets and welds duplicated positions', async () => {
  const vertices = [[1,0,0],[0,1,0],[0,0,1],[0,0,0]];
  const tetrahedron = [0,1,2,0,3,1,1,3,2,2,3,0];
  const positions = tetrahedron.map(index => vertices[index].map((v, i) => v + (i === 0 ? 4 : 0)));
  const indices = Array.from({length: 4}, (_, i) => [i * 3, i * 3 + 1, i * 3 + 2]);
  const faces = await simplifyRadialShape(createIndexedShape(positions, indices,{metersPerUnit:1,expectedVertices:positions.length,expectedFaces:indices.length}), {faceBudget: 4,
    simplification: {method: 'source-meshoptimizer', targetFaces: 4, maximumErrorMeters: .001}}, 1);
  assert.equal(faces.length, 4);
  assert.ok(faces.some(face => face.normal.reduce((sum, n, i) => sum + n * face.vertices[0][i], 0) < 0),
    'A valid outward face may point toward the coordinate origin');
  assert.equal(fixtureRecord(faces.simplification,"topology").eulerCharacteristic, 2);
  assert.equal(fixtureRecord(faces.simplification,"topology").components, 1);
  assert.ok(Number(fixtureRecord(faces.simplification).weldedVertices) < positions.length);
  assert.equal(validateClosedMesh(tetrahedron, vertices).components, 1);
  assert.throws(() => validateClosedMesh(tetrahedron.slice(3), vertices), /not closed/);
  assert.throws(() => validateClosedMesh([1,0,2,...tetrahedron.slice(3)], vertices), /not closed/);
  assert.deepEqual([...removeOppositeFacePairs(Uint32Array.from([...tetrahedron, 0,1,4,4,1,0]))], tetrahedron);
  assert.throws(() => Reflect.apply(removeOppositeFacePairs, undefined, [[0,1,2,1,2,0]]), /ambiguous duplicate/);
});

test('radial geometry retains independently specified ellipsoid axes and rejects missing radii', () => {
  const profile = { latitudeSegments: 12, longitudeSegments: 24, faceBudget: 1000 };
  const sample = (longitude: number, latitude: number) => {
    const lon = longitude * Math.PI / 180, lat = latitude * Math.PI / 180;
    return 1 / Math.hypot(Math.cos(lat) * Math.cos(lon) / 3, Math.cos(lat) * Math.sin(lon) / 2, Math.sin(lat));
  };
  const faces = radialTriangles(sample, profile, 10), vertices = faces.flatMap(face => face.vertices);
  for (const [axis, expected] of [30, 20, 10].entries()) assert.ok(Math.abs(Math.max(...vertices.map(v => v[axis])) - expected) < 1e-9);
  assert.ok(faces.every(face => face.normal.reduce((sum, n, i) => sum + n * face.vertices[0][i], 0) > 0));
  const shared = new Map();
  for (const face of faces) for (const [index, vertex] of face.vertices.entries()) {
    const key = vertex.map(value => Math.round(value * 1e6)).join(','), normal = face.vertexNormals[index];
    assert.ok(Math.abs(Math.hypot(...normal) - 1) < 1e-12);
    assert.ok(normal.reduce((sum, value, axis) => sum + value * vertex[axis], 0) > 0);
    if (shared.has(key)) assert.deepEqual(normal, shared.get(key), 'adjacent faces must have continuous lighting');
    shared.set(key, normal);
  }
  assert.throws(() => radialTriangles(() => null, profile, 1), /no radius/);
  assert.throws(() => radialTriangles(sample, { ...profile, faceBudget: 100 }, 1), /budget/);
});

test('streamed PDS floats preserve north, east, wrap and invalid interpolation footprints', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'cssearth-pds-scalar-'));
  try {
    const profile = { member: 'grid.pds', width: 9, height: 5, pixelsPerDegree: 1 / 45, noData: -32768, validRange: [100, 200] };
    const label = `PDS_VERSION_ID = PDS3
RECORD_BYTES = 4
FILE_RECORDS = 16429
^IMAGE = 16385
LINE_SAMPLES = 9
LINES = 5
SAMPLE_TYPE = IEEE_REAL
SAMPLE_BITS = 32
BANDS = 1
MAP_RESOLUTION = ${1 / 45}
CENTER_LONGITUDE = 180
CENTER_LATITUDE = 0
SAMPLE_PROJECTION_OFFSET = 4
LINE_PROJECTION_OFFSET = 2
MISSING_CONSTANT = -32768
COORDINATE_SYSTEM_NAME = PLANETOCENTRIC
POSITIVE_LONGITUDE_DIRECTION = EAST
MAP_PROJECTION_TYPE = SIMPLE_CYLINDRICAL
END\n`;
    const bytes = Buffer.alloc(65536 + 9 * 5 * 4, 32); bytes.write(label);
    for (let y = 0; y < 5; y++) for (let x = 0; x < 9; x++) bytes.writeFloatBE(100 + y * 10 + x % 8, 65536 + (y * 9 + x) * 4);
    bytes.writeFloatBE(-32768, 65536 + (2 * 9 + 4) * 4);
    await writeFile(join(directory, 'grid.pds'), bytes);
    execFileSync('zip', ['-q', 'grid.zip', 'grid.pds'], { cwd: directory });
    const grid = await loadPdsScalarGrid(join(directory, 'grid.zip'), profile, { width: 9, height: 5 });
    assert.equal(grid.sample(0, 90), 100);
    assert.equal(grid.sample(90, -90), 142);
    assert.equal(grid.sample(360, 90), 100);
    assert.equal(grid.sample(180, 0), null);
    assert.equal(grid.sample(160, 5), null);
    assert.throws(() => parsePdsScalarLabel(label.replace('EAST', 'WEST'), profile), /coordinate system/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});


test('two-sided radial preparation retains exact source geometry and atlas layout with opt-in coverage', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'cssearth-radial-backface-'));
  try {
    await writeFile(join(directory, 'shape.obj'), 'v 1 0 0\nv 0 1 0\nv 0 0 1\nv 0 0 0\nf 1 2 3\nf 1 4 2\nf 2 4 3\nf 3 4 1\n');
    const config = { namespace: 'fixture', geometry: { radius: 1, radiusKm: .001,
      radialTerrain: { path: 'shape.obj', format: 'wavefront-obj', tileSize: 16, atlasColumns: 2,
        grid: { metersPerUnit: 1, expectedVertices: 4, expectedFaces: 4 }, faceBudget: 4,
        simplification: { method: 'source-meshoptimizer', targetFaces: 4, maximumErrorMeters: .001 } } } };
    let validations = 0;
    const pinned=await fixtureSource(directory,[{id:'shape',path:'shape.obj',consumers:['geometry']}]);
    const source = {...pinned,async validatePath(path:string){assert.equal(path,'shape.obj');validations++;return pinned.validatePath(path);}};
    const prepare = async (value: unknown) => {
      const profile = structuredClone(config);
      if (value !== undefined) Object.assign(profile.geometry.radialTerrain,{backfaceVisible:value});
      return required(await loadRadialTerrain({ config: profile, sourceDirectory: directory, source }));
    };
    const baseline = await prepare(undefined), explicitDefault = await prepare(false), twoSided = await prepare(true);
    const { grid: baselineGrid, ...baselineOutput } = baseline;
    const { grid: explicitGrid, ...explicitOutput } = explicitDefault;
    assert.deepEqual(explicitOutput, baselineOutput, 'omission and false preserve existing outputs');
    assert.deepEqual(explicitGrid.positions, baselineGrid.positions);
    assert.deepEqual(explicitGrid.indices, baselineGrid.indices);
    assert.deepEqual(required(twoSided).faces, required(baseline).faces);
    assert.deepEqual(required(twoSided).plans, required(baseline).plans);
    assert.equal(required(twoSided).leaves.length, required(baseline).leaves.length);
    assert.deepEqual(required(twoSided).leaves.map(leaf => ({ ...leaf, style: leaf.style.replace(';backface-visibility:visible', '') })), required(baseline).leaves);
    assert.equal(validations, 3, 'all valid variants still validate the owned mesh source');
    for (const value of ['true', 1, null]) await assert.rejects(prepare(value), /backface visibility must be boolean/);
    assert.equal(validations, 3, 'invalid coverage policy is rejected before source loading');
  } finally { await rm(directory, { recursive: true, force: true }); }
});
