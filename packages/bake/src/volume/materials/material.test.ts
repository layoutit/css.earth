import { test } from 'vitest';
import assert from 'node:assert/strict';
import { compilerSlabMaterial, alphaLimitedSlabMaterial, channelGainSlabMaterial, lensChannelGainMaterial, splitChannelGain, validateChannelGain } from './slab-material.ts';

test('explicit slab offsets and quadrature spacing govern chroma and alpha-limited color', () => {
  const emission = (x: number, _y: number, _z: number, out: [number, number, number]) => out.fill(x < 0 ? .01 : .03);
  const material = (_x: number, _y: number, _z: number, out: [number, number, number]) => { out[0] = 255; out[1] = out[2] = 0; return true; };
  const visits: number[] = [], sample = compilerSlabMaterial(emission, (x, y, z, out) => { visits.push(x); return material(x, y, z, out); });
  const out: [number, number, number] = [0, 0, 0];
  const slab = { axis: 'x' as const, pitch: 100, samples: 2, sampleOffsets: [-.75, .25], sampleSpacing: .5 };
  assert.ok(alphaLimitedSlabMaterial(sample, emission, 1, 24)(0, 0, 0, out, slab));
  assert.deepEqual(visits, [-.75, .25]);
  const trust = 255 * -Math.expm1(-.02) / 24;
  assert.ok(Math.abs(out[1] - 255 * (1 - trust)) < 1e-10, 'Alpha uses the reference step, never mean pitch.');
  assert.throws(() => sample(0, 0, 0, out, { ...slab, sampleOffsets: [0] }), /matching offsets/);
  assert.throws(() => sample(0, 0, 0, out, { ...slab, sampleOffsets: [NaN, 0] }), /finite/);
});

test('thin displaced emission takes its own image color rather than the empty slice center', () => {
  const color: [number, number, number] = [0, 0, 0];
  const sample = compilerSlabMaterial((x, _y, _z, out) => { out[0] = out[1] = out[2] = x > .5 ? 2 : 0; },
    (x, _y, _z, out) => { out[0] = x > .5 ? 255 : 0; out[1] = 0; out[2] = x > .5 ? 0 : 255; return true; });
  assert.ok(sample(0, 0, 0, color, { axis: 'x', pitch: 4, samples: 4 }));
  assert.deepEqual(color, [255, 0, 0]);
});

test('constant source color stays constant through every bank and missing coverage stays explicit', () => {
  const color: [number, number, number] = [0, 0, 0];
  const sample = compilerSlabMaterial((_x, _y, _z, out) => { out[0] = out[1] = out[2] = 3; },
    (x, _y, _z, out) => { out[0] = 63.75; out[1] = 127.5; out[2] = 255; return x < 10; });
  for (const axis of ['x', 'y', 'z'] as const) {
    assert.ok(sample(0, 0, 0, color, { axis, pitch: 4, samples: 4 }));
    assert.deepEqual(color, [63.75, 127.5, 255]);
  }
  assert.equal(sample(20, 0, 0, color, { axis: 'z', pitch: 4, samples: 4 }), false);
});

test('weighted full-intensity channels remain inside the RGB transport range after floating-point division', () => {
  const color: [number, number, number] = [0, 0, 0];
  const sample = compilerSlabMaterial((x, _y, _z, out) => { out[0] = out[1] = out[2] = Math.exp(-x * x / 3); },
    (_x, _y, _z, out) => { out[0] = 30; out[1] = 80; out[2] = 255; return true; });
  for (let i = 0; i < 200; i++) {
    assert.ok(sample(i / 37, 0, 0, color, { axis: 'x', pitch: 1.3, samples: 4 }));
    assert.ok(color.every(channel => Number.isFinite(channel) && channel >= 0 && channel <= 255));
    assert.ok(color[2] > 254.999999999);
  }
});

test('XYZ slab materials sample identical emitting coordinates and preserve component mixtures', () => {
  for (const axis of ['x', 'y', 'z'] as const) {
    const coordinates: [number, number, number][] = [], sampled: [number, number, number][] = [], rgb: [number, number, number] = [0, 0, 0];
    const component = (x: number, y: number, z: number) => ({ x, y, z })[axis];
    const material = compilerSlabMaterial((x, y, z, out) => {
      coordinates.push([x, y, z]); out[0] = out[1] = out[2] = component(x, y, z) > 0 ? 3 : 1;
    }, (x, y, z, out) => {
      sampled.push([x, y, z]); out[0] = component(x, y, z) > 0 ? 0 : 255; out[1] = 0; out[2] = component(x, y, z) > 0 ? 255 : 0; return true;
    });
    assert.equal(material(0, 0, 0, rgb, { axis, pitch: 4, samples: 4 }), true);
    assert.deepEqual(sampled, coordinates); assert.deepEqual(rgb, [63.75, 0, 191.25]);
  }
  const rgb: [number, number, number] = [0, 0, 0];
  const mixture = compilerSlabMaterial((_x, _y, _z, out) => { out[0] = out[1] = out[2] = 1; },
    (_x, _y, _z, out) => { out[0] = out[2] = 127.5; out[1] = 0; return true; });
  assert.ok(mixture(0, 0, 0, rgb, { axis: 'z', pitch: 1, samples: 4 }));
  assert.deepEqual(rgb, [127.5, 0, 127.5], 'Mixed components must not be normalized back to twice their emission.');
});

test('alpha-limited slab material keeps chroma in dense slabs and neutralizes thin ones', () => {
  const orange = (_x: number, _y: number, _z: number, out: [number, number, number]) => { out[0] = 255; out[1] = 128; out[2] = 0; return true; };
  const slab = { axis: 'z' as const, pitch: 1, samples: 4 }, out: [number, number, number] = [0, 0, 0];
  const dense = (_x: number, _y: number, _z: number, out: [number, number, number]) => { out[0] = out[1] = out[2] = 2; };
  const thin = (_x: number, _y: number, _z: number, out: [number, number, number]) => { out[0] = out[1] = out[2] = .001; };
  assert.ok(alphaLimitedSlabMaterial(compilerSlabMaterial(dense, orange), dense, 1, 24)(0, 0, 0, out, slab));
  assert.deepEqual(out.map(Math.round), [255, 128, 0]);
  assert.ok(alphaLimitedSlabMaterial(compilerSlabMaterial(thin, orange), thin, 1, 24)(0, 0, 0, out, slab));
  assert.ok(out[2] > 240 && out[1] > 245, `thin slab stays near neutral: ${out}`);
  assert.throws(() => alphaLimitedSlabMaterial(compilerSlabMaterial(thin, orange), thin, 0, 24));
});

test('a lens channel gain scales its own chromaticity and never tints the zone the alpha limit neutralized', () => {
  const orange = (_x: number, _y: number, _z: number, out: [number, number, number]) => { out[0] = 255; out[1] = 128; out[2] = 0; return true; };
  const slab = { axis: 'z' as const, pitch: 1, samples: 4 }, out: [number, number, number] = [0, 0, 0];
  const dense = (_x: number, _y: number, _z: number, out: [number, number, number]) => { out[0] = out[1] = out[2] = 2; };
  const thin = (_x: number, _y: number, _z: number, out: [number, number, number]) => { out[0] = out[1] = out[2] = .001; };
  const read = (m: ReturnType<typeof compilerSlabMaterial>) => { assert.ok(m(0, 0, 0, out, slab)); return [...out] as [number, number, number]; };
  // The same statistic the delivered-texture check measures: (peak - low) / peak in the alpha 1..3 band.
  const saturation = (c: [number, number, number]) => (Math.max(...c) - Math.min(...c)) / Math.max(1, Math.max(...c));
  // No gain at all is exactly the accepted material, so an uncorrected lens keeps its accepted bytes.
  assert.deepEqual(read(lensChannelGainMaterial(compilerSlabMaterial(dense, orange), dense, 1, 24, null)),
    read(alphaLimitedSlabMaterial(compilerSlabMaterial(dense, orange), dense, 1, 24)));
  assert.deepEqual(read(lensChannelGainMaterial(compilerSlabMaterial(dense, orange), dense, 1, undefined, null)),
    read(compilerSlabMaterial(dense, orange)));
  // Where alpha carries colour, the gain is the plain per-channel multiplier it claims to be.
  assert.deepEqual(read(lensChannelGainMaterial(compilerSlabMaterial(dense, orange), dense, 1, 24, [.5, .5, .5])).map(Math.round), [128, 64, 0]);
  const bluer = (_x: number, _y: number, _z: number, o: [number, number, number]) => { o[0] = 200; o[1] = 100; o[2] = 100; return true; };
  assert.deepEqual(read(lensChannelGainMaterial(compilerSlabMaterial(dense, bluer), dense, 1, 24, [1, 1, 1.5])).map(Math.round), [200, 100, 150]);
  // A channel already at full is at the alpha's own level and clips there rather than exceeding it.
  assert.deepEqual(read(lensChannelGainMaterial(compilerSlabMaterial(dense, orange), dense, 1, 24, [1.4, 1, 1.5])).map(Math.round), [255, 128, 0]);
  // THE REGRESSION THIS EXISTS FOR: a NON-UNIFORM gain applied after the alpha chroma limit multiplies the
  // neutral 255 the limit produced by three different numbers, painting a constant false tint over exactly
  // the texels the limit protects. Measured on two LMC lenses as 0.09 and 0.21 mean saturation at alpha 1..3.
  const gain: [number, number, number] = [.472, .5, .452];
  const afterOnly = channelGainSlabMaterial(alphaLimitedSlabMaterial(compilerSlabMaterial(thin, orange), thin, 1, 24), gain);
  const split = lensChannelGainMaterial(compilerSlabMaterial(thin, orange), thin, 1, 24, gain);
  const wrong = read(afterOnly), right = read(split);
  assert.ok(saturation(wrong) > .08, `the naive order tints the neutralized zone: ${saturation(wrong).toFixed(3)} from ${wrong.map(v => v.toFixed(1))}`);
  assert.ok(saturation(right) < .02, `the split order leaves it neutral: ${saturation(right).toFixed(3)} from ${right.map(v => v.toFixed(1))}`);
  assert.ok(saturation(right) < saturation(wrong) / 4, 'and by a wide margin, not a rounding coincidence');
  // And it still carries the lens's exposure there, so the correction is not silently dropped.
  const plainThin = read(alphaLimitedSlabMaterial(compilerSlabMaterial(thin, orange), thin, 1, 24));
  assert.ok(Math.abs(right[1]! / plainThin[1]! - Math.max(...gain)) < .01,
    `the exposure still applies to the neutral zone: ${right[1]!.toFixed(1)} / ${plainThin[1]!.toFixed(1)}`);
  // A uniform gain cannot see this defect: both orders stay neutral, which is why it must be tested with
  // the non-uniform gain a white balance actually is.
  assert.ok(saturation(read(channelGainSlabMaterial(alphaLimitedSlabMaterial(compilerSlabMaterial(thin, orange), thin, 1, 24), [.4, .4, .4]))) < .02);
  assert.deepEqual(splitChannelGain([.472, .5, .452]).exposure, .5);
  assert.deepEqual(splitChannelGain([.472, .5, .452]).whiteBalance.map(v => +v.toFixed(3)), [.944, 1, .904]);
  assert.deepEqual(splitChannelGain([1, 1, 1]), { whiteBalance: [1, 1, 1], exposure: 1 });
  for (const bad of [[1, 1], [1, 1, 0], [1, 1, 5], [1, 1, Number.NaN], 'x', null, [1, 1, '1']])
    assert.throws(() => validateChannelGain(bad), `refuses ${JSON.stringify(bad)}`);
  assert.deepEqual(validateChannelGain([1, .5, 2]), [1, .5, 2]);
});

test('a lens tone curve moves the render onto its curve, stays neutral in the faint zone, and is absent-exact', async () => {
  const { validateLensToneCurve, lensToneRender } = await import('./slab-material.ts');
  const orange = (_x: number, _y: number, _z: number, out: [number, number, number]) => { out[0] = 255; out[1] = 128; out[2] = 0; return true; };
  const slab = { axis: 'z' as const, pitch: 1, samples: 4 }, out: [number, number, number] = [0, 0, 0];
  const dense = (_x: number, _y: number, _z: number, o: [number, number, number]) => { o[0] = o[1] = o[2] = 2; };
  const thin = (_x: number, _y: number, _z: number, o: [number, number, number]) => { o[0] = o[1] = o[2] = .001; };
  const read = (m: ReturnType<typeof compilerSlabMaterial>) => { assert.ok(m(0, 0, 0, out, slab)); return [...out] as [number, number, number]; };
  const knots = [0, 128, 255];
  const identity = validateLensToneCurve({ schema: 'cssearth-lens-tone-curve@1', knots, channels: [knots, knots, knots] });
  const dim = validateLensToneCurve({ schema: 'cssearth-lens-tone-curve@1', knots, channels: [[0, 64, 127.5], [0, 128, 255], [0, 96, 191.25]] });
  const level = 200, levelAt = () => level;
  // Absent: exactly the accepted composition. Identity: the same colours (up to float rounding).
  assert.deepEqual(read(lensChannelGainMaterial(compilerSlabMaterial(dense, orange), dense, 1, 24, null, null)),
    read(lensChannelGainMaterial(compilerSlabMaterial(dense, orange), dense, 1, 24, null)));
  assert.deepEqual(read(lensChannelGainMaterial(compilerSlabMaterial(dense, orange), dense, 1, 24, null, { curve: identity, levelAt })).map(Math.round), [255, 128, 0]);
  // Where alpha carries colour the painted render level is exactly the curve's value: red halves.
  const toned = read(lensChannelGainMaterial(compilerSlabMaterial(dense, orange), dense, 1, 24, null, { curve: dim, levelAt }));
  assert.ok(Math.abs(level * toned[0] / 255 - lensToneRender(dim, 0, level, level)) < 1e-9, `red on the curve: ${toned}`);
  assert.ok(Math.abs(toned[1] - 128) < 1e-9, `green identity: ${toned}`);
  // The curve cannot add light the opacity does not carry: the render never exceeds the projection byte.
  const bright = validateLensToneCurve({ schema: 'cssearth-lens-tone-curve@1', knots, channels: [[0, 255, 510], knots, knots] });
  assert.equal(lensToneRender(bright, 0, level, level), level);
  // Non-uniform channel curves must not tint the texels the alpha limit neutralized (same guard as the gain).
  const thinToned = read(lensChannelGainMaterial(compilerSlabMaterial(thin, orange), thin, 1, 24, null, { curve: dim, levelAt }));
  assert.ok((Math.max(...thinToned) - Math.min(...thinToned)) / Math.max(...thinToned) < .02, `faint zone stays neutral: ${thinToned}`);
  // A decreasing or open-ended curve is rejected.
  assert.throws(() => validateLensToneCurve({ schema: 'cssearth-lens-tone-curve@1', knots, channels: [[0, 100, 90], knots, knots] }));
  assert.throws(() => validateLensToneCurve({ schema: 'cssearth-lens-tone-curve@1', knots: [0, 128], channels: [[0, 1], [0, 1], [0, 1]] }));
});
