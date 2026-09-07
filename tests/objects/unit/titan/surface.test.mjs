import {observation} from '../observation.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import sharp from 'sharp';

test('Titan keeps the dark northern seas at their independently mapped east longitudes', async () => {
  // Cassini radar places Kraken Mare at 60–80 N, 30–80 E:
  // https://www.nature.com/articles/s41467-024-49837-2
  // A mirrored or half-turned globe loses this landmark contrast.
  const {data, info} = await observation('titan', 'normal');
  const {width, height} = info;
  async function mean(latitude, longitude) {
    const pixels = await sharp(data, {raw: info}).extract({
      left: Math.round(longitude / 360 * width) - 8,
      top: Math.round((90 - latitude) / 180 * height) - 8, width: 16, height: 16,
    }).greyscale().raw().toBuffer();
    return pixels.reduce((sum, value) => sum + value, 0) / pixels.length;
  }
  const sea = await mean(70, 50), land = await mean(70, 180);
  assert.ok(sea > 1 && sea < land * 0.6, 'Observed sea must remain dark, correctly located and unmasked.');
});
