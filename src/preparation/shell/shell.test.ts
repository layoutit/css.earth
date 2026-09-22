import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
import { parseShellRecipe } from './config.js';
import { parseGriddedShellMesh, parseIndexedShellMesh, loadShellMesh, type ShellMesh } from './mesh.js';
import { prepareSurfaceShellObject } from './prepare.js';
import { sha256, sourceBytes } from '@cssearth/volume-bake/compact-inputs/density-grid';
import type { PreparedCssSurfaceShell } from '../../renderers/css/shell/types.js';
import { compileCssSurfaceShell } from '../../renderers/css/preparation/shell.js';
import { SHELL_CORNER_PERMUTATIONS, nearestFacingIndex, shellMaterialAddress } from '../../renderers/css/shell/material-address.js';
import { shellRim } from './atlas.js';
import { validatePreparedCssSurfaceShell } from '../../renderers/css/shell/validation.js';

const objectDirectory = resolve('src/objects/heliosphere');
const recipe = async () => parseShellRecipe(JSON.parse(await readFile(join(objectDirectory, 'source/shell.json'), 'utf8')) as unknown);
const prepared = async () => (JSON.parse(await readFile(join(objectDirectory, 'prepared/shell.json'), 'utf8')) as { data: PreparedCssSurfaceShell }).data;
function close(actual: readonly number[], expected: readonly number[], tolerance = 1e-5): void {
  assert.equal(actual.length, expected.length);
  actual.forEach((value, index) => assert(Math.abs(value - expected[index]!) < tolerance, `${actual} differs from ${expected}`));
}

test('scientific grid and uncertainty rows reproduce from the pinned publisher workbook and figure', () => {
  const output = execFileSync('python3', [join(objectDirectory, 'source/ibex/extract.py'), '--check'], { encoding: 'utf8' });
  assert.match(output, /IBEX ORIGINAL EXTRACTION VERIFIED: 56 macropixels; 67 matching entries; 13 tail-limit entries retained/);
});

test('published envelope retains every source sample and prepares a closed, finely tessellated display', async () => {
  const r = await recipe(); assert.equal(r.shape.kind, 'gridded-surface');
  const source = JSON.parse(await readFile(join(objectDirectory, 'source', r.shape.path), 'utf8'));
  const mesh = await loadShellMesh(join(objectDirectory, 'source'), r);
  assert.equal(source.positionsUnits.flat().filter((p: unknown) => p === null).length, 0,
    'Uncertain published tail samples must remain present; deleting them tears away half the envelope');
  const original = parseGriddedShellMesh(source);
  assert.equal(original.triangles.length, 120);
  for (const sample of original.positionsUnits) assert(mesh.positionsUnits.some(vertex =>
    Math.hypot(...vertex.map((n, i) => n - sample[i]!)) < 1e-10), 'Display tessellation must preserve each original sample');
  assert(mesh.triangles.length >= 960 && mesh.triangles.length <= 2000,
    'The coarse scientific grid needs a bounded, finer display mesh');
  const welded = mesh.positionsUnits.map(p => p.map(n => Math.round(n * 1e8)).join(','));
  const edges = new Map<string, number>();
  for (const triangle of mesh.triangles) for (let i = 0; i < 3; i++) {
    const a = welded[triangle[i]!]!, b = welded[triangle[(i + 1) % 3]!]!;
    assert.notEqual(a, b, 'Pole welding must not create degenerate edges');
    const key = [a, b].sort().join('|'); edges.set(key, (edges.get(key) ?? 0) + 1);
  }
  assert([...edges.values()].every(count => count === 2), 'Every display edge must meet its neighbour, including the tail, seam and poles');
  // Figure 8's unmodified nose sample is +Y, 120 AU. North/south pole samples
  // are the authors' gridded 182/156 AU values, not the old analytic deformation.
  close(source.positionsUnits[5][3], [0, 120, 0], 1e-10);
  close(source.positionsUnits[0][0], [0, 0, -156], 1e-10);
  close(source.positionsUnits[0][6], [0, 0, 182], 1e-10);
  // Published modified ecliptic +Y is longitude 255 degrees, latitude zero.
  const [x, y, z, w] = r.frame.localToReferenceXyzw;
  const transformed = [2 * (x * y - w * z), 1 - 2 * (x * x + z * z), 2 * (y * z + w * x)];
  const obliquity = 84381.448 / 3600 * Math.PI / 180, longitude = 255 * Math.PI / 180;
  close(transformed, [Math.cos(longitude), Math.sin(longitude) * Math.cos(obliquity), Math.sin(longitude) * Math.sin(obliquity)], 1e-12);
  // Source topology remains only immediate neighbours; the publisher already
  // supplies its repeated longitude seam and poles. Display subdivision is separate.
  const sourceIndices = source.positionsUnits.flatMap((row: unknown[], i: number) => row.flatMap((value, j) => value === null ? [] : [[i, j]]));
  for (const triangle of original.triangles) {
    const cells = triangle.map(index => sourceIndices[index]);
    for (const axis of [0, 1]) assert(Math.max(...cells.map(c => c[axis])) - Math.min(...cells.map(c => c[axis])) <= 1);
  }
});

test('gridded surfaces retain holes, suppress repeated-pole slivers and reject malformed samples', () => {
  const input = { schema: 'cssearth-surface-grid@1', positionsUnits: [
    [[1, 0, 2], [1, 1, 2], null], [[2, 0, 2], [2, 1, 2], [2, 2, 2]],
  ] };
  const mesh = parseGriddedShellMesh(input);
  assert.equal(mesh.positionsUnits.length, 5); assert.equal(mesh.triangles.length, 2);
  for (const triangle of mesh.triangles) assert(triangle.every(index => index < 5));
  const pole = { schema: 'cssearth-surface-grid@1', positionsUnits: [
    [[0, 0, 2], [1, 0, 1]], [[1e-15, 0, 2], [0, 1, 1]],
  ] };
  assert.equal(parseGriddedShellMesh(pole).triangles.length, 1, 'floating-point copies of a pole cannot create an extra skinny triangle');
  for (const positionsUnits of [[], [[[1, 2, 3]]], [input.positionsUnits[0], []], [[null, null], [null, null]],
    [[[0, 0, 0], [1, 1, 2]], [[2, 0, 2], [2, 1, 2]]],
    [[[NaN, 0, 2], [1, 1, 2]], [[2, 0, 2], [2, 1, 2]]]]) {
    assert.throws(() => parseGriddedShellMesh({ ...input, positionsUnits }));
  }
});

test('actual PolyCSS matrices map triangular PNG coverage onto each source triangle in physical local axes', async () => {
  const data = await prepared();
  const mesh = JSON.parse(await readFile(join(objectDirectory, 'prepared/surface-mesh.json'), 'utf8')) as ShellMesh;
  assert.equal(data.faces.length, mesh.triangles.length);
  let maximumError = 0, reflectionMutationError = 0, maximumNormalDifference = 0;
  for (let index = 0; index < data.faces.length; index++) {
    const face = data.faces[index]!, triangle = mesh.triangles[index]!;
    assert.deepEqual(face.atlasStepPixels, [32, 32]); assert.deepEqual(face.atlasOriginPixels, [0, 0]);
    assert.equal(face.style.backgroundSize, '1472px 1408px');
    assert.equal(face.materialTransforms?.length, 6);
    assert.deepEqual(face.vertexIndices, triangle);
    for (let order = 0; order < 6; order++) {
    const matrix: number[] = face.materialTransforms![order]!.slice('matrix3d('.length, -1).split(',').map(Number);
    assert.equal(matrix.length, 16); assert(matrix.every(Number.isFinite));
    for (const [corner, u, v] of [[0, 0, 0], [1, 1, 0], [2, 0, 1]] as const) {
      const inset = data.atlas.triangleInsetPixels ?? 0;
      const x = inset + u * (parseFloat(face.style.width) - 2 * inset), y = inset + v * (parseFloat(face.style.height) - 2 * inset);
      const denominator = matrix[3]! * x + matrix[7]! * y + matrix[15]!;
      // Shared camera interprets PolyCSS pixel axes as Y, X, Z in physical space.
      const actual = [1, 0, 2].map(axis => (matrix[axis]! * x + matrix[axis + 4]! * y + matrix[axis + 12]!) / denominator / data.unitScale);
      const expected = mesh.positionsUnits[triangle[SHELL_CORNER_PERMUTATIONS[order]![corner]]] !;
      maximumError = Math.max(maximumError, Math.hypot(...actual.map((value, axis) => value - expected[axis]!)));
      reflectionMutationError = Math.max(reflectionMutationError, Math.hypot(actual[1]! - expected[0], actual[0]! - expected[1], actual[2]! - expected[2]));
    }
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
      atlasResource: { path: 'atlas.png', sha256: '0'.repeat(64), bytes: 1, width: 1472, height: 1408 }, provenance: {} });
    assert.equal(data.faces.length, 1, 'An open source must not acquire fabricated closing triangles');
    const face = data.faces[0]!, matrix = face.style.transform.slice('matrix3d('.length, -1).split(',').map(Number);
    for (const [index, u, v] of [[0, 0, 0], [1, 1, 0], [2, 0, 1]] as const) {
      const inset = data.atlas.triangleInsetPixels ?? 0;
      const x = inset + u * (parseFloat(face.style.width) - 2 * inset), y = inset + v * (parseFloat(face.style.height) - 2 * inset);
      const denominator = matrix[3]! * x + matrix[7]! * y + matrix[15]!;
      const physical = [1, 0, 2].map(axis => (matrix[axis]! * x + matrix[axis + 4]! * y + matrix[axis + 12]!) / denominator / r.unitScale);
      close(physical, source.positionsUnits[index]!, 2e-6);
    }
    assert.throws(() => parseIndexedShellMesh({ ...source, triangles: [[0, 1, 9]] }), /invalid triangle/);
    assert.throws(() => parseIndexedShellMesh({ ...source, triangles: [[0, 1, 1]] }), /invalid triangle/);
    assert.throws(() => parseIndexedShellMesh({ ...source, positionsUnits: [[0, 0, 1], [1, 0, 1], [2, 0, 1]] }), /degenerate/);
  } finally { await rm(temporary, { recursive: true, force: true }); }
});

test('sorted atlas pixels bake a spatial rim in linear RGB and alpha with transparent triangular coverage', async () => {
  const shell = validatePreparedCssSurfaceShell(await prepared()), resource = shell.resources[0]!;
  const { data, info } = await sharp(join(objectDirectory, 'prepared', resource.path)).raw().toBuffer({ resolveWithObject: true });
  assert.deepEqual([info.width, info.height, info.channels], [1472, 1408, 4]);
  assert(info.width * info.height * 4 < 10 * 1024 * 1024);
  const levels = shell.atlas.facingLevels!;
  const frameFor = (wanted: readonly number[]) => {
    let frame = 0;
    for (let a = 0; a < levels.length; a++) for (let b = a; b < levels.length; b++) for (let c = b; c < levels.length; c++, frame++) {
      if (a === wanted[0] && b === wanted[1] && c === wanted[2]) return frame;
    }
    throw new Error('Missing frame');
  };
  const pixel = (frame: number, x: number, y: number) => {
    const at = ((Math.floor(frame / 46) * 32 + y) * info.width + frame % 46 * 32 + x) * 4;
    return [...data.subarray(at, at + 4)];
  };
  const toSrgb = (v: number) => Math.round(255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055));
  for (const indices of [[4, 8, 12], [1, 12, 21], [12, 12, 12], [15, 17, 20]]) {
    const frame = frameFor(indices), [a, b, c] = indices.map(i => levels[i]!);
    for (const [x, y] of [[2, 2], [24, 2], [12, 19]]) {
      const u = (x! - 1) / 29, v = (y! - 1) / 29, f = a! * (1 - u - v) + b! * u + c! * v;
      const t = Math.max(0, Math.min(1, f / .1)), rim = (1 - Math.max(0, Math.min(1, f))) * t * t * (3 - 2 * t);
      const coverage = x! + y! < 31 ? 1 : .5;
      assert.deepEqual(pixel(frame, x!, y!), [toSrgb(.5 * rim), toSrgb(.9 * rim), toSrgb(.8 * rim), Math.round(255 * (1 - (1 - .2 * rim) ** coverage))]);
    }
    assert.equal(pixel(frame, 25, 25)[3], 0);
  }
  const uniform = frameFor([12, 12, 12]);
  const halfCoverage = Math.round(255 * (1 - Math.sqrt(1 - .2 * .9)));
  for (const [x, y] of [[1, 12], [12, 1], [15, 16]]) {
    assert.equal(pixel(uniform, x!, y!)[3], halfCoverage, 'All three edges must carry the same optical half-coverage');
  }
  for (let i = 0; i < 32; i++) for (const [x, y] of [[0, i], [31, i], [i, 0], [i, 31]]) {
    assert.equal(pixel(uniform, x!, y!)[3], 0, 'Image rectangle edges must remain transparent');
  }
  const gradient = frameFor([4, 12, 12]);
  assert(pixel(gradient, 24, 2)[3]! - pixel(gradient, 2, 2)[3]! > 20, 'Replacing the spatial rim with a flat face sample must fail');
});

test('every sorted triple and corner order selects its correct prepared tile without changing edge values', async () => {
  const levels = (await recipe()).atlas.facingLevels!; let frame = 0;
  for (let a = 0; a < levels.length; a++) for (let b = a; b < levels.length; b++) for (let c = b; c < levels.length; c++, frame++) {
    for (const order of SHELL_CORNER_PERMUTATIONS) {
      const input = [a, b, c].map((_, i) => [a, b, c][order[i]!]!);
      const address = shellMaterialAddress(input[0]!, input[1]!, input[2]!, levels.length);
      assert.equal(Math.floor(address / 6), frame);
      const sorted = SHELL_CORNER_PERMUTATIONS[address % 6]!.map(i => input[i]!);
      assert.deepEqual(sorted, [a, b, c]);
    }
  }
  assert.equal(frame, 2024);
  for (let i = 0; i < levels.length; i++) assert.equal(nearestFacingIndex(levels[i]!, levels), i);
});

test('interpolated corner material reduces source shader error at outside and near-surface viewpoints', async () => {
  const r = await recipe(), mesh = await loadShellMesh(join(objectDirectory, 'source'), r), shell = await prepared(), levels = r.atlas.facingLevels!;
  const dot = (a: readonly number[], b: readonly number[]) => a.reduce((sum, v, i) => sum + v * b[i]!, 0);
  const direction = (a: readonly number[], b: readonly number[]) => {
    const delta = a.map((v, i) => v - b[i]!), length = Math.hypot(...delta);
    return delta.map(v => v / length);
  };
  const mix = (vectors: readonly (readonly number[])[], weights: readonly number[]) => [0, 1, 2].map(axis =>
    vectors.reduce((sum, v, corner) => sum + v[axis]! * weights[corner]!, 0));
  for (const camera of [[456, 0, 0], [0, 0, Math.max(...mesh.positionsUnits.map(p => p[2])) * 1.15]]) {
    let flatError = 0, interpolatedError = 0, samples = 0;
    for (let faceIndex = 0; faceIndex < mesh.triangles.length; faceIndex++) {
      const face = shell.faces[faceIndex]!;
      if (dot(camera.map((v, i) => v - face.centerUnits[i]!), face.faceNormal) <= 0) continue;
      const vertices = mesh.triangles[faceIndex]!.map(i => shell.vertices![i]!);
      const positions = vertices.map(v => v.positionUnits), normals = vertices.map(v => v.radialNormal);
      const quantized = positions.map((p, i) => levels[nearestFacingIndex(dot(direction(camera, p), normals[i]!), levels)]!);
      const flat = shellRim(dot(direction(camera, face.centerUnits), face.radialNormal), .1);
      for (let a = 1; a < 8; a++) for (let b = 1; b < 8 - a; b++) {
        const weights = [a / 8, b / 8, 1 - (a + b) / 8];
        // Reference shader: camera-to-fragment direction dotted with interpolated original vertex normals.
        const reference = shellRim(dot(direction(camera, mix(positions, weights)), mix(normals, weights)), .1);
        const actual = shellRim(dot(quantized, weights), .1);
        flatError += (flat - reference) ** 2; interpolatedError += (actual - reference) ** 2; samples++;
      }
    }
    const flatRms = Math.sqrt(flatError / samples), interpolatedRms = Math.sqrt(interpolatedError / samples);
    assert(interpolatedRms < flatRms * .5, 'Flattening the corner material must fail the source shader comparison');
    console.log(`PASS camera ${camera} AU: material rim RMS ${interpolatedRms.toFixed(5)} versus coarse flat ${flatRms.toFixed(5)}`);
  }
});

test('pinned preparation deterministically regenerates actual geometry, images and envelope without sibling access', async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'prepared-surface-'));
  try {
    const envelope = await prepareSurfaceShellObject({ objectDirectory, outputDirectory: temporary });
    assert.equal(envelope.type, 'surface-shell'); assert.equal(envelope.format, 'cssearth-surface-shell@1');
    assert.equal(envelope.data.faces.length, 1920);
    for (const name of ['shell.json', 'surface-mesh.json', 'rim-atlas.png']) await readFile(join(temporary, name));
    for (const resource of envelope.data.resources) {
      const bytes = await readFile(join(temporary, resource.path));
      assert.equal(bytes.length, resource.bytes); assert.equal(sha256(bytes), resource.sha256);
    }
  } finally { await rm(temporary, { recursive: true, force: true }); }
});
