import assert from 'node:assert/strict';
import test from 'node:test';
import { GAIA_BP_RP_DISPLAY_DOMAIN, gaiaBpRpDisplayColor } from './catalogue-field.ts';

test('a Gaia BP-RP color is a display color inside the fit\'s domain and neutral outside it', () => {
  const channels = (css: string) => [1, 3, 5].map(at => parseInt(css.slice(at, at + 2), 16));
  const blue = gaiaBpRpDisplayColor(0), red = gaiaBpRpDisplayColor(1.5);
  assert.equal(blue.fallback, false); assert.equal(red.fallback, false);
  // A hot star's blue channel is its brightest; a cool star's red is.
  assert.equal(Math.max(...channels(blue.colorCss)), channels(blue.colorCss)[2]);
  assert.equal(Math.max(...channels(red.colorCss)), channels(red.colorCss)[0]);
  for (const outside of [null, GAIA_BP_RP_DISPLAY_DOMAIN[0], GAIA_BP_RP_DISPLAY_DOMAIN[1], 3]) assert.deepEqual(gaiaBpRpDisplayColor(outside), { colorCss: '#ffffff', fallback: true });
});
