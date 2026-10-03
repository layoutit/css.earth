import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { readCompactSampled, decodeCompactPointColors, encodeCompactPointColors } from './compact-sampled.js';
import { readCompactSymmetry, decodeCompactSymmetryField } from './compact-symmetry.js';
import { readCompactFiniteEmission, readCompactFiniteDataset, readCompactToneProjection } from './compact-finite-emission.js';
import { readSimulationEnvelopeRecord, SIMULATION_ENVELOPE_SCHEMA } from './simulation-envelope.js';
import { readComponentMaterialReceipt, COMPONENT_MATERIAL_SCHEMA } from './component-material-receipt.js';
import { validateDatasetToneCurve, DATASET_TONE_CURVE_SCHEMA } from './dataset-tone-curve.js';

const json = async (path: string) => {
  const bytes = await readFile(path);
  return JSON.parse((path.endsWith('.gz') ? gunzipSync(bytes) : bytes).toString());
};

test('published sampled inputs retain the scene, material correspondence and exact float colors', async () => {
  const path = 'src/objects/m1-volume/source/compact/model.json.gz', raw = await json(path), input = readCompactSampled(raw);
  assert.equal(input.id, input.original.id);
  assert.deepEqual(input.datasets.map(d => d.id), raw.datasets.map((d: { id: string }) => d.id));
  for (const dataset of input.datasets) {
    const bytes = gunzipSync(await readFile(dataset.points.path));
    const colors = decodeCompactPointColors(bytes, input.recipe.source.height);
    for (let i = 0; i < colors.length; i++) assert.equal(colors[i], bytes.readDoubleLE(i * 8));
    assert.ok(Buffer.from(encodeCompactPointColors(colors)).equals(bytes), 'Encoded point colors must match the published bytes.');
  }
  const duplicate = structuredClone(raw); duplicate.datasets.push(duplicate.datasets[0]);
  assert.throws(() => readCompactSampled(duplicate), /datasets differ/);
  const identity = structuredClone(raw); identity.sourceResult = 'wrong';
  assert.throws(() => readCompactSampled(identity), /source result differs/);
  assert.throws(() => readCompactSampled({ ...raw, expected: [] }), /removed volume digest/);
  assert.throws(() => decodeCompactPointColors(new Uint8Array(1), 1), /size differs/);
  const corrupt = Buffer.alloc(32); corrupt.writeDoubleLE(.5, 24);
  assert.throws(() => decodeCompactPointColors(corrupt, 1), /Invalid point color/);
});

test('published symmetry records and float fields share one dimension and pin contract', async () => {
  const raw = await json('src/objects/m87-volume/source/compact/model.json'), input = readCompactSymmetry(raw);
  for (const channel of input.channels) {
    const bytes = gunzipSync(await readFile(channel.path));
    const values = decodeCompactSymmetryField(bytes, input.count);
    assert.equal(values.length, input.count);
    for (let i = 0; i < values.length; i++) assert.equal(values[i], bytes.readFloatLE(i * 4));
  }
  const wrong = structuredClone(raw); wrong.channels[0].bytes++;
  assert.throws(() => readCompactSymmetry(wrong), /Invalid emission pin/);
  const dimension = structuredClone(raw); dimension.recipe.grid.depth = 513;
  assert.throws(() => readCompactSymmetry(dimension), /dimensions/);
  assert.throws(() => decodeCompactSymmetryField(new Uint8Array(3), 1), /differs/);
  const corrupt = Buffer.alloc(4); corrupt.writeFloatLE(NaN);
  assert.throws(() => decodeCompactSymmetryField(corrupt, 1), /Invalid emission value/);
});

test('published finite delivery inputs retain every dataset and pinned tone projection', async () => {
  const files = ['lmc-volume', 'smc-volume'];
  let checked = 0;
  for (const id of files) {
    const path = `src/objects/${id}/source/compact/inputs.json`;
    const raw = await json(path);
    const input = readCompactFiniteEmission(raw), seen = new Set<string>();
    for (const dataset of raw.datasets) readCompactFiniteDataset(dataset, seen);
    if (input.toneProjection !== undefined) readCompactToneProjection(raw.toneProjection);
    assert.equal(typeof input.appearance.gamma, 'number');
    for (const patch of [{ appearance: {} }, { toneProjection: {} },
      { datasets: [{ ...raw.datasets[0], channelGain: [0, 1, 1] }] },
      { datasets: [{ ...raw.datasets[0], toneCurve: {} }] }])
      assert.throws(() => readCompactFiniteEmission({ ...raw, ...patch }));
    const envelope = readSimulationEnvelopeRecord(await json(input.envelope.path));
    assert.equal(envelope.gain.length, envelope.width * envelope.height);
    assert.equal(seen.size, input.datasets.length);
    const changed = structuredClone(raw.datasets[0]); changed.densityFilter.cutoff = .1;
    assert.throws(() => readCompactFiniteDataset(changed, new Set()), /unchanged density filter/);
    assert.throws(() => readCompactFiniteDataset(raw.datasets[0], seen), /Duplicate delivered dataset/);
    checked++;
  }
  assert.ok(checked > 0, 'The finite parser must accept a real published delivery.');
});

test('simulation-envelope, tone and material records reject corrupted retained data', () => {
  const envelope = { schema: SIMULATION_ENVELOPE_SCHEMA, settings: { scalePixels: 2, fraction: .5, floor: 0, depthSamples: 16, depthTrim: .005 },
    width: 2, height: 2, bounds: { min: [0, 0], max: [1, 1] }, zRange: [-1, 1], gain: [0, 1, 2, 3] };
  assert.deepEqual(readSimulationEnvelopeRecord(envelope), envelope);
  for (const bad of [{ ...envelope, gain: [1] }, { ...envelope, gain: [0, 1, NaN, 3] },
    { ...envelope, bounds: { min: [1, 0], max: [0, 1] } }, { ...envelope, zRange: [NaN, 1] },
    { ...envelope, settings: { ...envelope.settings, depthSamples: 0 } }]) assert.throws(() => readSimulationEnvelopeRecord(bad));
  const curve = { schema: DATASET_TONE_CURVE_SCHEMA, knots: [0, 128, 255], channels: [[0, 128, 255], [0, 128, 255], [0, 128, 255]] };
  assert.deepEqual(validateDatasetToneCurve(curve), curve);
  const descending = structuredClone(curve); descending.channels[1][2] = 1;
  assert.throws(() => validateDatasetToneCurve(descending), /monotone/);
  const material = { schema: COMPONENT_MATERIAL_SCHEMA, sourceId: 'image', fieldIdentity: 'field', components: [{ id: 'one', rgb: [1, 2, 3], covered: true }] };
  assert.deepEqual(readComponentMaterialReceipt(material, 'image', 'field'), material);
  assert.throws(() => readComponentMaterialReceipt(material, 'image', 'wrong'), /Missing accepted/);
  const corrupt = structuredClone(material); corrupt.components[0].rgb[1] = Infinity;
  assert.throws(() => readComponentMaterialReceipt(corrupt, 'image', 'field'), /component differs/);
});
