import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { fitLimb, limbAccepted } from './limb.mts';

/** A lit disc on noisy sky, with a bright interior band that must not pass for a limb. */
function syntheticFrame({ centre, radius, sky = 0.06, disc = 0.6, noise = 0.04, width = 1000, seed = 7 }:
  { centre: [number, number]; radius: number; sky?: number; disc?: number; noise?: number; width?: number; seed?: number }) {
  let state = seed;
  const random = () => { state = (state * 1103515245 + 12345) % 2147483648; return state / 2147483648 - 0.5; };
  const values = new Float32Array(width * width);
  for (let y = 0; y < width; y++) for (let x = 0; x < width; x++) {
    const r = Math.hypot(x - centre[0], y - centre[1]);
    const inside = Math.max(0, Math.min(1, radius - r + 0.5));
    const band = Math.abs(y - centre[1] - radius * 0.4) < 25 && r < radius - 40 ? 0.35 : 0;
    values[y * width + x] = sky + inside * (disc + band - sky) + noise * random();
  }
  return { width, height: width, values };
}

test('the limb fit recovers a disc centre the pointing missed by 60 pixels', () => {
  const truth: [number, number] = [540, 470], image = syntheticFrame({ centre: truth, radius: 300 });
  const fit = fitLimb(image, { centre: [truth[0] - 50, truth[1] + 33], radiusPixels: 300, sunDirection: [1, 0] });
  assert.ok(limbAccepted(fit), `accepted: ${JSON.stringify(fit)}`);
  assert.ok(Math.hypot(fit.centre[0] - truth[0], fit.centre[1] - truth[1]) < 0.5, `centre ${fit.centre}`);
  assert.ok(fit.rmsPixels < 1);
});

test('only the sunlit side is used, so a terminator never pulls the fit', () => {
  const truth: [number, number] = [500, 500], image = syntheticFrame({ centre: truth, radius: 250 });
  // Darken the half facing away from the Sun: its edge is a terminator, not a limb.
  for (let y = 0; y < 1000; y++) for (let x = 0; x < 500 - 30; x++) image.values[y * 1000 + x] = 0.06;
  const fit = fitLimb(image, { centre: [510, 490], radiusPixels: 250, sunDirection: [1, 0] });
  assert.ok(limbAccepted(fit));
  assert.ok(Math.hypot(fit.centre[0] - truth[0], fit.centre[1] - truth[1]) < 0.5, `centre ${fit.centre}`);
});

test('a frame without a limb in view is not accepted', () => {
  const image = syntheticFrame({ centre: [500, 500], radius: 2000 });
  const fit = fitLimb(image, { centre: [500, 500], radiusPixels: 2000, sunDirection: [1, 0] });
  assert.equal(limbAccepted(fit), false);
});
