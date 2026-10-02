import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parseShellRecipe, loadShellMesh, shellRim } from '@cssearth/bake/shell';
import { SHELL_CORNER_PERMUTATIONS, shellMaterialAddress, type PreparedCssSurfaceShell } from '@cssearth/objects';
import { nearestFacingIndex } from '@cssearth/renderer/shell/material-address.ts';
import { dotN as dot } from '@cssearth/core';

const objectDirectory = resolve('src/objects/heliosphere');
const recipe = async () => parseShellRecipe(JSON.parse(await readFile(join(objectDirectory, 'source/shell.json'), 'utf8')) as unknown);
const prepared = async () => (JSON.parse(await readFile(join(objectDirectory, 'prepared/shell.json'), 'utf8')) as { data: PreparedCssSurfaceShell }).data;

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
