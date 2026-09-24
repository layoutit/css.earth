import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { sourceLoad, sourceTest } from '../../../../tests/objects/source-test.mts';
import { srgbToLinear } from '../../color-transfer.mts';
import { limbDarkeningPlate } from './stellar-photometric-color.mts';
import { addSpotFigureToLimbPlate, parseSpotFigureModel } from './stellar-spot-figure.mts';

const root = new URL('../../../../src/objects/hd-189733/source/photometry/', import.meta.url);
const record = JSON.parse(await readFile(new URL('narrett-2024-band-model.json', root), 'utf8'));
const model = parseSpotFigureModel(record);
// The figure is a download (source/preparation/acquisition.json); a clone without it skips these tests.
const loaded = await sourceLoad(async () => sharp(await readFile(new URL('narrett-2024-figure-7.jpg', root))).raw().toBuffer({ resolveWithObject: true }));
const test = sourceTest('hd-189733', loaded);
const { data, info } = loaded.values;
const image = { data, width: info?.width, height: info?.height, channels: info?.channels };
const color = { linear: [1, 0.7605245046752924, 0.6239603916750761], srgb: [255, 226, 207] } as const;
const limb = { u1: 0.216, u2: 0.440 };

test('the AAS Figure 7 model keeps the paper quantities and uses its left panel', () => {
  assert.equal(info.width, 1017);
  assert.equal(info.height, 488);
  assert.deepEqual(model.panel, { x: 0, y: 0, size: 488 });
  assert.equal(model.reportedMeanCoveringFraction, 0.42);
  assert.deepEqual([model.reportedPhotosphereTemperatureK, model.reportedSpotTemperatureK], [5295, 3222]);
  assert.equal(model.spotToPhotosphereTessIntensityRatio, 0.099);
});

test('figure-derived mask has broad activity bands and retains the limb silhouette', () => {
  const size = 512, input = limbDarkeningPlate(size, limb, color).data;
  const { plate, projectedSpotFraction } = addSpotFigureToLimbPlate({ data: input, size, lossless: true }, image, model, color, limb);
  const alpha = (x: number, y: number) => plate.data[4 * (y * size + x) + 3]!;
  const originalAlpha = (x: number, y: number) => input[4 * (y * size + x) + 3]!;
  const light = (opacity: number) => color.srgb.reduce((sum, value, channel) =>
    sum + [0.2126, 0.7152, 0.0722][channel]! * srgbToLinear(value * (1 - opacity / 255) / 255), 0);
  assert.ok(projectedSpotFraction > 0.45 && projectedSpotFraction < 0.55, `source figure's projected disc is about half dark: ${projectedSpotFraction}`);
  assert.ok(Math.abs(light(alpha(256, 165)) / light(originalAlpha(256, 165)) - 0.099) < 0.01,
    'the upper band retains the paper TESS light ratio after sRGB encoding');
  assert.ok(alpha(256, 290) > originalAlpha(256, 290) + 100, 'the printed transit guide does not cut a hole in the dark band');
  assert.equal(alpha(256, 70), originalAlpha(256, 70), 'bright upper photosphere retains its limb darkening');
  assert.equal(alpha(0, 0), 0, 'outside the stellar silhouette stays transparent');
  assert.equal(originalAlpha(256, 165), limbDarkeningPlate(size, limb, color).data[4 * (165 * size + 256) + 3], 'source plate is not mutated');
});

test('invalid figure geometry and contrast fail before baking', () => {
  assert.throws(() => parseSpotFigureModel({ ...record, spotToPhotosphereTessIntensityRatio: 1 }), /Invalid/u);
  assert.throws(() => addSpotFigureToLimbPlate({ data: new Uint8Array(16), size: 2, lossless: true },
    { ...image, width: 100 }, model, color, limb), /recorded RGB panel/u);
});
