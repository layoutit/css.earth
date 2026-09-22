import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { readPhotometricMgeRecipe, verifyPhotometricEvidence } from './photometric-prior.ts';

test('photometric evidence validation rejects cross-subject or repinned source snapshots', async () => {
  const recipe = readPhotometricMgeRecipe(JSON.parse(await readFile('labs/nebula/models/omega-centauri/photometric-mge.json', 'utf8')));
  const evidence: unknown = JSON.parse(await readFile(recipe.evidence.path, 'utf8'));
  verifyPhotometricEvidence(recipe, evidence, recipe.id);
  assert.throws(() => verifyPhotometricEvidence(recipe, evidence, 'other'), /another subject/);
  assert.throws(() => verifyPhotometricEvidence(recipe, { schema: 'cssearth-nebula-physical-evidence@1', subjectId: 'other', sources: [] }, recipe.id), /evidence ledger/);
});

import { fitPhotometricEmission } from './photometric-prior.ts';
import { createPhotometricMgePrior } from '@cssearth/nebula-reconstruction/methods/inference/photometric-mge';
import { createPhotometricEmission } from '@cssearth/volume-core/fields/photometric-emission';
import { readRetainedEmissionField } from '@cssearth/volume-core/fields/retained-emission';
import { geometrySha } from '../geometry/registered-source.ts';

test('two-scale fit retains smooth light and finite residuals, including after JSON replay', async () => {
  const published = readPhotometricMgeRecipe(JSON.parse(await readFile('labs/nebula/models/omega-centauri/photometric-mge.json', 'utf8')));
  const recipe = readPhotometricMgeRecipe({ ...published, residualMaximumComponents: undefined, gaussians: [{ centralAmplitude: 1, sigmaArcsec: 100, projectedAxisRatio: 1 }],
    envelope: { scalePixels: 3, fraction: .95, floor: 0, depthSamples: 128, depthTrim: .001 } });
  const width = 32, bounds = { min: [-300, -300] as [number, number], max: [300, 300] as [number, number] };
  const target = Float32Array.from({ length: width * width }, (_, p) => {
    const x = -300 + (p % width + .5) * 600 / width, y = 300 - (Math.floor(p / width) + .5) * 600 / width;
    return Math.exp(-.5 * (x * x + y * y) / 10000) + .5 * Math.exp(-.5 * ((x - 40) ** 2 + (y - 30) ** 2) / 150);
  });
  const fit = fitPhotometricEmission({ target, coverage: new Uint8Array(target.length).fill(1), width, height: width, bounds },
    { detail: 1, faint: .35, depth: 1 }, { recipe, prior: createPhotometricMgePrior(recipe), recipeBytes: Buffer.from(''), evidenceBytes: Buffer.from(''), recipeSha256: geometrySha('fixture') },
    new AbortController().signal, () => {});
  assert.ok(fit.field.photometricEnvelope);
  assert.ok(fit.field.components.length > 0);
  assert.ok('envelopeMetrics' in fit && fit.envelopeMetrics.envelopeLightFraction > .8);
  const original = createPhotometricEmission(fit.field), replay = createPhotometricEmission(readRetainedEmissionField(JSON.parse(JSON.stringify(fit.field))));
  const missing = createPhotometricEmission({ ...fit.field, photometricEnvelope: undefined });
  let fullColumn = 0, missingColumn = 0;
  const a = [0, 0, 0], b = [0, 0, 0], c = [0, 0, 0];
  for (let z = -600; z < 600; z += 2) {
    original.sampleEmission(0, 0, z, a); replay.sampleEmission(0, 0, z, b); missing.sampleEmission(0, 0, z, c);
    assert.deepEqual(a, b); fullColumn += a[0]! * 2; missingColumn += c[0]! * 2;
  }
  assert.ok(fullColumn > .7 && fullColumn < 1.2);
  assert.ok(missingColumn < fullColumn * .3, 'dropping the envelope must lose the broad light');
  const colors = fit.field.components.map(component => ({ id: component.id, rgb: [255, 100, 80] as [number, number, number], covered: true }));
  assert.throws(() => replay.createMaterialSampler(colors), /envelope colors/);
  const envelopeColors = { width: 2, height: 2, rgb: Array.from({ length: 12 }, (_, i) => [100, 160, 255][i % 3]!) };
  const paint = original.createMaterialSampler(colors, envelopeColors), copied = replay.createMaterialSampler(colors, envelopeColors);
  for (const z of [-150, 0, 150]) {
    const x: [number, number, number] = [0, 0, 0], y: [number, number, number] = [0, 0, 0];
    assert.equal(paint(0, 0, z, x), copied(0, 0, z, y)); assert.deepEqual(x, y);
  }
});

import { fitEmissionField } from '@cssearth/nebula-reconstruction/methods/inference/fit';
test('authored residual budget bounds the fit and omitted budgets preserve historical defaults', async () => {
  const width = 48, target = Float32Array.from({ length: width * width }, (_, p) => (Math.sin(p * 41.71) + 1) / 2);
  const input = { width, height: width, target, bounds: { min: [-100, -100] as [number, number], max: [100, 100] as [number, number] } };
  const controls = { detail: 1, faint: 1, depth: 1 };
  const bounded = fitEmissionField(input, controls, { externalDepthAssignment: true, maximumComponents: 16 });
  assert.ok(bounded.field.components.length <= 16 && bounded.field.components.length > 0);
  assert.equal(bounded.metrics.iterations, 16);
  const recipe = JSON.parse(await readFile('labs/nebula/models/omega-centauri/photometric-mge.json', 'utf8'));
  assert.equal(readPhotometricMgeRecipe({ ...recipe, residualMaximumComponents: 4096 }).residualMaximumComponents, 4096);
  delete recipe.residualMaximumComponents;
  assert.equal(readPhotometricMgeRecipe(recipe).residualMaximumComponents, undefined);
  assert.throws(() => fitEmissionField(input, controls, { maximumComponents: 8193 }), /budget/);
  assert.throws(() => readPhotometricMgeRecipe({ ...recipe, residualMaximumComponents: 1.5 }), /budget/);
});

import type { EmissionFieldModel } from '@cssearth/volume-core/contracts/emission';
test('validated envelope chroma bounds the exact round2 green-channel roundoff without accepting nonfinite colors', async () => {
  // Real x-49 texel: [-1362.6885062830177,-664.6052184385982,1306.7023521967885] arcsec.
  // Its finite light (1.276095724233293e-23) is below one ULP of the envelope light;
  // this single Gaussian reproduces that exact envelope weight without a multi-megabyte fixture.
  const light = 0.0000020943697978687045, sigmaArcsec = 1 / (Math.sqrt(2 * Math.PI) * light);
  assert.equal(light * 255 / light, 255.00000000000003);
  const published = JSON.parse(await readFile('labs/nebula/models/omega-centauri/photometric-mge.json', 'utf8'));
  const recipe = readPhotometricMgeRecipe({ ...published, inclinationDegrees: 90,
    gaussians: [{ centralAmplitude: 1, sigmaArcsec, projectedAxisRatio: 1 }] });
  const skyBounds = { min: [-1, -1] as [number, number], max: [1, 1] as [number, number] };
  const model: EmissionFieldModel = { schema: 'cssearth-conditional-emission-field@1', identity: 'e'.repeat(64),
    controls: { detail: 1, faint: .35, depth: 1 }, components: [], bounds: { min: [-1, -1, -1], max: [1, 1, 1] }, skyBounds, scaffold: null,
    assumptions: { kernel: 'regression fixture', projectionUnits: 'relative light', depth: 'regression fixture', halo: 'none', haloRadiusArcsec: 1, equalNearFarSplit: false, velocityUncoveredComponents: 0 },
    photometricEnvelope: { schema: 'cssearth-photometric-envelope@1', priorIdentity: 'a'.repeat(64), recipe,
      width: 2, height: 2, bounds: skyBounds, zRange: [-1, 1], gain: [1, 1, 1, 1] } };
  const field = createPhotometricEmission(model), out: [number, number, number] = [0, 0, 0];
  field.sampleEmission(0, 0, 0, out); assert.equal(out[0], light);
  const colors = { width: 2, height: 2, rgb: Array.from({ length: 12 }, (_, i) => [198.46347151697145, 255, 224.6307247429958][i % 3]!) };
  assert.equal(field.createMaterialSampler([], colors)(0, 0, 0, out), true);
  assert.equal(out[1], 255); assert.ok(out.every(c => Number.isFinite(c) && c >= 0 && c <= 255));
  assert.throws(() => field.createMaterialSampler([], { ...colors, rgb: colors.rgb.map(() => Infinity) }), /envelope colors/);
});
