import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { tieBandRatios } from '../objects/terrestrial-layers/photometric-observations.mts';
import { CHANNEL_NAMES, floodDiscMean, loadLimbLaw } from './limb.mts';
import { displayBandRatios, loadWholeDiscColour, parseWholeDiscColour, WHOLE_DISC_COLOUR_SCHEMA } from './whole-disc-colour.mts';

const record = { schema: WHOLE_DISC_COLOUR_SCHEMA, id: 'fixture', quantity: 'fixture', spectrum: {}, illuminant: {}, observer: 'fixture', linearSrgb: [0.5, 0.4, 0.25] };

test('a whole-disc colour gives green and blue ratios to red, and the tie brings a map onto them', () => {
  const policy = displayBandRatios(parseWholeDiscColour(record));
  assert.deepEqual(policy, { reference: 'red', ratios: { green: 0.8, blue: 0.5 }, source: 'fixture' });
  // A 4 x 2 map, bluer than the record, with one texel per row brighter: the tie scales green and blue once each.
  const rgb = new Float32Array([0.4, 0.4, 0.4, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.4, 0.4, 0.4, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2]);
  const tie = tieBandRatios(rgb, new Uint8Array(8).fill(1), 4, 2, CHANNEL_NAMES, policy);
  assert.deepEqual(tie.gains, [1, 0.8, 0.5]);
  for (let pixel = 0; pixel < 8; pixel++) assert.ok(Math.abs(rgb[pixel * 3 + 1]! / rgb[pixel * 3]! - 0.8) < 1e-6 && Math.abs(rgb[pixel * 3 + 2]! / rgb[pixel * 3]! - 0.5) < 1e-6);
});

test('a whole-disc colour record refuses unknown keys, a wrong schema and non-positive channels', () => {
  assert.throws(() => parseWholeDiscColour({ ...record, gains: [1, 1, 1] }), /unknown keys: gains/u);
  assert.throws(() => parseWholeDiscColour({ ...record, schema: 'other' }), /must use cssearth-whole-disc-colour@1/u);
  assert.throws(() => parseWholeDiscColour({ ...record, linearSrgb: [0.5, 0, 0.2] }), /three positive linear sRGB channels/u);
});

test('a map with its limb law divided out is tied through the law\'s disc means, which for Minnaert are 2 / (2k + 1)', async () => {
  const saturn = resolve(import.meta.dirname, '../../src/objects/saturn/source');
  const law = await loadLimbLaw(saturn, ['photometry/opal-2025-minnaert-f631n.json', 'photometry/opal-2025-minnaert-f502n.json', 'photometry/opal-2025-minnaert-f467m.json']);
  // Held at 86.3 degrees, the OPAL disc edge, the means stay within 0.001 of the full-disc Minnaert integral.
  floodDiscMean(law).forEach((mean, channel) => assert.ok(Math.abs(mean - 2 / (2 * [0.8, 0.65, 0.86][channel]! + 1)) < 1e-3, `channel ${channel}: ${mean}`));
  assert.deepEqual(displayBandRatios(parseWholeDiscColour(record), [0.5, 1, 0.25]).ratios, { green: 0.4, blue: 1 });
  assert.throws(() => displayBandRatios(parseWholeDiscColour(record), [1, 0, 1]), /disc means must be positive/u);
});

test("Saturn's record is Karkoschka's sunlit disc, #ceb794", async () => {
  const colour = await loadWholeDiscColour(resolve(import.meta.dirname, '../../src/objects/saturn/source'), 'photometry/karkoschka-1998-whole-disc-colour.json');
  assert.deepEqual(displayBandRatios(colour).ratios, { green: 0.764, blue: 0.4834 });
});
