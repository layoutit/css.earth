import { required } from '../../contract/test-values.mts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseScalarMap, scalarMapIndex, createScalarMapSampler, validateScalarMapProfile } from './pds-scalar-map.mts';
import { parseObjShape } from './obj-shape.mts';

const grid = { width: 720, height: 360, stepDegrees: .5, latitudeFirst: 90, latitudeStep: -.5, noData: -1, frame: 'cheops-planetocentric-east-positive' };
const iceGrid = { ...grid, latitudeFirst: -90, latitudeStep: .5 };
const lens = { path: 'science/AL01_GLB_M006_M006_V01.TAB', labelPath: 'science/al01.lbl',
  datasetId: 'RO-C-VIRTIS-5-67P-MAPS-V1.0', productId: 'AL01_GLB_M006_M006_V01.LBL', grid,
  minimum: 0, maximum: 1, sourceValidRange: [0, 1], sampling: 'nearest',
  surfaceSampling: { method: 'unique-radial-map', maximumDistanceMeters: .2,
    ambiguityReference: { path: 'science/reference.wrl', format: 'vrml-mesh', grid: { metersPerUnit: 1, expectedVertices: 6, expectedFaces: 8 } } } };
const label = await readFile(new URL('../../../src/objects/comet-67p/source/science/al01_glb_m006_m006_v01.lbl', import.meta.url), 'utf8');
const records = Buffer.from(Array.from({ length: 259200 }, (_, i) => [90 - Math.floor(i / 720) * .5, i % 720 * .5, .2]
  .map(n => n.toFixed(4).padStart(9)).join(',') + '\r\n').join(''));
const withValue = (bytes: Buffer<ArrayBuffer>, row: number, value: number) => bytes.write(value.toFixed(4).padStart(9), row * 31 + 20, 'ascii');

test('PDS scalar records preserve zero, sentinel, physical rejection and source-unit conversion separately', () => {
  const bytes = Buffer.from(records);
  withValue(bytes, 9000, 0); withValue(bytes, 9001, -1); withValue(bytes, 9002, 1.0001);
  const { data, report } = parseScalarMap(bytes, label, { ...lens, valueTransform: { scale: 100, offset: 0 } });
  assert.equal(data[9000], 0); assert.ok(Number.isNaN(data[9001])); assert.ok(Number.isNaN(data[9002]));
  assert.equal(data[9003], 20); assert.equal(report.validZeroRows, 1); assert.equal(report.missingRows, 1); assert.equal(report.rejectedPhysicalRangeRows, 1);
  assert.throws(() => parseScalarMap(bytes.subarray(31), label, lens), /byte count/);
  assert.throws(() => parseScalarMap(bytes, label.replace('MISSING_CONSTANT= -1.0000', 'MISSING_CONSTANT= 0.0000'), lens), /column contract/);
  const swapped = Buffer.from(bytes); bytes.copy(swapped, 31, 0, 31);
  assert.throws(() => parseScalarMap(swapped, label, lens), /coordinate order/);
  const malformed = Buffer.from(bytes); malformed[9] = 32;
  assert.throws(() => parseScalarMap(malformed, label, lens), /Malformed scalar record/);
});

test('explicit north-first and south-first grids keep their own source rows, seam and extent', () => {
  assert.equal(scalarMapIndex(16.5, 24.5, grid), 131 * 720 + 33);
  assert.equal(scalarMapIndex(16.5, 24.5, iceGrid), 229 * 720 + 33);
  for (const g of [grid, iceGrid]) {
    assert.equal(scalarMapIndex(-.1, 30, g), scalarMapIndex(359.9, 30, g));
    assert.equal(scalarMapIndex(360, 30, g), scalarMapIndex(0, 30, g));
    for (const latitude of [-90, -89.75, 89.75, 90, 91, NaN]) assert.equal(scalarMapIndex(0, latitude, g), -1);
    assert.equal(scalarMapIndex(NaN, 0, g), -1);
  }
  assert.throws(() => validateScalarMapProfile({ ...lens, sampling: 'bilinear' }, { simplification: { method: 'source-meshoptimizer', maximumErrorMeters: 1 } }), /Scalar maps/);
});

const octahedron = 'v 2 0 0\nv -2 0 0\nv 0 2 0\nv 0 -2 0\nv 0 0 2\nv 0 0 -2\n' +
  'f 1 3 5\nf 3 2 5\nf 2 4 5\nf 4 1 5\nf 3 1 6\nf 2 3 6\nf 4 2 6\nf 1 4 6\n';
const mesh = parseObjShape(octahedron, { metersPerUnit: 1, expectedVertices: 6, expectedFaces: 8 });
test('source-point transfer honors distance, missing data and valid zero without filling gaps', () => {
  const data = new Float64Array(259200).fill(NaN), index = scalarMapIndex(0, 0, grid);
  data[index] = 0;
  const sampler = createScalarMapSampler(data, lens, mesh, mesh);
  assert.equal(required(sampler.samplePoint([2.1, 0, 0])).value, 0);
  assert.equal(required(sampler.samplePoint([2.1, 0, 0])).sourceCell, index);
  assert.equal(sampler.samplePoint([2.3, 0, 0]), null);
  assert.equal(sampler.sample(1, 0), null);
});

test('all radial branches are withheld on either mesh, including cell-edge ambiguity', () => {
  const vertices = [], faces = [];
  for (const center of [0, 4]) {
    const offset = vertices.length;
    vertices.push(...[[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]].map(([x,y,z]) => [x + center,y,z]));
    faces.push(...[[0,2,1],[0,3,2],[4,5,6],[4,6,7],[0,1,5],[0,5,4],[1,2,6],[1,6,5],[2,3,7],[2,7,6],[3,0,4],[3,4,7]].map(f => f.map(i => i + offset + 1)));
  }
  const nonconvex = parseObjShape(vertices.map(v => 'v ' + v.join(' ')).concat(faces.map(f => 'f ' + f.join(' '))).join('\n'), { metersPerUnit: 1, expectedVertices: 16, expectedFaces: 24 });
  const data = new Float64Array(259200).fill(.2);
  const sampler = createScalarMapSampler(data, lens, nonconvex, mesh);
  assert.equal(sampler.samplePoint([1.1,0,0]), null);
  assert.equal(sampler.samplePoint([4.9,0,0]), null);
  assert.equal(sampler.sample(0,0), null);
  assert.equal(sampler.sample(180,0), .2);
  assert.equal(createScalarMapSampler(data, lens, mesh, nonconvex).samplePoint([2,0,0]), null);
  const edgeAmbiguity = { ...mesh, hit: (lon: number, lat: number) => lon === .25 && lat === .25 ? null : mesh.hit(lon, lat, true) };
  assert.equal(createScalarMapSampler(data, lens, mesh, edgeAmbiguity).sample(0,0), null);
});
