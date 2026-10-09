import assert from 'node:assert/strict';
import test from 'node:test';
import { imageLayerSurfaceCrossings, stlTriangles } from '@cssearth/bake/image-layers';
import { emissionProfile, revolvedSurface, surfaceOutlines, surfacePole, surfaceStl } from '@cssearth/nebula-reconstruction/methods/symmetry/surfaces';

/** A hollow prolate shell about the x axis: emission 1 within half a cell of radius r(s) = 6·sqrt(1 − (s/10)²). */
function shell() {
  const grid = { width: 31, height: 21, depth: 21 }, prior = { axis: [1, 0, 0] as const, center: [15, 10, 10] as const, binWidth: 1 };
  const volume = new Float32Array(grid.width * grid.height * grid.depth);
  for (let z = 0, i = 0; z < grid.depth; z++) for (let y = 0; y < grid.height; y++) for (let x = 0; x < grid.width; x++, i++) {
    const s = x - 15, r = Math.hypot(y - 10, z - 10), wall = Math.abs(s) < 10 ? 6 * Math.sqrt(1 - (s / 10) ** 2) : -1;
    if (wall > 0 && Math.abs(r - wall) <= .5) volume[i] = 1;
  }
  return { grid, prior, volume };
}

test('the symmetry fit reads as a revolved wall and envelope at the shell’s radius', () => {
  const { grid, prior, volume } = shell();
  const surface = revolvedSurface(emissionProfile([volume], grid, prior), .2);
  const middle = surface.samples.find(sample => sample.axialCells === 0)!;
  assert.equal(middle.wallCells, 6);
  assert.ok(Math.abs(middle.envelopeCells - 6.5) <= .5);
  for (const sample of surface.samples) assert.ok(Math.abs(sample.wallCells - 6 * Math.sqrt(Math.max(0, 1 - (sample.axialCells / 10) ** 2))) <= 1, `wall at s=${sample.axialCells}`);
  assert.throws(() => revolvedSurface(emissionProfile([new Float32Array(volume.length)], grid, prior)), /no emission/);
});

test('the envelope is a closed binary STL the image-layer bake reads as a geometry.surface', () => {
  const { grid, prior, volume } = shell();
  const surface = revolvedSurface(emissionProfile([volume], grid, prior), .2), bytes = surfaceStl(surface, 24);
  const triangles = stlTriangles(bytes, 'surface.stl');
  assert.equal(triangles.length / 9, bytes.readUInt32LE(80));
  // Closed: every edge is shared by exactly two triangles.
  const edges = new Map<string, number>(), key = (a: number[], b: number[]) => [a, b].map(p => p.map(v => v.toFixed(4)).join(',')).sort().join('|');
  for (let t = 0; t < triangles.length; t += 9) for (const [i, j] of [[0, 1], [1, 2], [2, 0]] as const) {
    const a = [...triangles.slice(t + 3 * i, t + 3 * i + 3)], b = [...triangles.slice(t + 3 * j, t + 3 * j + 3)];
    edges.set(key(a, b), (edges.get(key(a, b)) ?? 0) + 1);
  }
  assert.ok([...edges.values()].every(count => count === 2), 'every edge shared twice');
  // The bake's own ray caster crosses it twice through the star (front and back), at the shell's envelope radius.
  const pole = surfacePole(prior, 0);
  assert.equal(pole.tipped, true); assert.equal(pole.tiltDeg, 89); assert.equal(pole.measuredTiltDeg, 90);
  const recipe = { source: 'wenger-2013', basis: 'test', path: 'surface.stl', arcsecPerUnit: 1, originUnits: [0, 0, 0] as [number, number, number],
    pole: { tiltDeg: pole.tiltDeg, paDeg: pole.paDeg, rollDeg: 0, receding: pole.receding }, fitArcsec: .5 };
  const crossings = imageLayerSurfaceCrossings(recipe, triangles, 3, 3, (px, py) => [(px - 1) * 4, (1 - py) * 4]);
  const centre = [...crossings.depths.slice(4 * 6, 5 * 6)].filter(Number.isFinite);
  assert.equal(centre.length, 2);
  assert.ok(Math.abs(Math.abs(centre[0]!) - surface.samples.find(sample => sample.axialCells === 0)!.envelopeCells) < 1);
});

test('the outline is the silhouette about the axis, and the pole’s position angle follows the image’s north', () => {
  const { grid, prior, volume } = shell();
  const surface = revolvedSurface(emissionProfile([volume], grid, prior), .2), outlines = surfaceOutlines(surface, prior);
  const envelope = outlines.find(outline => outline.kind === 'envelope')!;
  assert.equal(envelope.closed, true);
  assert.ok(envelope.points.every(([, y]) => Math.abs(y - 10) <= 7));
  assert.equal(outlines.filter(outline => outline.kind === 'wall').length, 2);
  // North up, east left: an axis along image right points west (PA 270); one pointing up is PA 0, or PA 90 with north to the right.
  assert.equal(surfacePole(prior, 0).paDeg, 270);
  assert.equal(surfacePole({ ...prior, axis: [0, -1, 0] }, 0).paDeg, 0);
  assert.equal(surfacePole({ ...prior, axis: [0, -1, 0] }, 90).paDeg, 90);
  assert.equal(surfacePole({ ...prior, axis: [0, 0, 1] }, 0).receding, '-z');
});
