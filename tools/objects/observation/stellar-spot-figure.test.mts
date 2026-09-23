import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { sourceTest } from '../../../tests/objects/source-test.mts';
import { addSpotFigureToLimbPlate, parseSpotFigureModel } from './stellar-spot-figure.mts';

const test = sourceTest();
const root = new URL('../../../src/objects/hd-189733/source/photometry/', import.meta.url);
const record = JSON.parse(await readFile(new URL('narrett-2024-band-model.json', root), 'utf8'));
const model = parseSpotFigureModel(record);
const { data, info } = await sharp(await readFile(new URL('narrett-2024-figure-7.jpg', root))).raw().toBuffer({ resolveWithObject: true });
const image = { data, width: info.width, height: info.height, channels: info.channels };

test('the AAS Figure 7 model keeps the paper quantities and uses its left panel', () => {
  assert.equal(info.width, 1017);
  assert.equal(info.height, 488);
  assert.deepEqual(model.panel, { x: 0, y: 0, size: 488 });
  assert.equal(model.reportedMeanCoveringFraction, 0.42);
  assert.deepEqual([model.reportedPhotosphereTemperatureK, model.reportedSpotTemperatureK], [5295, 3222]);
  assert.equal(model.spotToPhotosphereTessIntensityRatio, 0.099);
});

test('figure-derived mask has broad activity bands and retains the limb silhouette', () => {
  const size = 512, input = new Uint8Array(size * size * 4);
  const { plate, projectedSpotFraction } = addSpotFigureToLimbPlate({ data: input, size, lossless: true }, image, model);
  const alpha = (x: number, y: number) => plate.data[4 * (y * size + x) + 3]!;
  assert.ok(projectedSpotFraction > 0.45 && projectedSpotFraction < 0.55, `source figure's projected disc is about half dark: ${projectedSpotFraction}`);
  assert.ok(alpha(256, 165) > 220, 'upper band uses the paper TESS intensity ratio');
  assert.ok(alpha(256, 290) > 220, 'the printed transit guide does not cut a hole in the dark band');
  assert.equal(alpha(256, 70), 0, 'bright upper photosphere remains bright');
  assert.equal(alpha(0, 0), 0, 'outside the stellar silhouette stays transparent');
  assert.equal(input[4 * (165 * size + 256) + 3], 0, 'source plate is not mutated');
});

test('invalid figure geometry and contrast fail before baking', () => {
  assert.throws(() => parseSpotFigureModel({ ...record, spotToPhotosphereTessIntensityRatio: 1 }), /Invalid/u);
  assert.throws(() => addSpotFigureToLimbPlate({ data: new Uint8Array(16), size: 2, lossless: true },
    { ...image, width: 100 }, model), /recorded RGB panel/u);
});
