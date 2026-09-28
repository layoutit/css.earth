import assert from 'node:assert/strict';
import { test as it } from 'node:test';
import { longitudeDistanceDeg, measureAtlasLeftEdge } from './atlas-edge.ts';

// A surface with no longitude symmetry (three unequal bumps), and a map of it that starts at `edge` degrees east.
const bump = (longitude: number, latitude: number, centre: number, height: number) => {
  const d = ((((longitude - centre) % 360) + 540) % 360) - 180;
  return height * Math.exp(-(d * d + latitude * latitude) / 900);
};
const surface = (longitude: number, latitude: number) => 60 + bump(longitude, latitude, 40, 150) + bump(longitude, latitude, 130, 60) + bump(longitude, latitude, 290, 100);
function map(edge: number, width = 360, height = 180) {
  const data = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) data[y * width + x] = Math.round(surface(edge + (x + 0.5) * 360 / width, 90 - (y + 0.5) * 180 / height));
  return { data, width, height };
}

it('finds where a map starts, and scores the expected edge separately', () => {
  for (const edge of [0, 180, 150]) {
    const measured = measureAtlasLeftEdge(surface, map(edge), 0);
    assert.ok(longitudeDistanceDeg(measured.edgeDeg, edge) <= 2, `edge ${edge}: measured ${measured.edgeDeg}`);
    assert.ok(measured.correlation > 0.95);
    if (edge !== 0) assert.ok(measured.expectedCorrelation < measured.correlation - 0.2);
  }
});

it('uses only the source cells the sampler returns', () => {
  const partial = (longitude: number, latitude: number) => longitude > 30 && longitude < 120 && latitude < 0 ? surface(longitude, latitude) : null;
  const measured = measureAtlasLeftEdge(partial, map(180), 180);
  assert.equal(measured.edgeDeg, 180);
  assert.ok(measured.samples < 4000);
});

it('measures circular longitude distance', () => {
  assert.equal(longitudeDistanceDeg(359, 1), 2);
  assert.equal(longitudeDistanceDeg(0, 180), 180);
});
