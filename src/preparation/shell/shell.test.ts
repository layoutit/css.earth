import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { parseShellRecipe } from './config.js';
import { prepareShellMesh, parseIndexedShellMesh, loadShellMesh, type ShellMesh } from './mesh.js';
import { prepareSurfaceShellObject } from './prepare.js';
import { sha256, verifiedBytes } from '../volume/source.js';
import type { PreparedCssSurfaceShell } from '../../renderers/css/shell/types.js';
import { compileCssSurfaceShell } from '../../renderers/css/preparation/shell.js';

const objectDirectory = resolve('src/objects/heliosphere');
const recipe = async () => parseShellRecipe(JSON.parse(await readFile(join(objectDirectory, 'source/shell.json'), 'utf8')) as unknown);
const prepared = async () => (JSON.parse(await readFile(join(objectDirectory, 'prepared/shell.json'), 'utf8')) as { data: PreparedCssSurfaceShell }).data;
function close(actual: readonly number[], expected: readonly number[], tolerance = 1e-5): void {
  assert.equal(actual.length, expected.length);
  actual.forEach((value, index) => assert(Math.abs(value - expected[index]!) < tolerance, `${actual} differs from ${expected}`));
}

test('illustrative source shape preserves nose, tail, nonlinear landmark and independent ICRF orientation', async () => {
  const r = await recipe(); assert.equal(r.shape.kind, 'asymmetric-radial-shell');
  if (r.shape.kind !== 'asymmetric-radial-shell') throw new Error('Expected the current illustrative fixture.');
  const mesh = prepareShellMesh(r), columns = r.shape.longitudeSegments + 1;
  assert.equal(mesh.positionsUnits.length, 2145); assert.equal(mesh.triangles.length, 3968);
  close(mesh.positionsUnits[16 * columns + 32]!, [120, 0, 0]);
  close(mesh.positionsUnits[16 * columns]!, [-210, 0, 0]);
  close(mesh.positionsUnits[16 * columns + 16]!, [0, 0, 110.4]);
  close(mesh.positionsUnits[0]!, [0, 110.4, 0]);
  close(mesh.positionsUnits[32 * columns]!, [0, -110.4, 0]);
  close(mesh.positionsUnits[12 * columns + 8]!, [-0.86238533 * 120, 0.31613827 * 120, 0.70012331 * 120], 2e-5);
  const missingLobes = prepareShellMesh({ ...r, shape: { ...r.shape, lobeAmplitude: 0 } });
  assert(Math.abs(missingLobes.positionsUnits[12 * columns + 8]![2] - mesh.positionsUnits[12 * columns + 8]![2]) > 18,
    'Removing the nonlinear tail term must fail the independent landmark');
  const [qx, qy, qz, qw] = r.frame.localToReferenceXyzw;
  const rotatedNose = [120 * (1 - 2 * (qy * qy + qz * qz)), 240 * (qx * qy + qw * qz), 240 * (qx * qz - qw * qy)];
  close(rotatedNose, [-29.52253917453236, -115.8215353812353, 10.66731562397298], 1e-9);
  assert(Math.hypot(rotatedNose[0]! - 120, rotatedNose[1]!, rotatedNose[2]!) > 100, 'Identity orientation must fail');
  for (let row = 0; row <= r.shape.latitudeSegments; row++) {
    assert.deepEqual(mesh.positionsUnits[row * columns], mesh.positionsUnits[(row + 1) * columns - 1]);
    assert.deepEqual(mesh.radialNormals[row * columns], mesh.radialNormals[(row + 1) * columns - 1]);
  }
});

test('actual PolyCSS matrices map triangular PNG coverage onto each source triangle in physical local axes', async () => {
  const data = await prepared();
  const mesh = JSON.parse(await readFile(join(objectDirectory, 'prepared/surface-mesh.json'), 'utf8')) as ShellMesh;
  assert.equal(data.faces.length, mesh.triangles.length);
  let maximumError = 0, reflectionMutationError = 0, maximumNormalDifference = 0;
  for (let index = 0; index < data.faces.length; index++) {
    const face = data.faces[index]!, triangle = mesh.triangles[index]!;
    const matrix = face.style.transform.slice('matrix3d('.length, -1).split(',').map(Number);
    assert.equal(matrix.length, 16); assert(matrix.every(Number.isFinite));
    assert.deepEqual(face.atlasStepPixels, [64, 64]); assert.deepEqual(face.atlasOriginPixels, [0, 0]);
    assert.equal(face.style.backgroundSize, '1024px 512px');
    for (const [corner, u, v] of [[0, 0, 0], [1, 1, 0], [2, 0, 1]] as const) {
      const x = u * parseFloat(face.style.width), y = v * parseFloat(face.style.height);
      const denominator = matrix[3]! * x + matrix[7]! * y + matrix[15]!;
      // Shared camera interprets PolyCSS pixel axes as Y, X, Z in physical space.
      const actual = [1, 0, 2].map(axis => (matrix[axis]! * x + matrix[axis + 4]! * y + matrix[axis + 12]!) / denominator / data.unitScale);
      const expected = mesh.positionsUnits[triangle[corner]]!;
      maximumError = Math.max(maximumError, Math.hypot(...actual.map((value, axis) => value - expected[axis]!)));
      reflectionMutationError = Math.max(reflectionMutationError, Math.hypot(actual[1]! - expected[0], actual[0]! - expected[1], actual[2]! - expected[2]));
    }
    close([Math.hypot(...face.faceNormal), Math.hypot(...face.radialNormal)], [1, 1], 1e-12);
    assert(face.faceNormal.reduce((sum, n, axis) => sum + n * face.centerUnits[axis]!, 0) > 0);
    maximumNormalDifference = Math.max(maximumNormalDifference, Math.hypot(...face.faceNormal.map((n, axis) => n - face.radialNormal[axis]!)));
  }
  assert(maximumError < 2e-6, `Prepared triangle corners moved by ${maximumError} units`);
  assert(reflectionMutationError > 100, 'Pre-reflecting the source before PolyCSS must fail');
  assert(maximumNormalDifference > 0.2, 'Geometric and source radial normals must remain distinct');
  console.log(`PASS ${data.faces.length} prepared PolyCSS triangle mappings; maximum corner error ${maximumError} AU`);
});

test('generic pinned indexed reader preserves an open non-axis-aligned triangle and its physical camera mapping', async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'indexed-surface-'));
  try {
    const source = { schema: 'cssearth-indexed-surface@1', positionsUnits: [[1, 2, 3], [5, 1, 6], [3, 5, 3]], triangles: [[0, 1, 2]] };
    const bytes = Buffer.from(JSON.stringify(source)); await writeFile(join(temporary, 'mesh.json'), bytes);
    const base = await recipe(), r = parseShellRecipe({ ...base, shape: { kind: 'indexed-mesh', path: 'mesh.json', sha256: sha256(bytes) } });
    const mesh = await loadShellMesh(temporary, r);
    assert.deepEqual(mesh.positionsUnits, source.positionsUnits); assert.deepEqual(mesh.triangles, source.triangles);
    const data = compileCssSurfaceShell({ id: 'test-open-surface', recipe: r, mesh,
      atlasResource: { path: 'atlas.png', sha256: '0'.repeat(64), bytes: 1, width: 1024, height: 512 }, provenance: {} });
    assert.equal(data.faces.length, 1, 'An open source must not acquire fabricated closing triangles');
    const face = data.faces[0]!, matrix = face.style.transform.slice('matrix3d('.length, -1).split(',').map(Number);
    for (const [index, u, v] of [[0, 0, 0], [1, 1, 0], [2, 0, 1]] as const) {
      const x = u * parseFloat(face.style.width), y = v * parseFloat(face.style.height);
      const denominator = matrix[3]! * x + matrix[7]! * y + matrix[15]!;
      const physical = [1, 0, 2].map(axis => (matrix[axis]! * x + matrix[axis + 4]! * y + matrix[axis + 12]!) / denominator / r.unitScale);
      close(physical, source.positionsUnits[index]!, 2e-6);
    }
    await assert.rejects(loadShellMesh(temporary, { ...r, shape: { kind: 'indexed-mesh', path: 'mesh.json', sha256: '0'.repeat(64) } }), /digest mismatch/);
    assert.throws(() => parseIndexedShellMesh({ ...source, triangles: [[0, 1, 9]] }), /invalid triangle/);
    assert.throws(() => parseIndexedShellMesh({ ...source, triangles: [[0, 1, 1]] }), /invalid triangle/);
    assert.throws(() => parseIndexedShellMesh({ ...source, positionsUnits: [[0, 0, 1], [1, 0, 1], [2, 0, 1]] }), /degenerate/);
  } finally { await rm(temporary, { recursive: true, force: true }); }
});

test('real atlas pixels bake linear RGB and alpha rim together with transparent triangle coverage', async () => {
  const shell = await prepared(), resource = shell.resources[0]!;
  const { data, info } = await sharp(join(objectDirectory, 'prepared', resource.path)).raw().toBuffer({ resolveWithObject: true });
  assert.deepEqual([info.width, info.height, info.channels], [1024, 512, 4]);
  const pixel = (frame: number, x: number, y: number) => {
    const at = ((Math.floor(frame / 16) * 64 + y) * info.width + frame % 16 * 64 + x) * 4;
    return [...data.subarray(at, at + 4)];
  };
  const toSrgb = (v: number) => Math.round(255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055));
  for (const frame of [1, 8, 12, 32, 64, 110]) {
    const f = frame / 127, t = Math.min(1, f / 0.1), rim = (1 - f) * t * t * (3 - 2 * t);
    assert.deepEqual(pixel(frame, 10, 10), [toSrgb(0.5 * rim), toSrgb(0.9 * rim), toSrgb(0.8 * rim), Math.round(255 * 0.2 * rim)]);
    assert.equal(pixel(frame, 50, 50)[3], 0, 'Outside-triangle texels must remain transparent');
  }
  assert.equal(pixel(0, 10, 10)[3], 0); assert.equal(pixel(127, 10, 10)[3], 0);
  assert(pixel(12, 10, 10)[3]! > pixel(64, 10, 10)[3]!);
  assert.notDeepEqual(pixel(12, 10, 10).slice(0, 3), pixel(64, 10, 10).slice(0, 3), 'Opacity-only material mutation must fail');
  assert.equal(pixel(12, 31, 32)[3], Math.round(pixel(12, 10, 10)[3]! / 2));
});

test('pinned preparation deterministically regenerates actual geometry, images and envelope without sibling access', async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'prepared-surface-'));
  try {
    const envelope = await prepareSurfaceShellObject({ objectDirectory, outputDirectory: temporary });
    assert.equal(envelope.type, 'surface-shell'); assert.equal(envelope.format, 'cssearth-surface-shell@1');
    assert.equal(envelope.data.faces.length, 3968);
    for (const name of ['shell.json', 'surface-mesh.json', 'rim-atlas.png']) {
      assert.deepEqual(await readFile(join(temporary, name)), await readFile(join(objectDirectory, 'prepared', name)), `${name} must reproduce byte for byte`);
    }
    const descriptor = JSON.parse(await readFile(join(objectDirectory, 'object.json'), 'utf8')) as { prepared: { url: string; sha256: string } };
    assert.equal(sha256(await readFile(join(objectDirectory, descriptor.prepared.url))), descriptor.prepared.sha256);
    for (const resource of envelope.data.resources) {
      const bytes = await readFile(join(temporary, resource.path));
      assert.equal(bytes.length, resource.bytes); assert.equal(sha256(bytes), resource.sha256);
    }
    await assert.rejects(verifiedBytes(objectDirectory, { path: 'source/shell.json', sha256: '0'.repeat(64) }), /digest mismatch/);
  } finally { await rm(temporary, { recursive: true, force: true }); }
});
