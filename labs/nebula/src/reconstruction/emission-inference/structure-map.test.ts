import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeStructureMap, colorStructureLayer, ridgeDirection, structureLayers } from './structure-map.js';
const settings = { scales: 4, significanceSigma: 2, compactMaxScale: 1,
  elongatedAxisRatio: 2.5, minRegionPixels: 3, connectivity: 8 as const, noiseSigma: .001 };

test('full-frame structure partition preserves faint edge emission in every RGB band', () => {
  const width = 48, height = 40, rgb = new Uint8Array(width * height * 3);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const p = y * width + x;
    rgb.set([7 + Math.round(150 * Math.exp(-((x - 15) ** 2 + (y - 20) ** 2) / 150)),
      3 + (x * 3 + y) % 80, 4 + (x + y * 2) % 50], p * 3);
  }
  rgb.set([90, 2, 5], 0); // Real edge light: outside any hypothetical central ring.
  const result = analyzeStructureMap(rgb, width, height, settings);
  const layers = structureLayers.map(layer => colorStructureLayer(rgb, result.fractions[layer]));
  for (let i = 0; i < rgb.length; i++) {
    assert.ok(Math.abs(layers.reduce((sum, layer) => sum + layer[i]!, 0) - rgb[i]! / 255) < 1e-6);
    for (const layer of layers) assert.ok(layer[i]! >= 0);
  }
  assert.ok(result.metrics.reconstructionMaxError < 1e-6);
  assert.ok(layers.reduce((sum, layer) => sum + layer[0]!, 0) > .35, 'The edge cannot silently disappear.');
  assert.ok(result.metrics.signalFractions.unassigned >= 0);
});

test('directional evidence distinguishes a curved ridge from a round knot', () => {
  const width = 71, height = 71, image = new Float32Array(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    image[y * width + x] = Math.exp(-.5 * ((Math.hypot(x - 35, y - 35) - 22) / 2) ** 2);
  }
  const ridge = ridgeDirection(image, width, height, 57, 35);
  assert.ok(ridge.coherence > .9);
  assert.ok(Math.abs(Math.cos(ridge.tangentRadians)) < .1, 'Rightmost circular arc has a vertical tangent.');
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) image[y * width + x] = Math.exp(-((x - 35) ** 2 + (y - 35) ** 2) / 8);
  assert.ok(ridgeDirection(image, width, height, 35, 35).coherence < .01);
});

test('uncertain detail stays in the unassigned map and does not vanish', () => {
  const width = 31, height = 31, rgb = new Uint8Array(width * height * 3).fill(10);
  rgb.set([255, 180, 20], (15 * width + 15) * 3);
  const result = analyzeStructureMap(rgb, width, height, { ...settings, significanceSigma: 1e6 });
  assert.ok(result.metrics.unassignedFraction > .001);
  assert.equal(result.regions.length, 0);
  assert.ok(result.metrics.reconstructionMaxError < 1e-6);
});
