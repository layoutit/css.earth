import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { radialTriangles } from './radial-terrain.mjs';
import { loadPdsScalarGrid, parsePdsScalarLabel } from './pds-scalar-grid.mjs';

test('radial geometry retains independently specified ellipsoid axes and rejects missing radii', () => {
  const profile = { latitudeSegments: 12, longitudeSegments: 24, faceBudget: 1000 };
  const sample = (longitude, latitude) => {
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
