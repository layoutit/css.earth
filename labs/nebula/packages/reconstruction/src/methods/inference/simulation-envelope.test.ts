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

test('the chroma trust ramp is an authored envelope setting whose default reproduces the accepted bytes', () => {
  // A bright orange core on a grey sky with a faint wing, so trust separates the two.
  const patch = new Uint8Array(width * height * 3).fill(20);
  for (let p = 0; p < width * height; p++) {
    const x = p % width, y = Math.floor(p / width), d = Math.hypot(x - 8, y - 16);
    const level = d < 4 ? 1 : d < 13 ? .12 : 0;
    patch[p * 3] = 20 + Math.round(200 * level); patch[p * 3 + 1] = 20 + Math.round(100 * level); patch[p * 3 + 2] = 20;
  }
  const partial = coverage.map((_, p) => (p % width < 16 ? 1 : 0));
  const out: [number, number, number] = [0, 0, 0], read = (f: ReturnType<typeof envelopeChromaticity>, x: number, y: number) => {
    assert.ok(f(x, y, out)); return [...out] as [number, number, number];
  };
  // An omitted setting and an explicit 0.9 are the same function: the accepted records carry no key.
  const implicit = envelopeChromaticity(patch, partial, width, height, bounds, 2);
  const explicit = envelopeChromaticity(patch, partial, width, height, bounds, 2, .9);
  for (const [x, y] of [[-3, 0], [-2.5, 1.6], [-1.5, 2], [-3.5, -1]] as [number, number][])
    assert.deepEqual(read(implicit, x, y), read(explicit, x, y), `default equals 0.9 at ${x},${y}`);
  // The accepted five-key settings object keeps its exact stored bytes, so replaying an accepted envelope
  // record cannot change its identity; an authored quantile is appended last and is validated.
  const accepted = { scalePixels: 10, fraction: .85, floor: .03, depthSamples: 256, depthTrim: .005 };
  assert.equal(JSON.stringify(validateEnvelopeSettings(accepted)), JSON.stringify(accepted));
  assert.equal(JSON.stringify(validateEnvelopeSettings({ ...accepted, chromaHalfSaturationQuantile: .35 })),
    JSON.stringify({ ...accepted, chromaHalfSaturationQuantile: .35 }));
  for (const bad of [0, -.1, 1.5, Number.NaN, '0.5'])
    assert.throws(() => validateEnvelopeSettings({ ...accepted, chromaHalfSaturationQuantile: bad }), `refuses ${String(bad)}`);
  for (const bad of [0, -.1, 1.5, Number.NaN])
    assert.throws(() => envelopeChromaticity(patch, partial, width, height, bounds, 2, bad), `refuses ${String(bad)}`);
  // Lowering the quantile keeps measured colour further out: the faint wing gets saturated, the core cannot
  // exceed its own measured hue, and nothing outside coverage gains colour.
  const trusting = envelopeChromaticity(patch, partial, width, height, bounds, 2, .2);
  const saturation = (c: [number, number, number]) => (Math.max(...c) - Math.min(...c)) / Math.max(1, Math.max(...c));
  const wingDefault = read(implicit, -1.5, 2), wingTrusting = read(trusting, -1.5, 2);
  assert.ok(saturation(wingTrusting) > saturation(wingDefault) + .05,
    `faint wing keeps more colour at a lower quantile: ${wingDefault} -> ${wingTrusting}`);
  const coreDefault = read(implicit, -3, 0), coreTrusting = read(trusting, -3, 0);
  assert.ok(saturation(coreTrusting) >= saturation(coreDefault) - 1e-9, 'the bright core is never desaturated by more trust');
  assert.ok(coreTrusting[0]! >= coreTrusting[1]! && coreTrusting[1]! >= coreTrusting[2]!, `hue order is the image's own: ${coreTrusting}`);
  assert.equal(trusting(9, 0, out), false, 'no colour outside the grid');
  assert.ok(trusting(3.5, 0, out)); assert.deepEqual(out, [255, 255, 255], 'uncovered sky stays neutral at any quantile');
});

test('an authored sky quantile and footprint-edge taper fix what the trust ramp alone could only trade off', () => {
  // A coloured body that fills most of its own footprint, so the median of covered pixels is body light,
  // not sky: subtracting it reports a hue the image does not have.
  const rgb = new Uint8Array(width * height * 3);
  for (let p = 0; p < width * height; p++) {
    const x = p % width, y = Math.floor(p / width), inside = Math.hypot(x - 8, y - 16) < 11;
    rgb[p * 3] = inside ? 200 : 12; rgb[p * 3 + 1] = inside ? 150 : 12; rgb[p * 3 + 2] = inside ? 120 : 12;
  }
  const partial = coverage.map((_, p) => (p % width < 16 ? 1 : 0));
  const out: [number, number, number] = [0, 0, 0];
  const read = (f: ReturnType<typeof envelopeChromaticity>, x: number, y: number) => {assert.ok(f(x, y, out)); return [...out] as [number, number, number];};
  const ratio = (c: [number, number, number]) => c[2]! / c[0]!;
  // The image's own blue/red ratio above a sky-level pedestal is 108/188; the median pedestal is body
  // light, so it reports a redder hue than the image has, and the default only differs by the ramp.
  const truth = (120 - 12) / (200 - 12);
  const median = envelopeChromaticity(rgb, partial, width, height, bounds, 2, .25);
  const lowSky = envelopeChromaticity(rgb, partial, width, height, bounds, 2, .25, .1);
  const centre = read(median, -2, 0), corrected = read(lowSky, -2, 0);
  assert.ok(Math.abs(ratio(corrected) - truth) < Math.abs(ratio(centre) - truth) - .02,
    `an authored sky quantile reports the image's own hue: ${ratio(centre).toFixed(3)} -> ${ratio(corrected).toFixed(3)} against ${truth.toFixed(3)}`);
  // The gain tapers across the observed footprint edge; without the same taper on colour, a boundary pixel
  // keeps a full-strength colour extrapolated from however few covered pixels it has.
  const tapered = envelopeChromaticity(rgb, partial, width, height, bounds, 2, .25, .1, .5);
  const saturation = (c: [number, number, number]) => (Math.max(...c) - Math.min(...c)) / Math.max(1, Math.max(...c));
  const edgeOpen = read(lowSky, -.3, 0), edgeTapered = read(tapered, -.3, 0);
  assert.ok(saturation(edgeTapered) < saturation(edgeOpen) * .6,
    `the footprint edge fades toward neutral: ${saturation(edgeOpen).toFixed(3)} -> ${saturation(edgeTapered).toFixed(3)}`);
  // Well inside the footprint the taper changes nothing, so it removes false edge colour without paying
  // for it in the body: a taper that dimmed the interior would be a global desaturation in disguise.
  assert.deepEqual(read(tapered, -2, 0), corrected, 'a fully covered pixel is untouched by the taper');
  // Omitting the settings keeps the accepted arithmetic exactly, and both are validated and recorded only
  // when authored, so an accepted envelope record replays with its exact stored bytes.
  assert.deepEqual(read(envelopeChromaticity(rgb, partial, width, height, bounds, 2, .25, .1, 0), -.3, 0), edgeOpen,
    'an explicit zero taper is the accepted arithmetic');
  assert.deepEqual(read(envelopeChromaticity(rgb, partial, width, height, bounds, 2, .25), -.3, 0),
    read(envelopeChromaticity(rgb, partial, width, height, bounds, 2, .25, .5, 0), -.3, 0),
    'omitting both settings is the median sky with no taper');
  const accepted = {scalePixels: 10, fraction: .85, floor: .03, depthSamples: 256, depthTrim: .005};
  assert.equal(JSON.stringify(validateEnvelopeSettings(accepted)), JSON.stringify(accepted));
  assert.equal(JSON.stringify(validateEnvelopeSettings({...accepted, chromaSkyQuantile: .1, chromaCoverageTaper: .5})),
    JSON.stringify({...accepted, chromaSkyQuantile: .1, chromaCoverageTaper: .5}));
  for (const bad of [0, -.1, 1.5, Number.NaN, '0.1'])
    assert.throws(() => validateEnvelopeSettings({...accepted, chromaSkyQuantile: bad}), `refuses sky ${String(bad)}`);
  for (const bad of [-.1, 1, 1.5, Number.NaN, '0.5'])
    assert.throws(() => validateEnvelopeSettings({...accepted, chromaCoverageTaper: bad}), `refuses taper ${String(bad)}`);
  for (const bad of [-.1, 1, 1.5, Number.NaN])
    assert.throws(() => envelopeChromaticity(rgb, partial, width, height, bounds, 2, .25, .1, bad), `refuses taper ${String(bad)}`);
});
