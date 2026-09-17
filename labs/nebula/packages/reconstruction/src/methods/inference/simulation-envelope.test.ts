import { test } from 'node:test'; import assert from 'node:assert/strict';
import { fitSimulationEnvelope, createEnvelopeSampler, envelopeChromaticity, validateEnvelopeSettings } from './simulation-envelope.ts';
import type { SimulationDepthPrior } from './simulation-guided.ts';

// An elongated simulation: bright bar along z at x≈0, depth extent ±8.
const prior: SimulationDepthPrior = { identity: 'b'.repeat(64), bounds: { min: [-4, -4, -10], max: [4, 4, 10] },
  sampleDensity: (x, y, z) => Math.exp(-.5 * ((x / 1.2) ** 2 + (y / 1.2) ** 2 + (z / 5) ** 2)) };
const width = 32, height = 32, bounds = { min: [-4, -4] as [number, number], max: [4, 4] as [number, number] };
const coverage = new Uint8Array(width * height).fill(1);
const settings = { scalePixels: 3, fraction: .8, floor: 0, depthSamples: 64, depthTrim: 0 };

test('envelope depth follows the simulation, never the image', () => {
  // Image: a compact blob offset from the simulation centre.
  const target = Float32Array.from({ length: width * height }, (_, p) => Math.exp(-(((p % width) - 18) ** 2 + (Math.floor(p / width) - 14) ** 2) / 20));
  const fit = fitSimulationEnvelope({ target, coverage, width, height, bounds }, prior, settings), sample = createEnvelopeSampler(fit.grid, prior);
  const x = .5, y = .5, front = sample(x, y, 0), deep = sample(x, y, 5);
  assert.ok(front > 0, 'envelope has emission where image and simulation overlap');
  // Ratio along the ray equals the simulation's own ratio: image brightness cannot reshape depth.
  assert.ok(Math.abs(deep / front - prior.sampleDensity(x, y, 5) / prior.sampleDensity(x, y, 0)) < 1e-9);
  const brighter = fitSimulationEnvelope({ target: target.map(v => 3 * v), coverage, width, height, bounds }, prior, settings);
  const b = createEnvelopeSampler(brighter.grid, prior);
  assert.ok(Math.abs(b(x, y, 5) / b(x, y, 0) - deep / front) < 1e-9);
  assert.equal(sample(x, y, 11), 0, 'no emission beyond the simulation depth range');
  const trimmed = fitSimulationEnvelope({ target, coverage, width, height, bounds }, prior, { ...settings, depthTrim: .05 });
  assert.ok(trimmed.grid.zRange[0] > -10 && trimmed.grid.zRange[1] < 10 && trimmed.grid.zRange[0] < -5 && trimmed.grid.zRange[1] > 5, `trimmed ${trimmed.grid.zRange}`);
  assert.equal(createEnvelopeSampler(trimmed.grid, prior)(x, y, 9.9), 0, 'trimmed tail carries no emission');
});

test('envelope projection matches the smoothed image scaled by fraction and floor adds only where the simulation exists', () => {
  const target = Float32Array.from({ length: width * height }, (_, p) => .2 * prior.sampleDensity(-4 + (p % width + .5) * 8 / width, 4 - (Math.floor(p / height) + .5) * 8 / height, 0));
  const fit = fitSimulationEnvelope({ target, coverage, width, height, bounds }, prior, settings);
  assert.ok(Math.abs(fit.metrics.envelopeLightFraction - settings.fraction) < .08, `light fraction ${fit.metrics.envelopeLightFraction}`);
  const dark = fitSimulationEnvelope({ target: new Float32Array(width * height), coverage, width, height, bounds }, prior, { ...settings, floor: .1 });
  assert.equal(dark.metrics.globalRatio, 0); assert.ok(dark.projection.every(v => v === 0), 'no image light means no envelope light');
  const floored = fitSimulationEnvelope({ target: target.map((v, p) => p % width < 16 ? v : 0), coverage, width, height, bounds }, prior, { ...settings, floor: .2 });
  assert.ok(floored.metrics.floorPixels > 0); assert.ok(floored.projection[width * 16 + 30]! > 0, 'floor keeps faint simulation wings');
  assert.throws(() => validateEnvelopeSettings({ ...settings, fraction: 2 }));
  const half = coverage.map((_, p) => p % width < 16 ? 1 : 0), edged = fitSimulationEnvelope({ target, coverage: half, width, height, bounds }, prior, { ...settings, floor: .2 });
  const row = width * 16; assert.ok(edged.grid.gain[row + 17]! === 0 && edged.grid.gain[row + 8]! > 0 && edged.grid.gain[row + 15]! < edged.grid.gain[row + 8]!, 'gain tapers to zero across the footprint edge');
});

test('chromaticity is peak-normalized, smoothed and neutral outside coverage', () => {
  const rgb = new Uint8Array(width * height * 3); for (let p = 0; p < width * height; p++) { rgb[p * 3] = 200; rgb[p * 3 + 1] = 100; rgb[p * 3 + 2] = 50; }
  const partial = coverage.map((_, p) => p % width < 16 ? 1 : 0);
  // Uniform colour equals the sky level: nothing remains after sky removal, so it is neutral.
  const color = envelopeChromaticity(rgb, partial, width, height, bounds, 2), out: [number, number, number] = [0, 0, 0];
  assert.ok(color(-2, 0, out)); assert.deepEqual(out, [255, 255, 255]);
  // A bright orange patch on a grey sky keeps its hue where bright, and fades to neutral where faint.
  const patch = new Uint8Array(width * height * 3).fill(20);
  for (let p = 0; p < width * height; p++) { const x = p % width, y = Math.floor(p / width), d = Math.hypot(x - 8, y - 16);
    if (d < 5) { patch[p * 3] = 220; patch[p * 3 + 1] = 120; patch[p * 3 + 2] = 20; } }
  const tinted = envelopeChromaticity(patch, partial, width, height, bounds, 1);
  assert.ok(tinted(-3, 0, out)); const centre = [...out]; assert.ok(centre[2]! < centre[1]! && centre[1]! < centre[0]!, `centre ${centre}`);
  assert.ok(tinted(-.25, 3.5, out)); assert.ok(out[2]! > centre[2]!, 'faint edge is less saturated than the bright centre');
  assert.ok(color(3.5, 0, out)); assert.deepEqual(out, [255, 255, 255]);
  assert.equal(color(9, 0, out), false);
});
