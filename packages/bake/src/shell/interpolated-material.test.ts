import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parseShellRecipe, loadShellMesh, shellRim, compileCssSurfaceShell } from './index.ts';
import { validatePreparedCssSurfaceShell } from '@cssearth/objects';
import { dotN as dot } from '@cssearth/core';

const objectDirectory = resolve('src/objects/heliosphere');
const recipe = async () => parseShellRecipe(JSON.parse(await readFile(join(objectDirectory, 'source/shell.json'), 'utf8')) as unknown);
const prepared = async () => {
  const r = await recipe(), mesh = await loadShellMesh(join(objectDirectory, 'source'), r);
  return validatePreparedCssSurfaceShell(compileCssSurfaceShell({ id: 'fixture', recipe: r, mesh,
    atlasResource: { path: 'rim.png', width: r.atlas.columns * r.atlas.tileSize,
      height: Math.ceil(r.atlas.frames / r.atlas.columns) * r.atlas.tileSize, bytes: 1 }, provenance: {} }));
};
// Independent exhaustive reference for the nearest prepared facing level (ties choose the lower index).
const nearestFacingIndex = (value: number, levels: readonly number[]) => levels.reduce((best, level, index) =>
  Math.abs(value - level) < Math.abs(value - levels[best]!) ? index : best, 0);

test('interpolated corner material reduces source shader error at outside and near-surface viewpoints', async () => {
  const r = await recipe(), mesh = await loadShellMesh(join(objectDirectory, 'source'), r), shell = await prepared(), levels = r.atlas.facingLevels!;
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
