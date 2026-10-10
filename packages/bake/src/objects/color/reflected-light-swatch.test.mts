import { pathToFileURL } from 'node:url';
import { projectRoot as findProjectRoot } from '@cssearth/core/node';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { sourceTest } from '@cssearth/objects/node/source-test';
const test = sourceTest();
import { adaptToSrgbWhite, parseCieTable, reflectedLightSwatch } from '@cssearth/bake/objects/color';
import { readCie1931ColorMatching } from '@cssearth/bake/objects/sources';

const colorMatching = parseCieTable((await readCie1931ColorMatching()).toString('utf8'), 3);
const visible = Array.from({ length: 401 }, (_, index) => 380 + index);
const flat = () => 1;

test('the adaptation and encoding reproduce the swatch Mars records, from the XYZ and solar white it records', async () => {
  const mars = JSON.parse(await readFile(new URL('src/objects/mars/swatch.json', pathToFileURL(findProjectRoot(import.meta.url) + '/')), 'utf8'));
  const adapted = adaptToSrgbWhite(mars.conversion.xyzSolarWhiteY1, mars.conversion.illuminant.whitePointXy);
  // Color Science's sRGB matrix differs from IEC's printed one in the fourth decimal.
  const linear = [[3.2404542, -1.5371385, -0.4985314], [-0.969266, 1.8760108, 0.041556], [0.0556434, -0.2040259, 1.0572252]]
    .map(row => row[0]! * adapted[0] + row[1]! * adapted[1] + row[2]! * adapted[2]);
  linear.forEach((value, channel) => assert.ok(Math.abs(value - mars.conversion.linearSrgbD65[channel]) < 2e-4, `channel ${channel}: ${value}`));
});

test('a gray surface is white in any light, and a white the adaptation starts from stays where it is', () => {
  const warm = (wavelength: number) => wavelength / 380;
  assert.equal(reflectedLightSwatch(visible, () => 0.3, flat, colorMatching).hex, '#ffffff');
  assert.equal(reflectedLightSwatch(visible, () => 0.3, warm, colorMatching).hex, '#ffffff');
  assert.deepEqual(adaptToSrgbWhite([0.3127 / 0.329, 1, 0.3583 / 0.329], [0.3127, 0.329]).map(value => Math.round(value * 1e6)), [950456, 1000000, 1089058]);
});

test('a surface that reflects more red than blue is warm, and its luminous reflectance is kept before the normalization', () => {
  const swatch = reflectedLightSwatch(visible, wavelength => 0.2 + 0.4 * (wavelength - 380) / 400, flat, colorMatching);
  assert.ok(swatch.rgb[0] === 255 && swatch.rgb[1] < 255 && swatch.rgb[2] < swatch.rgb[1], swatch.hex);
  assert.ok(swatch.xyzLightWhiteY1[1] > 0.2 && swatch.xyzLightWhiteY1[1] < 0.6);
});

test('light with no visible power, a negative reflectance and a wavelength outside the table are refused', () => {
  assert.throws(() => reflectedLightSwatch(visible, flat, () => 0, colorMatching), /no visible power/u);
  assert.throws(() => reflectedLightSwatch(visible, () => -0.1, flat, colorMatching), /zero or more/u);
  assert.throws(() => reflectedLightSwatch([200], flat, flat, colorMatching), /must cover 200 nm/u);
});
